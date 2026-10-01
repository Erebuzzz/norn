import type { Address } from "viem";

export const WAD = 1_000_000_000_000_000_000n; // 1e18

export enum RiskRegime {
  NORMAL = 0,
  CONSTRAINED = 1,
  DEFENSIVE = 2,
  FROZEN = 3,
}

export interface CollateralValuationParams {
  marketValue: bigint;
  haircutBps?: number;         // e.g. 2000 = 20%
  liquidityFactorBps?: number; // e.g. 9000 = 90%
  stateFactorBps?: number;     // e.g. 10000 = 100% (open), 5000 = 50% (after hours), 0 = halted
}

export function calculateReserveRatioWad(deposited: bigint, reserved: bigint): bigint {
  if (deposited <= 0n) return 0n;
  if (reserved >= deposited) return 0n;
  const unencumbered = deposited - reserved;
  return (unencumbered * WAD) / deposited;
}

export function calculateShortfall(netDebit: bigint, availableLiquidity: bigint): bigint {
  if (netDebit <= availableLiquidity) return 0n;
  return netDebit - availableLiquidity;
}

export function determineRiskRegime(reserveRatioWad: bigint): RiskRegime {
  // Normal: >= 30% (0.3 WAD)
  if (reserveRatioWad >= (WAD * 30n) / 100n) {
    return RiskRegime.NORMAL;
  }
  // Constrained: >= 20% (0.2 WAD)
  if (reserveRatioWad >= (WAD * 20n) / 100n) {
    return RiskRegime.CONSTRAINED;
  }
  // Defensive: >= 10% (0.1 WAD)
  if (reserveRatioWad >= (WAD * 10n) / 100n) {
    return RiskRegime.DEFENSIVE;
  }
  // Frozen: < 10%
  return RiskRegime.FROZEN;
}

export function applyHaircut(amount: bigint, haircutBps: number): bigint {
  if (haircutBps >= 10000) return 0n;
  const multiplier = BigInt(10000 - haircutBps);
  return (amount * multiplier) / 10000n;
}

export function calculateEffectiveCollateral(params: CollateralValuationParams): bigint {
  const haircutBps = params.haircutBps ?? 2000;
  const liquidityBps = params.liquidityFactorBps ?? 9000;
  const stateBps = params.stateFactorBps ?? 10000;

  if (stateBps === 0) return 0n;

  const afterHaircut = applyHaircut(params.marketValue, haircutBps);
  const afterLiquidity = (afterHaircut * BigInt(liquidityBps)) / 10000n;
  const effective = (afterLiquidity * BigInt(stateBps)) / 10000n;

  return effective;
}

export function verifyConservation(credits: bigint[], debits: bigint[]): boolean {
  const totalCredits = credits.reduce((acc, val) => acc + val, 0n);
  const totalDebits = debits.reduce((acc, val) => acc + val, 0n);
  return totalCredits === totalDebits;
}

export interface PostSettlementCheckResult {
  valid: boolean;
  participant: Address;
  currentBalance: bigint;
  netDebit: bigint;
  postSettlementBalance: bigint;
  postSettlementRatioWad: bigint;
  shortfall: bigint;
}

export function validatePostSettlementReserve(
  participant: Address,
  currentBalance: bigint,
  netDebit: bigint,
  requiredRatioWad: bigint
): PostSettlementCheckResult {
  if (netDebit > currentBalance) {
    return {
      valid: false,
      participant,
      currentBalance,
      netDebit,
      postSettlementBalance: 0n,
      postSettlementRatioWad: 0n,
      shortfall: netDebit - currentBalance,
    };
  }

  const postBalance = currentBalance - netDebit;
  const postRatio = calculateReserveRatioWad(currentBalance, netDebit);

  if (postRatio < requiredRatioWad) {
    // Required minimum unencumbered liquidity is: (currentBalance * requiredRatioWad) / WAD
    // Permissible net debit is currentBalance - requiredUnencumbered
    const requiredUnencumbered = (currentBalance * requiredRatioWad) / WAD;
    const maxDebit = currentBalance > requiredUnencumbered ? currentBalance - requiredUnencumbered : 0n;
    const shortfall = netDebit > maxDebit ? netDebit - maxDebit : 0n;

    return {
      valid: false,
      participant,
      currentBalance,
      netDebit,
      postSettlementBalance: postBalance,
      postSettlementRatioWad: postRatio,
      shortfall,
    };
  }

  return {
    valid: true,
    participant,
    currentBalance,
    netDebit,
    postSettlementBalance: postBalance,
    postSettlementRatioWad: postRatio,
    shortfall: 0n,
  };
}
