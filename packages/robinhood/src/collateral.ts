import type { TradingStatus } from "./stock-tokens.js";

export interface CollateralRiskParameters {
  haircutMultiplierBps: bigint; // e.g. 8000n = 0.80 multiplier (20% haircut)
  liquidityFactorBps: bigint; // e.g. 9000n = 0.90 multiplier
  stateFactorsBps: Record<TradingStatus, bigint>; // OPEN: 10000n, AFTER_HOURS: 5000n, HALTED: 0n, CLOSED: 0n
  maxSettlementCapacityUsd: bigint; // maximum dollar cap in 1e6 fixed point
}

export const DEFAULT_COLLATERAL_ASSUMPTIONS: CollateralRiskParameters = {
  haircutMultiplierBps: 8_000n, // 80.00% multiplier (20% haircut)
  liquidityFactorBps: 9_000n, // 90.00% multiplier
  stateFactorsBps: {
    OPEN: 10_000n, // 100.00% multiplier (1.0)
    AFTER_HOURS: 5_000n, // 50.00% multiplier (0.5)
    HALTED: 0n, // 0.00% multiplier (0.0)
    CLOSED: 0n, // 0.00% multiplier (0.0)
  },
  maxSettlementCapacityUsd: 100_000_000_000n, // $100,000.00 max capacity cap per position
};

export interface CollateralCalculationParams {
  marketValueUsd: bigint; // 1e6 fixed point ($10,000 = 10_000_000_000n)
  tradingStatus: TradingStatus;
  customParameters?: Partial<CollateralRiskParameters>;
}

export interface TokenCollateralParams {
  tokenAmount: bigint; // In token base units (e.g. 18 decimals)
  tokenDecimals: number; // e.g. 18
  priceUsd: bigint; // 1e6 fixed point
  tradingStatus: TradingStatus;
  customParameters?: Partial<CollateralRiskParameters>;
}

export interface CollateralCalculationResult {
  marketValueUsd: bigint;
  effectiveCollateralUsd: bigint;
  haircutMultiplier: number;
  liquidityFactor: number;
  stateFactor: number;
  tradingStatus: TradingStatus;
  isCapped: boolean;
  settlementCapacityCapUsd: bigint;
  breakdown: {
    haircutDiscountUsd: bigint;
    postHaircutValueUsd: bigint;
    postLiquidityValueUsd: bigint;
    stateFactorAppliedUsd: bigint;
  };
}

export function calculateEffectiveCollateral(
  params: CollateralCalculationParams
): CollateralCalculationResult {
  const { marketValueUsd, tradingStatus, customParameters } = params;

  if (marketValueUsd < 0n) {
    throw new Error("Market value cannot be negative for collateral evaluation.");
  }

  const haircutBps =
    customParameters?.haircutMultiplierBps ??
    DEFAULT_COLLATERAL_ASSUMPTIONS.haircutMultiplierBps;
  const liquidityBps =
    customParameters?.liquidityFactorBps ??
    DEFAULT_COLLATERAL_ASSUMPTIONS.liquidityFactorBps;
  const stateFactors = {
    ...DEFAULT_COLLATERAL_ASSUMPTIONS.stateFactorsBps,
    ...(customParameters?.stateFactorsBps ?? {}),
  };
  const stateBps = stateFactors[tradingStatus] ?? 0n;
  const cap =
    customParameters?.maxSettlementCapacityUsd ??
    DEFAULT_COLLATERAL_ASSUMPTIONS.maxSettlementCapacityUsd;

  // Immediate fail-safe: HALTED or CLOSED markets yield zero collateral
  if (tradingStatus === "HALTED" || tradingStatus === "CLOSED" || stateBps === 0n) {
    return {
      marketValueUsd,
      effectiveCollateralUsd: 0n,
      haircutMultiplier: Number(haircutBps) / 10_000,
      liquidityFactor: Number(liquidityBps) / 10_000,
      stateFactor: 0,
      tradingStatus,
      isCapped: false,
      settlementCapacityCapUsd: cap,
      breakdown: {
        haircutDiscountUsd: 0n,
        postHaircutValueUsd: 0n,
        postLiquidityValueUsd: 0n,
        stateFactorAppliedUsd: 0n,
      },
    };
  }

  // Section 18 Formula:
  // EffectiveCollateral = MarketValue * Haircut * LiquidityFactor * StateFactor
  const postHaircutValueUsd = (marketValueUsd * haircutBps) / 10_000n;
  const haircutDiscountUsd = marketValueUsd - postHaircutValueUsd;
  const postLiquidityValueUsd = (postHaircutValueUsd * liquidityBps) / 10_000n;
  const stateFactorAppliedUsd = (postLiquidityValueUsd * stateBps) / 10_000n;

  // Enforce bounded risk:
  // 1. Never exceeds market value
  let boundedValue = stateFactorAppliedUsd > marketValueUsd ? marketValueUsd : stateFactorAppliedUsd;

  // 2. Explicit cap on settlement capacity
  let isCapped = false;
  if (boundedValue > cap) {
    boundedValue = cap;
    isCapped = true;
  }

  return {
    marketValueUsd,
    effectiveCollateralUsd: boundedValue,
    haircutMultiplier: Number(haircutBps) / 10_000,
    liquidityFactor: Number(liquidityBps) / 10_000,
    stateFactor: Number(stateBps) / 10_000,
    tradingStatus,
    isCapped,
    settlementCapacityCapUsd: cap,
    breakdown: {
      haircutDiscountUsd,
      postHaircutValueUsd,
      postLiquidityValueUsd,
      stateFactorAppliedUsd,
    },
  };
}

export function calculateCollateralFromToken(
  params: TokenCollateralParams
): CollateralCalculationResult {
  const { tokenAmount, tokenDecimals, priceUsd, tradingStatus, customParameters } = params;

  if (priceUsd <= 0n) {
    throw new Error("Asset price must be positive to calculate collateral.");
  }
  if (tokenAmount < 0n) {
    throw new Error("Token amount cannot be negative.");
  }

  const divisor = 10n ** BigInt(tokenDecimals);
  const marketValueUsd = (tokenAmount * priceUsd) / divisor;

  return calculateEffectiveCollateral({
    marketValueUsd,
    tradingStatus,
    customParameters,
  });
}
