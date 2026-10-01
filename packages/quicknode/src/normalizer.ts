import { decodeEventLog, parseAbiItem, type AbiItem } from "viem";
import type { ChainEvent, RawLog } from "./types.js";

export const NORN_EVENT_ABIS = [
  parseAbiItem(
    "event SettlementExecuted(bytes32 indexed batchId, address indexed payer, address indexed payee, address asset, uint256 amount)"
  ),
  parseAbiItem(
    "event RiskRegimeChanged(uint8 indexed previousRegime, uint8 indexed newRegime, string reason)"
  ),
  parseAbiItem(
    "event ObligationRegistered(bytes32 indexed obligationId, address indexed payer, address indexed payee, address asset, uint256 amount, uint256 dueDate)"
  ),
  parseAbiItem(
    "event ObligationCreated(bytes32 indexed id, address indexed payer, address indexed payee, address asset, uint256 amount, uint8 priority, uint256 expiresAt)"
  ),
  parseAbiItem(
    "event LiquidityDeposited(address indexed participant, address indexed asset, uint256 amount)"
  ),
  parseAbiItem(
    "event LiquidityWithdrawn(address indexed participant, address indexed asset, uint256 amount)"
  ),
  parseAbiItem(
    "event EmergencyFreezeToggled(bool indexed frozen, address indexed triggeredBy, string reason)"
  ),
  parseAbiItem(
    "event EmergencyTriggered(address indexed guardian, string reason)"
  )
] as const;

export class EventNormalizer {
  private readonly abis: readonly AbiItem[];

  constructor(customAbis: readonly AbiItem[] = []) {
    this.abis = [...NORN_EVENT_ABIS, ...customAbis];
  }

  static getEventId(
    chainId: number,
    txHash: `0x${string}` | string,
    logIndex: number | string
  ): string {
    const parsedIndex = typeof logIndex === "string" ? parseInt(logIndex, 10) : logIndex;
    return `${chainId}-${txHash.toLowerCase()}-${parsedIndex}`;
  }

  static getEventIdFromEvent(event: ChainEvent): string {
    return EventNormalizer.getEventId(event.chainId, event.txHash, event.logIndex);
  }

  getEventId(event: ChainEvent): string {
    return EventNormalizer.getEventIdFromEvent(event);
  }

  normalizeLog(
    rawLog: RawLog | Record<string, unknown>,
    chainId: number,
    observedAt?: string
  ): ChainEvent | null {
    const address = (rawLog.address ?? (rawLog as any).contract ?? "0x0") as `0x${string}`;
    const rawTopics = (rawLog.topics ?? []) as `0x${string}`[];
    const data = ((rawLog.data ?? "0x") as `0x${string}`) || "0x";

    if (!rawTopics || rawTopics.length === 0) {
      return null;
    }

    const blockNumber = this.parseBlockNumber(rawLog.blockNumber);
    const txHash = ((rawLog.transactionHash ?? (rawLog as any).txHash ?? "0x0") as string).toLowerCase() as `0x${string}`;
    const logIndex = this.parseLogIndex(rawLog.logIndex);
    const timestamp = observedAt ?? new Date().toISOString();

    try {
      const decoded = decodeEventLog({
        abi: this.abis as any,
        data,
        topics: rawTopics as [signature: `0x${string}`, ...args: `0x${string}`[]]
      }) as unknown as { eventName: string; args?: Record<string, unknown> };

      const argsRecord: Record<string, unknown> = {};
      if (decoded.args && typeof decoded.args === "object") {
        for (const [key, value] of Object.entries(decoded.args)) {
          argsRecord[key] = value;
        }
      }

      return {
        chainId,
        blockNumber,
        txHash,
        logIndex,
        contract: address.toLowerCase() as `0x${string}`,
        eventName: decoded.eventName,
        args: argsRecord,
        observedAt: timestamp
      };
    } catch {
      return null;
    }
  }

  normalizeBatch(
    logs: (RawLog | Record<string, unknown>)[],
    chainId: number,
    observedAt?: string
  ): ChainEvent[] {
    const events: ChainEvent[] = [];
    for (const log of logs) {
      const normalized = this.normalizeLog(log, chainId, observedAt);
      if (normalized) {
        events.push(normalized);
      }
    }
    return events;
  }

  private parseBlockNumber(val: unknown): bigint {
    if (typeof val === "bigint") return val;
    if (typeof val === "number") return BigInt(val);
    if (typeof val === "string") {
      if (val.startsWith("0x") || val.startsWith("0X")) {
        return BigInt(val);
      }
      return BigInt(val);
    }
    return 0n;
  }

  private parseLogIndex(val: unknown): number {
    if (typeof val === "number") return val;
    if (typeof val === "bigint") return Number(val);
    if (typeof val === "string") {
      if (val.startsWith("0x") || val.startsWith("0X")) {
        return parseInt(val, 16);
      }
      return parseInt(val, 10);
    }
    return 0;
  }
}
