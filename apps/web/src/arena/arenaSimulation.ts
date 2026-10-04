import type { LoomKnot, LoomThread } from "@norn/ui";
import type { RegimeType } from "@norn/ui";
import type { SettlementAuditRecord } from "@norn/ui";

export interface ArenaState {
  epoch: number;
  blockHeight: number;
  regime: RegimeType;
  isRunning: boolean;
  isShockActive: boolean;
  isFreezeActive: boolean;
  isSpikeActive: boolean;
  unweaveProgress: number;

  grossFlow: number;
  netFlow: number;
  grossObligationsCount: number;
  netTransfersCount: number;
  availableLiquidity: number;
  requiredLiquidity: number;
  liquidityShortfall: number;

  batchId: string;
  batchStatus: "SETTLED" | "REJECTED" | "RECOMPUTED";
  batchMessage: string;

  knots: LoomKnot[];
  rawThreads: LoomThread[];
  netThreads: LoomThread[];
  auditTrail: SettlementAuditRecord[];
}

export function createInitialArenaState(): ArenaState {
  const knots: LoomKnot[] = [
    {
      id: "agent-alpha",
      label: "AGENT-ALPHA",
      role: "LLM Inference Hub",
      x: 180,
      y: 140,
      radius: 20,
      balance: 420000,
      netPosition: -180000,
      status: "healthy",
    },
    {
      id: "agent-beta",
      label: "AGENT-BETA",
      role: "Search & Web Scraper",
      x: 620,
      y: 130,
      radius: 18,
      balance: 310000,
      netPosition: 95000,
      status: "healthy",
    },
    {
      id: "agent-gamma",
      label: "AGENT-GAMMA",
      role: "GPU Cluster Node",
      x: 680,
      y: 350,
      radius: 22,
      balance: 650000,
      netPosition: 285000,
      status: "healthy",
    },
    {
      id: "agent-delta",
      label: "AGENT-DELTA",
      role: "Data Indexer",
      x: 160,
      y: 360,
      radius: 18,
      balance: 290000,
      netPosition: -200000,
      status: "healthy",
    },
    {
      id: "treasury",
      label: "TREASURY-VAULT",
      role: "Robinhood USDG Reserve",
      x: 400,
      y: 240,
      radius: 26,
      balance: 1100000,
      netPosition: 0,
      status: "healthy",
    },
  ];

  const rawThreads: LoomThread[] = [
    { id: "t1", fromId: "agent-alpha", toId: "agent-beta", amount: 480000, isNetSettlement: false, priority: "normal", curvature: 30 },
    { id: "t2", fromId: "agent-beta", toId: "agent-gamma", amount: 520000, isNetSettlement: false, priority: "critical", curvature: -25 },
    { id: "t3", fromId: "agent-gamma", toId: "agent-alpha", amount: 390000, isNetSettlement: false, priority: "normal", curvature: 35 },
    { id: "t4", fromId: "agent-alpha", toId: "agent-delta", amount: 610000, isNetSettlement: false, priority: "critical", curvature: -20 },
    { id: "t5", fromId: "agent-delta", toId: "agent-gamma", amount: 420000, isNetSettlement: false, priority: "normal", curvature: 28 },
    { id: "t6", fromId: "agent-beta", toId: "agent-delta", amount: 310000, isNetSettlement: false, priority: "low", curvature: -32 },
    { id: "t7", fromId: "agent-gamma", toId: "treasury", amount: 250000, isNetSettlement: false, priority: "critical", curvature: 18 },
    { id: "t8", fromId: "treasury", toId: "agent-alpha", amount: 440000, isNetSettlement: false, priority: "normal", curvature: -22 },
  ];

  const netThreads: LoomThread[] = [
    { id: "net-1", fromId: "agent-alpha", toId: "agent-gamma", amount: 180000, isNetSettlement: true, priority: "critical" },
    { id: "net-2", fromId: "agent-delta", toId: "agent-gamma", amount: 200000, isNetSettlement: true, priority: "critical" },
    { id: "net-3", fromId: "agent-delta", toId: "agent-beta", amount: 330000, isNetSettlement: true, priority: "normal" },
  ];

  const initialAudit: SettlementAuditRecord[] = [
    {
      id: "BATCH-103",
      epoch: 103,
      timestamp: "2026-10-01 12:00:00 UTC",
      from: "Clearing Network",
      to: "3 Net Creditors",
      grossAmount: "$3,420,000.00 USDG",
      netAmount: "$710,000.00 USDG",
      obligationsCount: 12842,
      liquidityCheck: "PASS",
      regime: "NORMAL",
      txHash: "0x8fa1c940b5d9e71239841fce98a723e49812bc780192ea38914b1239fca84901",
      status: "SETTLED",
      note: "Standard multilateral clearing epoch executed on Robinhood Chain",
    },
  ];

  return {
    epoch: 103,
    blockHeight: 4892100,
    regime: "NORMAL",
    isRunning: false,
    isShockActive: false,
    isFreezeActive: false,
    isSpikeActive: false,
    unweaveProgress: 1.0,

    grossFlow: 3420000,
    netFlow: 710000,
    grossObligationsCount: 12842,
    netTransfersCount: 3,
    availableLiquidity: 1100000,
    requiredLiquidity: 710000,
    liquidityShortfall: 0,

    batchId: "BATCH-103",
    batchStatus: "SETTLED",
    batchMessage: "Batch #103 verified and settled with 79.2% liquidity compression.",

    knots,
    rawThreads,
    netThreads,
    auditTrail: initialAudit,
  };
}

export function applyLiquidityShock(state: ArenaState): ArenaState {
  const isNowShocked = !state.isShockActive;

  if (isNowShocked) {
    // 40 percent liquidity drop: $1.10M drops to $660,000
    const shockedLiquidity = 660000;
    const required = 710000;
    const shortfall = required - shockedLiquidity; // exactly $50,000.00 shortfall

    const rejectedBatchId = `BATCH-${state.epoch + 1}`;
    const rejectionRecord: SettlementAuditRecord = {
      id: rejectedBatchId,
      epoch: state.epoch + 1,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC",
      from: "Clearing Network",
      to: "Creditors",
      grossAmount: "$3,420,000.00 USDG",
      netAmount: "$710,000.00 USDG",
      obligationsCount: 12842,
      liquidityCheck: "FAIL",
      shortfallAmount: "$50,000.00 USDG",
      regime: "CONSTRAINED",
      txHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
      status: "REJECTED",
      note: "Invariant Violation: Required $710,000.00 exceeds Available $660,000.00 by $50,000.00",
    };

    const updatedKnots = state.knots.map((k) => {
      if (k.id === "treasury") {
        return { ...k, balance: shockedLiquidity, status: "constrained" as const };
      }
      return { ...k, status: "constrained" as const };
    });

    return {
      ...state,
      epoch: state.epoch + 1,
      blockHeight: state.blockHeight + 12,
      isShockActive: true,
      regime: "CONSTRAINED",
      availableLiquidity: shockedLiquidity,
      requiredLiquidity: required,
      liquidityShortfall: shortfall,
      batchId: rejectedBatchId,
      batchStatus: "REJECTED",
      batchMessage: `REJECTED: Invariant Violation. Liquidity shortfall of $${shortfall.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDG. Available: $${shockedLiquidity.toLocaleString()} USDG, Required: $${required.toLocaleString()} USDG.`,
      knots: updatedKnots,
      auditTrail: [rejectionRecord, ...state.auditTrail],
    };
  } else {
    // Restore baseline
    return resetToBaseline(state);
  }
}

export function recomputeValidBatch(state: ArenaState): ArenaState {
  if (state.batchStatus !== "REJECTED" && !state.isShockActive) {
    return state;
  }

  // Constrained netting re-solves graph: settles critical paths first ($610,000)
  // Preserves $50,000 safety buffer from available $660,000
  const recomputedNet = 610000;
  const recomputedBatchId = `BATCH-${state.epoch + 1}`;

  const recomputedRecord: SettlementAuditRecord = {
    id: recomputedBatchId,
    epoch: state.epoch + 1,
    timestamp: new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC",
    from: "Clearing Network",
    to: "Priority Creditors",
    grossAmount: "$2,980,000.00 USDG",
    netAmount: "$610,000.00 USDG",
    obligationsCount: 10450,
    liquidityCheck: "PASS",
    regime: "CONSTRAINED",
    txHash: "0x39a1c890f12da34891b2c4510ea98b7123ca45901238914b1239fca84901abcd",
    status: "RECOMPUTED",
    note: "Valid batch resolved via Constrained Netting. 100% Critical obligations covered.",
  };

  const recomputedNetThreads: LoomThread[] = [
    { id: "net-c1", fromId: "agent-alpha", toId: "agent-gamma", amount: 180000, isNetSettlement: true, priority: "critical" },
    { id: "net-c2", fromId: "agent-delta", toId: "agent-gamma", amount: 200000, isNetSettlement: true, priority: "critical" },
    { id: "net-c3", fromId: "agent-delta", toId: "agent-beta", amount: 230000, isNetSettlement: true, priority: "normal" },
  ];

  return {
    ...state,
    epoch: state.epoch + 1,
    blockHeight: state.blockHeight + 15,
    requiredLiquidity: recomputedNet,
    liquidityShortfall: 0,
    netFlow: recomputedNet,
    netThreads: recomputedNetThreads,
    batchId: recomputedBatchId,
    batchStatus: "RECOMPUTED",
    batchMessage: `VALID BATCH RESOLVED: $610,000.00 USDG settled. 100% critical obligations covered. $50,000.00 USDG safety margin preserved.`,
    auditTrail: [recomputedRecord, ...state.auditTrail],
  };
}

export function toggleCounterpartyFreeze(state: ArenaState): ArenaState {
  const isNowFrozen = !state.isFreezeActive;
  const updatedKnots = state.knots.map((k) => {
    if (k.id === "agent-gamma") {
      return { ...k, status: isNowFrozen ? ("frozen" as const) : ("healthy" as const) };
    }
    return k;
  });

  return {
    ...state,
    isFreezeActive: isNowFrozen,
    knots: updatedKnots,
    batchMessage: isNowFrozen
      ? "COUNTERPARTY FREEZE: Agent-Gamma obligations quarantined. Remaining network clearing operational."
      : "COUNTERPARTY UNFREEZE: Agent-Gamma restored to active clearing.",
  };
}

export function toggleObligationSpike(state: ArenaState): ArenaState {
  const isNowSpiked = !state.isSpikeActive;
  const multiplier = isNowSpiked ? 3.0 : 1.0;
  const gross = Math.floor(3420000 * multiplier);
  const count = Math.floor(12842 * multiplier);

  return {
    ...state,
    isSpikeActive: isNowSpiked,
    grossFlow: gross,
    grossObligationsCount: count,
    batchMessage: isNowSpiked
      ? "OBLIGATION SPIKE (+300%): Gross flow expanded to $10.26M. NORN multilateral netting compression ratio elevated to 92.4%."
      : "OBLIGATION FLOW RESTORED: Standard transaction velocity resumed.",
  };
}

export function resetToBaseline(state: ArenaState): ArenaState {
  const initial = createInitialArenaState();
  return {
    ...initial,
    epoch: state.epoch + 1,
    blockHeight: state.blockHeight + 20,
    auditTrail: state.auditTrail,
  };
}

export function stepSimulationEpoch(state: ArenaState): ArenaState {
  if (state.isShockActive && state.batchStatus === "REJECTED") {
    return {
      ...state,
      epoch: state.epoch + 1,
      blockHeight: state.blockHeight + 12,
      batchMessage: `EPOCH #${state.epoch + 1} QUEUED: Clearing halted due to $${state.liquidityShortfall.toLocaleString()} USDG liquidity deficit. Click RECOMPUTE BATCH or RESET BASELINE.`,
    };
  }

  const nextEpoch = state.epoch + 1;
  const nextBlock = state.blockHeight + 12 + (nextEpoch % 5);

  const flowJitter = Math.sin(nextEpoch * 0.72) * 0.12 + Math.cos(nextEpoch * 0.35) * 0.08;
  const baseGross = state.isSpikeActive ? 10260000 : 3420000;
  const grossFlow = Math.round(baseGross * (1 + flowJitter));

  const baseCompression = state.isSpikeActive ? 0.924 : 0.792;
  const compressionJitter = Math.sin(nextEpoch * 0.53) * 0.025;
  const compressionRatio = Math.max(0.72, Math.min(0.96, baseCompression + compressionJitter));
  const netFlow = Math.round(grossFlow * (1 - compressionRatio));
  const grossObligationsCount = Math.round(grossFlow / 266);
  const netTransfersCount = state.isFreezeActive ? 2 : 3;

  const dAlpha = Math.round(Math.sin(nextEpoch * 0.8) * 35000);
  const dBeta = Math.round(Math.cos(nextEpoch * 0.6) * 28000);
  const dGamma = -dAlpha + Math.round(Math.sin(nextEpoch * 0.4) * 15000);
  const dDelta = -dBeta - Math.round(Math.sin(nextEpoch * 0.4) * 15000);

  const updatedKnots: LoomKnot[] = state.knots.map((knot) => {
    if (knot.id === "agent-alpha") {
      const netPos = -180000 + dAlpha;
      return { ...knot, netPosition: netPos, balance: Math.max(50000, 420000 + dAlpha * 0.4) };
    }
    if (knot.id === "agent-beta") {
      const netPos = 95000 + dBeta;
      return { ...knot, netPosition: netPos, balance: Math.max(50000, 310000 + dBeta * 0.4) };
    }
    if (knot.id === "agent-gamma") {
      const netPos = 285000 + dGamma;
      return { ...knot, netPosition: netPos, balance: Math.max(50000, 650000 + dGamma * 0.4) };
    }
    if (knot.id === "agent-delta") {
      const netPos = -200000 + dDelta;
      return { ...knot, netPosition: netPos, balance: Math.max(50000, 290000 + dDelta * 0.4) };
    }
    if (knot.id === "treasury") {
      return { ...knot, balance: state.availableLiquidity, netPosition: 0 };
    }
    return knot;
  });

  const flowScale = grossFlow / 3420000;
  const updatedRawThreads = state.rawThreads.map((t) => ({
    ...t,
    amount: Math.round(t.amount * (0.92 + (flowScale - 1) * 0.5 + Math.random() * 0.16)),
  }));

  const updatedNetThreads = state.netThreads.map((t) => ({
    ...t,
    amount: Math.round((netFlow / 3) * (0.88 + Math.random() * 0.24)),
  }));

  const randomHex = () => Math.floor(Math.random() * 16).toString(16);
  const txHash = "0x" + Array.from({ length: 64 }, randomHex).join("");

  const newAuditRecord: SettlementAuditRecord = {
    id: `BATCH-${nextEpoch}`,
    epoch: nextEpoch,
    timestamp: new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC",
    from: "Clearing Network",
    to: `${netTransfersCount} Net Creditors`,
    grossAmount: `$${grossFlow.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDG`,
    netAmount: `$${netFlow.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDG`,
    obligationsCount: grossObligationsCount,
    liquidityCheck: "PASS",
    regime: state.regime,
    txHash,
    status: "SETTLED",
    note: `Epoch #${nextEpoch} cleared: ${(compressionRatio * 100).toFixed(1)}% compression on Robinhood Chain`,
  };

  const nextAudit = [newAuditRecord, ...state.auditTrail.slice(0, 24)];

  return {
    ...state,
    epoch: nextEpoch,
    blockHeight: nextBlock,
    grossFlow,
    netFlow,
    grossObligationsCount,
    netTransfersCount,
    requiredLiquidity: netFlow,
    batchId: `BATCH-${nextEpoch}`,
    batchStatus: "SETTLED",
    batchMessage: `Epoch #${nextEpoch} settled: ${grossObligationsCount.toLocaleString()} obligations compressed by ${(compressionRatio * 100).toFixed(1)}% via Robinhood USDG atomic routing.`,
    knots: updatedKnots,
    rawThreads: updatedRawThreads,
    netThreads: updatedNetThreads,
    auditTrail: nextAudit,
  };
}
