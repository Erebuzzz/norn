import {
  type Address,
  type PublicClient,
  getAddress,
  parseAbi,
} from "viem";
import {
  ROBINHOOD_CHAIN_ID,
  CANONICAL_STOCK_TOKENS,
  isCanonicalStockTokenAddress,
  getCanonicalStockTokenByAddress,
} from "./config.js";

export type TradingStatus = "OPEN" | "CLOSED" | "HALTED" | "AFTER_HOURS";

export interface StockTokenInfo {
  symbol: string;
  address: Address;
  decimals: number;
  observedPriceUsd: bigint; // 1e6 fixed point ($100.50 = 100_500_000n)
  tradingStatus: TradingStatus;
  chainId: number;
  lastUpdatedTimestamp: number;
  isCanonical: boolean;
}

export class StalePriceError extends Error {
  constructor(
    public readonly tokenAddress: Address,
    public readonly priceTimestamp: number,
    public readonly currentTimestamp: number,
    public readonly maxStalenessSeconds: number
  ) {
    super(
      `Oracle price for token ${tokenAddress} is stale. Last updated: ${priceTimestamp}, current: ${currentTimestamp}, max allowed staleness: ${maxStalenessSeconds}s`
    );
    this.name = "StalePriceError";
  }
}

export class InvalidPriceError extends Error {
  constructor(
    public readonly tokenAddress: Address,
    public readonly priceUsd: bigint
  ) {
    super(`Invalid oracle price ${priceUsd} for token ${tokenAddress}. Price must be greater than zero.`);
    this.name = "InvalidPriceError";
  }
}

export class StockTokenNotFoundError extends Error {
  constructor(public readonly tokenAddress: Address) {
    super(`Stock token at ${tokenAddress} was not found and has no registered metadata or oracle.`);
    this.name = "StockTokenNotFoundError";
  }
}

export interface StockTokenReaderOptions {
  client?: PublicClient;
  chainId?: number;
  maxStalenessSeconds?: number;
  strictCanonical?: boolean;
  currentTimeProvider?: () => number;
}

const ERC20_METADATA_ABI = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function name() view returns (string)",
]);

const ORACLE_ABI = parseAbi([
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function getTradingStatus() view returns (uint8)",
]);

export class StockTokenReader {
  private readonly client?: PublicClient;
  private readonly chainId: number;
  private readonly maxStalenessSeconds: number;
  private readonly strictCanonical: boolean;
  private readonly getCurrentTime: () => number;

  private mockTokens: Map<string, StockTokenInfo> = new Map();

  constructor(options: StockTokenReaderOptions = {}) {
    this.client = options.client;
    this.chainId = options.chainId ?? ROBINHOOD_CHAIN_ID;
    this.maxStalenessSeconds = options.maxStalenessSeconds ?? 300;
    this.strictCanonical = options.strictCanonical ?? false;
    this.getCurrentTime =
      options.currentTimeProvider ?? (() => Math.floor(Date.now() / 1000));

    this.initializeDefaultCanonicalMocks();
  }

  private initializeDefaultCanonicalMocks(): void {
    const now = this.getCurrentTime();
    const defaults: Array<{
      symbol: string;
      priceUsd: bigint;
      status: TradingStatus;
    }> = [
      { symbol: "HOOD", priceUsd: 38_500_000n, status: "OPEN" },
      { symbol: "AAPL", priceUsd: 224_300_000n, status: "OPEN" },
      { symbol: "NVDA", priceUsd: 125_750_000n, status: "OPEN" },
      { symbol: "TSLA", priceUsd: 250_000_000n, status: "OPEN" },
      { symbol: "MSFT", priceUsd: 428_000_000n, status: "OPEN" },
    ];

    for (const item of defaults) {
      const canonical = CANONICAL_STOCK_TOKENS[item.symbol];
      if (canonical) {
        this.mockTokens.set(canonical.address.toLowerCase(), {
          symbol: canonical.symbol,
          address: canonical.address,
          decimals: canonical.decimals,
          observedPriceUsd: item.priceUsd,
          tradingStatus: item.status,
          chainId: this.chainId,
          lastUpdatedTimestamp: now,
          isCanonical: true,
        });
      }
    }
  }

  public setMockToken(
    tokenAddress: Address,
    data: Partial<StockTokenInfo> & { symbol: string }
  ): void {
    const normalized = tokenAddress.toLowerCase();
    const existing = this.mockTokens.get(normalized);
    const now = this.getCurrentTime();
    const isCanonical = isCanonicalStockTokenAddress(tokenAddress);

    this.mockTokens.set(normalized, {
      symbol: data.symbol,
      address: getAddress(tokenAddress),
      decimals: data.decimals ?? existing?.decimals ?? 18,
      observedPriceUsd: data.observedPriceUsd ?? existing?.observedPriceUsd ?? 100_000_000n,
      tradingStatus: data.tradingStatus ?? existing?.tradingStatus ?? "OPEN",
      chainId: data.chainId ?? this.chainId,
      lastUpdatedTimestamp: data.lastUpdatedTimestamp ?? existing?.lastUpdatedTimestamp ?? now,
      isCanonical: data.isCanonical ?? isCanonical,
    });
  }

  public updatePriceAndStatus(
    tokenAddress: Address,
    priceUsd: bigint,
    status: TradingStatus,
    timestamp?: number
  ): void {
    const normalized = tokenAddress.toLowerCase();
    const existing = this.mockTokens.get(normalized);
    const now = timestamp ?? this.getCurrentTime();

    if (existing) {
      existing.observedPriceUsd = priceUsd;
      existing.tradingStatus = status;
      existing.lastUpdatedTimestamp = now;
    } else {
      const canonical = getCanonicalStockTokenByAddress(tokenAddress);
      this.setMockToken(tokenAddress, {
        symbol: canonical?.symbol ?? "UNKNOWN",
        address: tokenAddress,
        decimals: canonical?.decimals ?? 18,
        observedPriceUsd: priceUsd,
        tradingStatus: status,
        lastUpdatedTimestamp: now,
      });
    }
  }

  public async readPrice(
    tokenAddress: Address
  ): Promise<{ priceUsd: bigint; timestamp: number }> {
    const normalized = tokenAddress.toLowerCase();
    const mock = this.mockTokens.get(normalized);

    let priceUsd: bigint;
    let updatedAt: number;

    if (mock) {
      priceUsd = mock.observedPriceUsd;
      updatedAt = mock.lastUpdatedTimestamp;
    } else if (this.client) {
      const canonical = getCanonicalStockTokenByAddress(tokenAddress);
      const oracleAddr = canonical?.oracleAddress;
      if (!oracleAddr) {
        throw new StockTokenNotFoundError(tokenAddress);
      }
      try {
        const roundData = await this.client.readContract({
          address: oracleAddr,
          abi: ORACLE_ABI,
          functionName: "latestRoundData",
        });
        const answer = roundData[1];
        updatedAt = Number(roundData[3]);
        priceUsd = BigInt(answer);
      } catch {
        throw new StockTokenNotFoundError(tokenAddress);
      }
    } else {
      throw new StockTokenNotFoundError(tokenAddress);
    }

    if (priceUsd <= 0n) {
      throw new InvalidPriceError(tokenAddress, priceUsd);
    }

    const now = this.getCurrentTime();
    if (now - updatedAt > this.maxStalenessSeconds) {
      throw new StalePriceError(
        tokenAddress,
        updatedAt,
        now,
        this.maxStalenessSeconds
      );
    }

    return { priceUsd, timestamp: updatedAt };
  }

  public async getTradingStatus(tokenAddress: Address): Promise<TradingStatus> {
    const normalized = tokenAddress.toLowerCase();
    const mock = this.mockTokens.get(normalized);
    if (mock) {
      return mock.tradingStatus;
    }

    if (this.client) {
      const canonical = getCanonicalStockTokenByAddress(tokenAddress);
      const oracleAddr = canonical?.oracleAddress;
      if (oracleAddr) {
        try {
          const statusCode = await this.client.readContract({
            address: oracleAddr,
            abi: ORACLE_ABI,
            functionName: "getTradingStatus",
          });
          switch (Number(statusCode)) {
            case 0:
              return "CLOSED";
            case 1:
              return "OPEN";
            case 2:
              return "AFTER_HOURS";
            case 3:
              return "HALTED";
            default:
              return "CLOSED";
          }
        } catch {
          // fall through to default
        }
      }
    }

    return "OPEN";
  }

  public async readTokenInfo(tokenAddress: Address): Promise<StockTokenInfo> {
    const normalized = tokenAddress.toLowerCase();
    const isCanonical = isCanonicalStockTokenAddress(tokenAddress);

    if (this.strictCanonical && !isCanonical) {
      throw new Error(
        `Security restriction: token ${tokenAddress} is not registered in the canonical stock token map.`
      );
    }

    const mock = this.mockTokens.get(normalized);
    const { priceUsd, timestamp } = await this.readPrice(tokenAddress);
    const status = await this.getTradingStatus(tokenAddress);

    if (mock) {
      return {
        ...mock,
        observedPriceUsd: priceUsd,
        tradingStatus: status,
        lastUpdatedTimestamp: timestamp,
        isCanonical,
      };
    }

    let symbol = "UNKNOWN";
    let decimals = 18;

    const canonical = getCanonicalStockTokenByAddress(tokenAddress);
    if (canonical) {
      symbol = canonical.symbol;
      decimals = canonical.decimals;
    } else if (this.client) {
      try {
        symbol = await this.client.readContract({
          address: tokenAddress,
          abi: ERC20_METADATA_ABI,
          functionName: "symbol",
        });
        decimals = Number(
          await this.client.readContract({
            address: tokenAddress,
            abi: ERC20_METADATA_ABI,
            functionName: "decimals",
          })
        );
      } catch {
        // use fallback defaults
      }
    }

    return {
      symbol,
      address: getAddress(tokenAddress),
      decimals,
      observedPriceUsd: priceUsd,
      tradingStatus: status,
      chainId: this.chainId,
      lastUpdatedTimestamp: timestamp,
      isCanonical,
    };
  }
}
