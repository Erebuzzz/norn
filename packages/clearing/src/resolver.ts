import {
  Obligation,
  ObligationPriority,
  Participant,
  LiquidityState,
  RiskRegime,
  ResolutionResult,
  LiquidityShortfall,
  Address,
  SettlementTransfer,
} from "./types.js";
import {
  computeParticipantNetBalances,
  verifyConservationInvariant,
  formulateSettlementTransfers,
} from "./multilateral.js";

export interface ParticipantLiquidityProfile {
  availableLiquidity: bigint;
  totalLiquidity?: bigint;
  reservedLiquidity?: bigint;
  requiredReserve?: bigint;
}

export type LiquidityLookup =
  | Map<string, ParticipantLiquidityProfile>
  | ((participant: Address, asset: Address) => ParticipantLiquidityProfile | undefined);

export interface ResolverOptions {
  regime?: RiskRegime | number;
  reserveRatioBps?: number;
  rejectUnsafeBatches?: boolean;
}

export const REGIME_RESERVE_RATIOS: Record<RiskRegime, number> = {
  [RiskRegime.NORMAL]: 1000,
  [RiskRegime.CONSTRAINED]: 2500,
  [RiskRegime.DEFENSIVE]: 5000,
  [RiskRegime.FROZEN]: 10000,
};

export class LiquidityBreachError extends Error {
  public readonly shortfalls: LiquidityShortfall[];

  constructor(shortfalls: LiquidityShortfall[]) {
    const details = shortfalls
      .map(
        (s) =>
          `Participant ${s.participant} asset ${s.asset}: debit ${s.debitAmount} exceeds available ${s.availableLiquidity} with reserve ${s.requiredReserve}, shortfall = ${s.shortfall}`
      )
      .join("; ");
    super(`Liquidity constraint violation: ${details}`);
    this.name = "LiquidityBreachError";
    this.shortfalls = shortfalls;
  }
}

function resolveLiquidity(
  participant: Address,
  asset: Address,
  source?: LiquidityLookup
): ParticipantLiquidityProfile {
  if (!source) {
    return { availableLiquidity: 0n, requiredReserve: 0n };
  }
  if (typeof source === "function") {
    return (
      source(participant, asset) ?? {
        availableLiquidity: 0n,
        requiredReserve: 0n,
      }
    );
  }
  const key = `${asset.toLowerCase()}:${participant.toLowerCase()}`;
  return (
    source.get(key) ?? {
      availableLiquidity: 0n,
      requiredReserve: 0n,
    }
  );
}

function isPriorityPermitted(
  priority: ObligationPriority | number,
  regime: RiskRegime | number
): boolean {
  if (regime === RiskRegime.FROZEN) {
    return false;
  }
  if (regime === RiskRegime.DEFENSIVE) {
    return Number(priority) === ObligationPriority.CRITICAL;
  }
  if (regime === RiskRegime.CONSTRAINED) {
    return Number(priority) <= ObligationPriority.HIGH;
  }
  return true;
}

export function computeLiquidityShortfalls(
  candidateObligations: Obligation[],
  liquidityLookup: LiquidityLookup,
  regime: RiskRegime = RiskRegime.NORMAL,
  customReserveRatioBps?: number
): LiquidityShortfall[] {
  const balanceMap = computeParticipantNetBalances(candidateObligations);
  const shortfalls: LiquidityShortfall[] = [];

  const ratioBps =
    customReserveRatioBps ?? REGIME_RESERVE_RATIOS[regime] ?? 1000;

  for (const entry of balanceMap.values()) {
    if (entry.netBalance < 0n) {
      const debitAmount = -entry.netBalance;
      const profile = resolveLiquidity(
        entry.participant,
        entry.asset,
        liquidityLookup
      );

      const available = profile.availableLiquidity;
      let reqReserve = profile.requiredReserve ?? 0n;

      if (profile.totalLiquidity && profile.totalLiquidity > 0n && reqReserve === 0n) {
        reqReserve = (profile.totalLiquidity * BigInt(ratioBps)) / 10000n;
      }

      if (debitAmount > available) {
        const shortfall = reqReserve + (debitAmount - available);
        shortfalls.push({
          participant: entry.participant,
          asset: entry.asset,
          availableLiquidity: available,
          debitAmount,
          requiredReserve: reqReserve,
          shortfall,
        });
      } else {
        const postLiquidity = available - debitAmount;
        if (postLiquidity < reqReserve) {
          const shortfall = reqReserve - postLiquidity;
          shortfalls.push({
            participant: entry.participant,
            asset: entry.asset,
            availableLiquidity: available,
            debitAmount,
            requiredReserve: reqReserve,
            shortfall,
          });
        }
      }
    }
  }

  return shortfalls;
}

export function resolveClearingBatch(
  candidateObligations: Obligation[],
  liquidityLookup: LiquidityLookup,
  options: ResolverOptions = {}
): ResolutionResult {
  const regime = options.regime ?? RiskRegime.NORMAL;

  if (regime === RiskRegime.FROZEN) {
    return {
      acceptedObligations: [],
      deferredObligations: [...candidateObligations],
      rejectedObligations: [],
      settlementTransfers: [],
      netBalances: [],
      shortfalls: [],
      isSafe: true,
      conservationDelta: 0n,
    };
  }

  const sortedCandidates = [...candidateObligations].sort((a, b) => {
    if (Number(a.priority) !== Number(b.priority)) {
      return Number(a.priority) - Number(b.priority);
    }
    if (a.expiresAt !== b.expiresAt) {
      return a.expiresAt - b.expiresAt;
    }
    return Number(a.nonce - b.nonce);
  });

  const regimePermitted: Obligation[] = [];
  const deferredDueToRegime: Obligation[] = [];

  for (const ob of sortedCandidates) {
    if (isPriorityPermitted(ob.priority, regime)) {
      regimePermitted.push(ob);
    } else {
      deferredDueToRegime.push(ob);
    }
  }

  const accepted: Obligation[] = [];
  const deferredDueToLiquidity: Obligation[] = [];
  let criticalShortfalls: LiquidityShortfall[] = [];

  for (const candidate of regimePermitted) {
    const trialSet = [...accepted, candidate];
    const shortfalls = computeLiquidityShortfalls(
      trialSet,
      liquidityLookup,
      regime,
      options.reserveRatioBps
    );

    if (shortfalls.length === 0) {
      accepted.push(candidate);
    } else {
      const isCriticalOrHigh =
        Number(candidate.priority) <= ObligationPriority.HIGH;

      if (isCriticalOrHigh) {
        criticalShortfalls = shortfalls;
      }

      deferredDueToLiquidity.push(candidate);
    }
  }

  const deferredObligations = [
    ...deferredDueToRegime,
    ...deferredDueToLiquidity,
  ];

  const finalShortfalls = computeLiquidityShortfalls(
    accepted,
    liquidityLookup,
    regime,
    options.reserveRatioBps
  );

  const balanceMap = computeParticipantNetBalances(accepted);
  const netBalances = Array.from(balanceMap.values());
  const delta =
    accepted.length > 0 ? verifyConservationInvariant(netBalances) : 0n;
  const settlementTransfers = formulateSettlementTransfers(netBalances, accepted);

  const isSafe = finalShortfalls.length === 0 && criticalShortfalls.length === 0;

  if (!isSafe && options.rejectUnsafeBatches) {
    const reportedShortfalls =
      finalShortfalls.length > 0 ? finalShortfalls : criticalShortfalls;
    throw new LiquidityBreachError(reportedShortfalls);
  }

  return {
    acceptedObligations: accepted,
    deferredObligations,
    rejectedObligations: [],
    settlementTransfers,
    netBalances,
    shortfalls: finalShortfalls.length > 0 ? finalShortfalls : criticalShortfalls,
    isSafe,
    conservationDelta: delta,
  };
}
