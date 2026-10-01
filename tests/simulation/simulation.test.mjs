import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  AgentGenerator,
  ObligationGenerator,
  BaselineSimulator,
  StressEngine,
  Benchmark,
  ObligationPriority,
} from "../../packages/simulation/dist/index.js";

describe("NORN Simulation Suite", () => {
  test("AgentGenerator: generates 1,000 deterministic agent identities with liquidity balances and risk profiles", () => {
    const generator1 = new AgentGenerator({ seed: 42 });
    const agents1 = generator1.generateAgents(1000);

    assert.equal(agents1.length, 1000);

    // Verify deterministic generation with identical seed
    const generator2 = new AgentGenerator({ seed: 42 });
    const agents2 = generator2.generateAgents(1000);

    assert.equal(agents2.length, 1000);
    assert.deepEqual(agents1[0], agents2[0]);
    assert.deepEqual(agents1[500], agents2[500]);
    assert.deepEqual(agents1[999], agents2[999]);

    // Verify different seed produces different agents
    const generator3 = new AgentGenerator({ seed: 999 });
    const agents3 = generator3.generateAgents(1000);
    assert.notEqual(agents1[0].id, agents3[0].id);

    // Verify role distribution and risk profiles
    const treasuries = agents1.filter((a) => a.role === "treasury");
    const marketMakers = agents1.filter((a) => a.role === "market_maker" || a.role === "arbitrageur");
    const providers = agents1.filter((a) => a.role === "service_provider");
    const consumers = agents1.filter((a) => a.role === "consumer");

    assert.equal(treasuries.length, 50);
    assert.equal(marketMakers.length, 150);
    assert.equal(providers.length, 200);
    assert.equal(consumers.length, 600);

    for (const agent of agents1) {
      assert.match(agent.id, /^0x[0-9a-fA-F]{40}$/);
      assert.ok(agent.initialLiquidity > 0n);
      assert.equal(agent.currentLiquidity, agent.initialLiquidity);
      assert.equal(agent.reservedLiquidity, 0n);
      assert.ok(agent.creditLimit > 0n);
      assert.equal(agent.riskProfile.status, "ACTIVE");
      assert.equal(agent.riskProfile.reserveRatioBps, 1000);
      assert.ok(agent.riskProfile.maxNetDebit > 0n);
    }

    // Verify high-capacity treasuries hold significantly higher liquidity than consumers
    assert.ok(treasuries[0].initialLiquidity > consumers[0].initialLiquidity * 100n);
  });

  test("ObligationGenerator: generates 10,000+ realistic obligations across agents and services", () => {
    const agentGen = new AgentGenerator({ seed: 42 });
    const agents = agentGen.generateAgents(1000);

    const obligationGen1 = new ObligationGenerator({ seed: 1337 });
    const obligations1 = obligationGen1.generateObligations(agents, 10000);

    assert.equal(obligations1.length, 10000);

    // Verify deterministic reproducibility
    const obligationGen2 = new ObligationGenerator({ seed: 1337 });
    const obligations2 = obligationGen2.generateObligations(agents, 10000);

    assert.equal(obligations1[0].id, obligations2[0].id);
    assert.equal(obligations1[5000].id, obligations2[5000].id);
    assert.equal(obligations1[9999].id, obligations2[9999].id);

    // Verify obligation properties
    const priorityCounts = new Map();
    let totalVolume = 0n;

    for (const ob of obligations1) {
      assert.match(ob.id, /^0x[0-9a-fA-F]{64}$/);
      assert.match(ob.payer, /^0x[0-9a-fA-F]{40}$/);
      assert.match(ob.payee, /^0x[0-9a-fA-F]{40}$/);
      assert.notEqual(ob.payer.toLowerCase(), ob.payee.toLowerCase());
      assert.ok(ob.amount > 0n);
      assert.ok(ob.nonce > 0n);
      assert.ok(ob.expiresAt > ob.createdAt);
      assert.equal(ob.status, "CREATED");

      totalVolume += ob.amount;
      priorityCounts.set(ob.priority, (priorityCounts.get(ob.priority) ?? 0) + 1);
    }

    assert.ok(totalVolume > 0n);
    assert.ok(priorityCounts.get(ObligationPriority.CRITICAL) > 0);
    assert.ok(priorityCounts.get(ObligationPriority.HIGH) > 0);
    assert.ok(priorityCounts.get(ObligationPriority.NORMAL) > 0);
    assert.ok(priorityCounts.get(ObligationPriority.NETTABLE) > 0);
  });

  test("BaselineSimulator: computes 3 comparison modes for the exact same obligation set", () => {
    const agentGen = new AgentGenerator({ seed: 42 });
    const agents = agentGen.generateAgents(1000);

    const obligationGen = new ObligationGenerator({ seed: 1337 });
    const obligations = obligationGen.generateObligations(agents, 10000);

    const simulator = new BaselineSimulator({ agents });
    const { modeA, modeB, modeC } = simulator.simulateAll(obligations);

    // Mode A (Immediate Settlement)
    assert.equal(modeA.mode, "A");
    assert.equal(modeA.transferCount, 10000);
    assert.ok(modeA.settlementVolume > 0n);
    assert.equal(modeA.settlementVolume, modeA.grossObligationVolume);
    assert.ok(modeA.peakLiquidityRequired > 0n);

    // Mode B (Bilateral Batching)
    assert.equal(modeB.mode, "B");
    assert.ok(modeB.transferCount < modeA.transferCount);
    assert.ok(modeB.settlementVolume <= modeA.settlementVolume);
    assert.ok(modeB.peakLiquidityRequired <= modeA.peakLiquidityRequired);

    // Mode C (NORN Multilateral Clearing)
    assert.equal(modeC.mode, "C");
    // Maximum compression: transfers are far fewer than bilateral and immediate
    assert.ok(modeC.transferCount < modeB.transferCount);
    assert.ok(modeC.transferCount < modeA.transferCount);

    // Lowest peak liquidity demand
    assert.ok(modeC.peakLiquidityRequired <= modeB.peakLiquidityRequired);
    assert.ok(modeC.peakLiquidityRequired < modeA.peakLiquidityRequired);

    // Net settlement volume is strictly lower than gross volume
    assert.ok(modeC.settlementVolume < modeA.settlementVolume);
  });

  test("StressEngine: injects 40% Liquidity Shock, transitions to CONSTRAINED, detects breach, and recomputes recovered plan", () => {
    const agentGen = new AgentGenerator({ seed: 42 });
    const agents = agentGen.generateAgents(1000);

    const obligationGen = new ObligationGenerator({ seed: 1337 });
    const obligations = obligationGen.generateObligations(agents, 10000);

    const stressEngine = new StressEngine({
      shockPercentage: 40,
      constrainedReserveRatioBps: 2500,
    });

    const result = stressEngine.runLiquidityShockScenario(agents, obligations);

    // Shock applied verification
    assert.equal(result.shockApplied.liquidityReductionPercent, 40);
    assert.equal(result.shockApplied.previousRegime, "NORMAL");
    assert.equal(result.shockApplied.newRegime, "CONSTRAINED");
    assert.equal(result.shockApplied.reserveRatioBps, 2500);

    // Batch invalidation demonstration
    assert.equal(result.isValid, false);
    assert.ok(result.breachingAgents.length > 0);
    assert.ok(result.invalidationReason.includes("PostSettlementReserveBreach"));

    for (const breach of result.breachingAgents) {
      assert.ok(breach.shortfall > 0n);
      assert.ok(breach.requiredReserve > 0n);
    }

    // Recovered plan recomputation
    const recovered = result.recoveredPlan;
    assert.ok(recovered.transferCount > 0);
    assert.ok(recovered.clearedObligationCount > 0);
    assert.ok(recovered.deferredObligationCount > 0);
    assert.equal(
      recovered.clearedObligationCount + recovered.deferredObligationCount,
      obligations.length
    );

    // Solvency invariant restored for all participating agents
    assert.equal(recovered.allReservesSatisfied, true);
  });

  test("Benchmark: computes TransferCompression, LiquidityReduction, and GrossToNetRatio", () => {
    const agentGen = new AgentGenerator({ seed: 42 });
    const agents = agentGen.generateAgents(1000);

    const obligationGen = new ObligationGenerator({ seed: 1337 });
    const obligations = obligationGen.generateObligations(agents, 10000);

    const simulator = new BaselineSimulator({ agents });
    const { modeA, modeB, modeC } = simulator.simulateAll(obligations);

    const metrics = Benchmark.compute(modeA, modeB, modeC);

    // Assert primary metric ranges
    assert.ok(metrics.transferCompression > 0.85, `TransferCompression was ${metrics.transferCompression}`);
    assert.ok(metrics.liquidityReduction > 0.50, `LiquidityReduction was ${metrics.liquidityReduction}`);
    assert.ok(metrics.grossToNetRatio > 2.0, `GrossToNetRatio was ${metrics.grossToNetRatio}`);
    assert.ok(metrics.bilateralTransferCompression > 0.10, `Bilateral was ${metrics.bilateralTransferCompression}`);

    // Verify benchmark report formatting
    const report = Benchmark.formatReport(metrics);
    assert.ok(report.includes("NORN EFFICIENCY BENCHMARK"));
    assert.ok(report.includes("Mode A (Immediate RTGS):"));
    assert.ok(report.includes("Mode B (Bilateral Batch):"));
    assert.ok(report.includes("Mode C (NORN Multilateral):"));
    assert.ok(report.includes("Transfer Compression:"));
    assert.ok(report.includes("Liquidity Reduction:"));
    assert.ok(report.includes("Gross-to-Net Ratio:"));
  });
});
