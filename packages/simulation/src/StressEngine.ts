import { type Agent, type Obligation, ObligationPriority, type SimulationModeResult, type StressEngineResult, type Address } from "./types.js";
import { BaselineSimulator } from "./BaselineSimulator.js";

export interface StressEngineOptions {
  shockPercentage?: number; // default 40%
  constrainedReserveRatioBps?: number; // default 2500 (25%) per RiskController.sol
}

export class StressEngine {
  private shockPercentage: number;
  private constrainedReserveRatioBps: number;
  private simulator: BaselineSimulator;

  constructor(options: StressEngineOptions = {}) {
    this.shockPercentage = options.shockPercentage ?? 40;
    this.constrainedReserveRatioBps = options.constrainedReserveRatioBps ?? 2500;
    this.simulator = new BaselineSimulator();
  }

  runLiquidityShockScenario(
    agents: Agent[],
    obligations: Obligation[]
  ): StressEngineResult {
    // 1. Compute baseline Mode C multilateral clearing plan in NORMAL regime (10% reserve)
    const initialBatch = this.simulator.simulateModeC(obligations);

    // 2. Clone agent states to apply shock
    const shockedAgents = new Map<Address, {
      total: bigint;
      available: bigint;
      reserved: bigint;
      role: string;
      tier: number;
    }>();

    for (const a of agents) {
      // 40% liquidity shock: available liquidity decreases by 40%
      const shockFactor = BigInt(100 - this.shockPercentage);
      const shockedLiquidity = (a.currentLiquidity * shockFactor) / 100n;
      shockedAgents.set(a.id, {
        total: shockedLiquidity,
        available: shockedLiquidity,
        reserved: a.reservedLiquidity,
        role: a.role,
        tier: a.riskProfile.criticalityTier,
      });
    }

    // 3. Test initial batch under CONSTRAINED regime (25% required reserve ratio)
    // Compute net debits per participant from the initial batch transfers
    const initialDebits = new Map<Address, bigint>();
    for (const transfer of initialBatch.transfers) {
      const current = initialDebits.get(transfer.payer) ?? 0n;
      initialDebits.set(transfer.payer, current + transfer.amount);
    }

    const breachingAgents: {
      agentId: Address;
      availableLiquidity: bigint;
      netDebit: bigint;
      requiredReserve: bigint;
      shortfall: bigint;
    }[] = [];

    for (const [payerId, debit] of initialDebits.entries()) {
      const state = shockedAgents.get(payerId);
      if (!state) continue;

      const requiredReserve = (state.total * BigInt(this.constrainedReserveRatioBps)) / 10000n;

      if (debit > state.available) {
        breachingAgents.push({
          agentId: payerId,
          availableLiquidity: state.available,
          netDebit: debit,
          requiredReserve,
          shortfall: debit - state.available + requiredReserve,
        });
      } else {
        const postLiquidity = state.available - debit;
        if (postLiquidity < requiredReserve) {
          const shortfall = requiredReserve - postLiquidity;
          breachingAgents.push({
            agentId: payerId,
            availableLiquidity: state.available,
            netDebit: debit,
            requiredReserve,
            shortfall,
          });
        }
      }
    }

    const isValid = breachingAgents.length === 0;
    const invalidationReason = isValid
      ? undefined
      : `PostSettlementReserveBreach: ${breachingAgents.length} agents breached the 2500 bps reserve threshold after 40% liquidity shock`;

    // 4. Recompute the recovered plan under CONSTRAINED regime (25% reserve)
    // First, filter by priority rule: only CRITICAL (0) and HIGH (1) are eligible.
    let candidateObligations = obligations.filter(
      (ob) => ob.priority === ObligationPriority.CRITICAL || ob.priority === ObligationPriority.HIGH
    );

    let recoveredBatch = this.simulator.simulateModeC(candidateObligations);
    let iterations = 0;
    const maxIterations = 200;

    // Prune obligations of breaching agents until all post-settlement reserves are preserved
    while (iterations < maxIterations && candidateObligations.length > 0) {
      iterations++;
      const currentDebits = new Map<Address, bigint>();
      for (const t of recoveredBatch.transfers) {
        const cur = currentDebits.get(t.payer) ?? 0n;
        currentDebits.set(t.payer, cur + t.amount);
      }

      let breachingPayer: Address | null = null;
      for (const [payerId, debit] of currentDebits.entries()) {
        const state = shockedAgents.get(payerId);
        if (!state) continue;

        const requiredReserve = (state.total * BigInt(this.constrainedReserveRatioBps)) / 10000n;
        if (debit > state.available || state.available - debit < requiredReserve) {
          breachingPayer = payerId;
          break;
        }
      }

      if (!breachingPayer) {
        // Solvency achieved for all participants
        break;
      }

      const payerObs = candidateObligations.filter(
        (ob) => ob.payer.toLowerCase() === breachingPayer!.toLowerCase()
      );
      if (payerObs.length === 0) break;

      // Defer the largest obligation for the breaching payer
      const toDefer = payerObs.sort((a, b) => Number(b.amount - a.amount))[0];
      candidateObligations = candidateObligations.filter((ob) => ob.id !== toDefer.id);
      recoveredBatch = this.simulator.simulateModeC(candidateObligations);
    }

    // Verify all reserves in the recovered plan
    const finalDebits = new Map<Address, bigint>();
    for (const t of recoveredBatch.transfers) {
      const cur = finalDebits.get(t.payer) ?? 0n;
      finalDebits.set(t.payer, cur + t.amount);
    }

    let allReservesSatisfied = true;
    for (const [payerId, debit] of finalDebits.entries()) {
      const state = shockedAgents.get(payerId);
      if (!state) continue;

      const requiredReserve = (state.total * BigInt(this.constrainedReserveRatioBps)) / 10000n;
      if (debit > state.available || state.available - debit < requiredReserve) {
        allReservesSatisfied = false;
        break;
      }
    }

    return {
      initialBatch,
      shockApplied: {
        liquidityReductionPercent: this.shockPercentage,
        previousRegime: "NORMAL",
        newRegime: "CONSTRAINED",
        reserveRatioBps: this.constrainedReserveRatioBps,
      },
      isValid,
      invalidationReason,
      breachingAgents,
      recoveredPlan: {
        settlementTransfers: recoveredBatch.transfers,
        transferCount: recoveredBatch.transferCount,
        settlementVolume: recoveredBatch.settlementVolume,
        clearedObligationCount: candidateObligations.length,
        deferredObligationCount: obligations.length - candidateObligations.length,
        allReservesSatisfied,
      },
    };
  }
}
