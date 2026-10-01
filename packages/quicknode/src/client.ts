import { createPublicClient, http, type PublicClient } from "viem";
import type { QuickNodeConfig, HealthCheckResult, RawLog } from "./types.js";

export class QuickNodeClient {
  readonly endpointUrl: string;
  readonly chainId: number;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly backoffBaseMs: number;
  private readonly customFetch?: typeof fetch;
  private viemClient?: PublicClient;

  constructor(config: QuickNodeConfig, customFetch?: typeof fetch) {
    if (!config.endpointUrl) {
      throw new Error("QuickNodeConfig requires a valid endpointUrl");
    }
    this.endpointUrl = config.endpointUrl;
    this.chainId = config.chainId;
    this.timeoutMs = config.timeoutMs ?? 10000;
    this.maxRetries = config.maxRetries ?? 3;
    this.backoffBaseMs = config.backoffBaseMs ?? 150;
    this.customFetch = customFetch;
  }

  getPublicClient(): PublicClient {
    if (!this.viemClient) {
      this.viemClient = createPublicClient({
        transport: http(this.endpointUrl, {
          fetchOptions: {
            signal: AbortSignal.timeout(this.timeoutMs)
          },
          retryCount: this.maxRetries,
          retryDelay: this.backoffBaseMs
        })
      });
    }
    return this.viemClient;
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName = "RPC operation"
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (err: unknown) {
        lastError = err;
        if (attempt >= this.maxRetries) {
          break;
        }

        const isRetryable = this.isRetryableError(err);
        if (!isRetryable) {
          throw err;
        }

        const jitter = Math.random() * this.backoffBaseMs;
        const delay = this.backoffBaseMs * Math.pow(2, attempt) + jitter;
        await this.sleep(delay);
      }
    }

    const message = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(
      `${operationName} failed after ${this.maxRetries + 1} attempts: ${message}`
    );
  }

  private isRetryableError(error: unknown): boolean {
    if (!error) return false;
    const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    
    // Check common transient conditions
    if (
      msg.includes("429") ||
      msg.includes("rate limit") ||
      msg.includes("timeout") ||
      msg.includes("aborterror") ||
      msg.includes("econnreset") ||
      msg.includes("etimedout") ||
      msg.includes("500") ||
      msg.includes("502") ||
      msg.includes("503") ||
      msg.includes("504") ||
      msg.includes("network error") ||
      msg.includes("fetch failed")
    ) {
      return true;
    }

    return true; // Default to retrying transient RPC requests
  }

  async rpcCall<T>(method: string, params: unknown[] = []): Promise<T> {
    const fetchImpl = this.customFetch || globalThis.fetch;

    return this.executeWithRetry(async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetchImpl(this.endpointUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: Date.now(),
            method,
            params
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }

        const json = await response.json();
        if (json.error) {
          throw new Error(`RPC error (${json.error.code}): ${json.error.message}`);
        }

        return json.result as T;
      } finally {
        clearTimeout(timer);
      }
    }, `rpcCall(${method})`);
  }

  async checkHealth(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const [blockNumberHex, chainIdHex] = await Promise.all([
        this.rpcCall<string>("eth_blockNumber"),
        this.rpcCall<string>("eth_chainId")
      ]);

      const latencyMs = Date.now() - start;
      const reportedChainId = parseInt(chainIdHex, 16);
      const reportedBlockNumber = BigInt(blockNumberHex);

      const healthy = reportedChainId === this.chainId;
      const error = healthy
        ? undefined
        : `Chain ID mismatch: expected ${this.chainId}, got ${reportedChainId}`;

      return {
        healthy,
        latencyMs,
        blockNumber: reportedBlockNumber,
        chainId: reportedChainId,
        error
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - start;
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        healthy: false,
        latencyMs,
        error: errorMessage
      };
    }
  }

  async getBlockNumber(): Promise<bigint> {
    const hex = await this.rpcCall<string>("eth_blockNumber");
    return BigInt(hex);
  }

  async getBlockByNumber(
    blockNumber: bigint | "latest" | "earliest" | "pending",
    includeTransactions = false
  ): Promise<any> {
    const blockParam =
      typeof blockNumber === "bigint"
        ? `0x${blockNumber.toString(16)}`
        : blockNumber;
    return this.rpcCall<any>("eth_getBlockByNumber", [blockParam, includeTransactions]);
  }

  async getLogs(filter: {
    address?: `0x${string}` | `0x${string}`[];
    fromBlock?: bigint | string;
    toBlock?: bigint | string;
    topics?: (string | string[] | null)[];
  }): Promise<RawLog[]> {
    const formatBlock = (b?: bigint | string) => {
      if (b === undefined) return undefined;
      if (typeof b === "bigint") return `0x${b.toString(16)}`;
      return b;
    };

    const payload: Record<string, unknown> = {
      address: filter.address,
      fromBlock: formatBlock(filter.fromBlock),
      toBlock: formatBlock(filter.toBlock),
      topics: filter.topics
    };

    return this.rpcCall<RawLog[]>("eth_getLogs", [payload]);
  }

  async getTransactionReceipt(txHash: `0x${string}`): Promise<any> {
    return this.rpcCall<any>("eth_getTransactionReceipt", [txHash]);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
