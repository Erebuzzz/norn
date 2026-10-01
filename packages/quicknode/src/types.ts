export interface ChainEvent {
  chainId: number;
  blockNumber: bigint;
  txHash: `0x${string}`;
  logIndex: number;
  contract: `0x${string}`;
  eventName: string;
  args: Record<string, unknown>;
  observedAt: string;
}

export interface StreamCheckpoint {
  chainId: number;
  lastBlockNumber: bigint;
  lastTxHash: `0x${string}`;
  lastLogIndex: number;
  updatedAt: string;
}

export interface QuickNodeConfig {
  endpointUrl: string;
  chainId: number;
  timeoutMs?: number;
  maxRetries?: number;
  backoffBaseMs?: number;
}

export interface RawLog {
  address: `0x${string}`;
  topics: readonly `0x${string}`[] | `0x${string}`[];
  data: `0x${string}`;
  blockNumber?: bigint | string | number | null;
  transactionHash?: `0x${string}` | null;
  logIndex?: number | string | null;
}

export interface HealthCheckResult {
  healthy: boolean;
  latencyMs: number;
  blockNumber?: bigint;
  chainId?: number;
  error?: string;
}

export type EventListener = (event: ChainEvent) => void | Promise<void>;

export interface CheckpointStorage {
  saveCheckpoint(checkpoint: StreamCheckpoint): Promise<void> | void;
  loadCheckpoint(chainId: number): Promise<StreamCheckpoint | null> | StreamCheckpoint | null;
}

export interface StreamConsumerOptions {
  dedupeLimit?: number;
  storage?: CheckpointStorage;
}
