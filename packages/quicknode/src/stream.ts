import type {
  ChainEvent,
  StreamCheckpoint,
  RawLog,
  EventListener,
  CheckpointStorage,
  StreamConsumerOptions
} from "./types.js";
import { EventNormalizer } from "./normalizer.js";

export class InMemoryCheckpointStorage implements CheckpointStorage {
  private checkpoints = new Map<number, StreamCheckpoint>();

  async saveCheckpoint(checkpoint: StreamCheckpoint): Promise<void> {
    this.checkpoints.set(checkpoint.chainId, { ...checkpoint });
  }

  async loadCheckpoint(chainId: number): Promise<StreamCheckpoint | null> {
    const cp = this.checkpoints.get(chainId);
    return cp ? { ...cp } : null;
  }

  clear(): void {
    this.checkpoints.clear();
  }
}

export class StreamConsumer {
  readonly chainId: number;
  private readonly normalizer: EventNormalizer;
  private readonly storage: CheckpointStorage;
  private readonly dedupeLimit: number;
  private readonly seenEventIds = new Map<string, number>();
  private readonly listeners = new Map<string, Set<EventListener>>();
  private readonly wildcardListeners = new Set<EventListener>();
  private currentCheckpoint: StreamCheckpoint | null = null;

  constructor(
    chainId: number,
    options: StreamConsumerOptions = {},
    normalizer?: EventNormalizer
  ) {
    this.chainId = chainId;
    this.normalizer = normalizer ?? new EventNormalizer();
    this.storage = options.storage ?? new InMemoryCheckpointStorage();
    this.dedupeLimit = options.dedupeLimit ?? 10000;
  }

  // --- Deduplication Cache ---

  isDuplicate(eventId: string): boolean {
    return this.seenEventIds.has(eventId);
  }

  markSeen(eventId: string): void {
    if (this.seenEventIds.size >= this.dedupeLimit) {
      // Evict oldest 20% of entries to maintain bounded size
      const entriesToRemove = Math.max(1, Math.floor(this.dedupeLimit * 0.2));
      const keys = this.seenEventIds.keys();
      for (let i = 0; i < entriesToRemove; i++) {
        const next = keys.next();
        if (next.done) break;
        this.seenEventIds.delete(next.value);
      }
    }
    this.seenEventIds.set(eventId, Date.now());
  }

  getCacheSize(): number {
    return this.seenEventIds.size;
  }

  clearCache(): void {
    this.seenEventIds.clear();
  }

  // --- Event Listener Dispatcher ---

  on(eventName: string, listener: EventListener): () => void {
    let set = this.listeners.get(eventName);
    if (!set) {
      set = new Set();
      this.listeners.set(eventName, set);
    }
    set.add(listener);

    return () => {
      this.off(eventName, listener);
    };
  }

  onAny(listener: EventListener): () => void {
    this.wildcardListeners.add(listener);
    return () => {
      this.wildcardListeners.delete(listener);
    };
  }

  off(eventName: string, listener: EventListener): void {
    const set = this.listeners.get(eventName);
    if (set) {
      set.delete(listener);
      if (set.size === 0) {
        this.listeners.delete(eventName);
      }
    }
  }

  private async dispatchEvent(event: ChainEvent): Promise<void> {
    const specific = this.listeners.get(event.eventName);
    const promises: Promise<void>[] = [];

    if (specific) {
      for (const listener of specific) {
        try {
          const res = listener(event);
          if (res instanceof Promise) promises.push(res);
        } catch (err) {
          console.error(`Error in listener for ${event.eventName}:`, err);
        }
      }
    }

    for (const listener of this.wildcardListeners) {
      try {
        const res = listener(event);
        if (res instanceof Promise) promises.push(res);
      } catch (err) {
        console.error("Error in wildcard event listener:", err);
      }
    }

    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }
  }

  // --- Ingestion Pipeline ---

  async ingestEvents(events: ChainEvent[]): Promise<ChainEvent[]> {
    const sorted = [...events].sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) {
        return a.blockNumber < b.blockNumber ? -1 : 1;
      }
      return a.logIndex - b.logIndex;
    });

    const accepted: ChainEvent[] = [];

    for (const event of sorted) {
      const eventId = EventNormalizer.getEventIdFromEvent(event);
      if (this.isDuplicate(eventId)) {
        continue;
      }

      this.markSeen(eventId);
      accepted.push(event);

      this.updateInternalCheckpoint(event);
      await this.dispatchEvent(event);
    }

    return accepted;
  }

  async ingestRawLogs(
    rawLogs: (RawLog | Record<string, unknown>)[],
    observedAt?: string
  ): Promise<ChainEvent[]> {
    const normalized = this.normalizer.normalizeBatch(rawLogs, this.chainId, observedAt);
    return this.ingestEvents(normalized);
  }

  async ingestStreamPayload(payload: unknown): Promise<ChainEvent[]> {
    const rawLogs = this.extractLogsFromPayload(payload);
    return this.ingestRawLogs(rawLogs);
  }

  private extractLogsFromPayload(payload: unknown): (RawLog | Record<string, unknown>)[] {
    if (!payload) return [];

    if (Array.isArray(payload)) {
      const extracted: (RawLog | Record<string, unknown>)[] = [];
      for (const item of payload) {
        if (item && typeof item === "object") {
          // Could be a log directly or a block containing logs
          if ("topics" in item && "data" in item) {
            extracted.push(item as RawLog);
          } else if ("logs" in item && Array.isArray((item as any).logs)) {
            extracted.push(...(item as any).logs);
          } else if ("receipts" in item && Array.isArray((item as any).receipts)) {
            for (const receipt of (item as any).receipts) {
              if (receipt && Array.isArray(receipt.logs)) {
                extracted.push(...receipt.logs);
              }
            }
          }
        }
      }
      return extracted;
    }

    if (typeof payload === "object" && payload !== null) {
      const obj = payload as Record<string, unknown>;
      if (Array.isArray(obj.data)) {
        return this.extractLogsFromPayload(obj.data);
      }
      if (Array.isArray(obj.logs)) {
        return obj.logs as RawLog[];
      }
      if (Array.isArray(obj.receipts)) {
        return this.extractLogsFromPayload(obj.receipts);
      }
      if ("topics" in obj && "data" in obj) {
        return [obj as unknown as RawLog];
      }
    }

    return [];
  }

  // --- Checkpoint State Management ---

  private updateInternalCheckpoint(event: ChainEvent): void {
    if (
      !this.currentCheckpoint ||
      event.blockNumber > this.currentCheckpoint.lastBlockNumber ||
      (event.blockNumber === this.currentCheckpoint.lastBlockNumber &&
        event.logIndex > this.currentCheckpoint.lastLogIndex)
    ) {
      this.currentCheckpoint = {
        chainId: this.chainId,
        lastBlockNumber: event.blockNumber,
        lastTxHash: event.txHash,
        lastLogIndex: event.logIndex,
        updatedAt: new Date().toISOString()
      };
    }
  }

  getCheckpoint(): StreamCheckpoint | null {
    return this.currentCheckpoint ? { ...this.currentCheckpoint } : null;
  }

  async saveCheckpoint(checkpoint?: StreamCheckpoint): Promise<void> {
    const toSave = checkpoint ?? this.currentCheckpoint;
    if (toSave) {
      this.currentCheckpoint = { ...toSave };
      await this.storage.saveCheckpoint(this.currentCheckpoint);
    }
  }

  async loadCheckpoint(): Promise<StreamCheckpoint | null> {
    const loaded = await this.storage.loadCheckpoint(this.chainId);
    if (loaded) {
      this.currentCheckpoint = { ...loaded };
    }
    return this.currentCheckpoint ? { ...this.currentCheckpoint } : null;
  }

  async replayFromCheckpoint(
    fromCheckpoint?: StreamCheckpoint,
    queryFn?: (fromBlock: bigint, toBlock?: bigint) => Promise<(RawLog | Record<string, unknown> | ChainEvent)[]>
  ): Promise<number> {
    const checkpoint = fromCheckpoint ?? (await this.loadCheckpoint());
    if (!checkpoint) {
      return 0;
    }

    if (!queryFn) {
      return 0;
    }

    const queried = await queryFn(checkpoint.lastBlockNumber);
    if (!queried || queried.length === 0) {
      return 0;
    }

    // Convert any raw logs into ChainEvent
    const candidateEvents: ChainEvent[] = [];
    for (const item of queried) {
      if ("eventName" in item && "contract" in item && "args" in item) {
        candidateEvents.push(item as ChainEvent);
      } else {
        const normalized = this.normalizer.normalizeLog(
          item as RawLog,
          this.chainId
        );
        if (normalized) {
          candidateEvents.push(normalized);
        }
      }
    }

    // Filter out items at or before checkpoint
    const filtered = candidateEvents.filter((ev) => {
      if (ev.blockNumber < checkpoint.lastBlockNumber) return false;
      if (
        ev.blockNumber === checkpoint.lastBlockNumber &&
        ev.logIndex <= checkpoint.lastLogIndex
      ) {
        return false;
      }
      return true;
    });

    const accepted = await this.ingestEvents(filtered);
    if (accepted.length > 0) {
      await this.saveCheckpoint();
    }

    return accepted.length;
  }
}
