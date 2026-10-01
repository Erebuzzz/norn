import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as tokensModule from "../packages/ui/dist/tokens.js";
import { LoomEngine } from "../packages/ui/dist/LoomEngine.js";
import {
  MetricsCard,
  CrisisControl,
  BaselineComparison,
  RegimeBadge,
  AuditTrail,
} from "../packages/ui/dist/components/index.js";

import {
  createInitialArenaState,
  applyLiquidityShock,
  recomputeValidBatch,
  toggleCounterpartyFreeze,
  toggleObligationSpike,
  resetToBaseline,
} from "../apps/arena/src/arenaSimulation.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("NORN UI Design Genome & Arena Suite", () => {
  test("Tokens: exports all required Cold Infrastructure palette colors", () => {
    const { tokens, bg, surface, panel, border, textPrimary, textSecondary, textMuted, active, success, danger } =
      tokensModule;

    // Verify individual exports
    assert.equal(bg, "#07090B");
    assert.equal(surface, "#0C0F12");
    assert.equal(panel, "#151A1F");
    assert.equal(border, "#283038");
    assert.equal(textPrimary, "#E7E4DB");
    assert.equal(textSecondary, "#A5A9AE");
    assert.equal(textMuted, "#6F747B");
    assert.equal(active, "#9ED8E8");
    assert.equal(success, "#8FB8A4");
    assert.equal(danger, "#D7664F");

    // Verify consolidated tokens object
    assert.equal(tokens.bg, "#07090B");
    assert.equal(tokens.surface, "#0C0F12");
    assert.equal(tokens.panel, "#151A1F");
    assert.equal(tokens.border, "#283038");
    assert.equal(tokens.textPrimary, "#E7E4DB");
    assert.equal(tokens.textSecondary, "#A5A9AE");
    assert.equal(tokens.textMuted, "#6F747B");
    assert.equal(tokens.active, "#9ED8E8");
    assert.equal(tokens.success, "#8FB8A4");
    assert.equal(tokens.danger, "#D7664F");
  });

  test("Tokens: regimes include NORMAL, CONSTRAINED, DEFENSIVE, and EMERGENCY_HALT", () => {
    const { tokens } = tokensModule;
    assert.ok(tokens.regimes.NORMAL);
    assert.ok(tokens.regimes.CONSTRAINED);
    assert.ok(tokens.regimes.DEFENSIVE);
    assert.ok(tokens.regimes.EMERGENCY_HALT);

    assert.equal(tokens.regimes.NORMAL.label, "NORMAL");
    assert.equal(tokens.regimes.CONSTRAINED.label, "CONSTRAINED");
    assert.equal(tokens.regimes.DEFENSIVE.label, "DEFENSIVE");
    assert.equal(tokens.regimes.EMERGENCY_HALT.label, "EMERGENCY HALT");
  });

  test("LoomCanvas: engine and data structures are correctly exported", () => {
    assert.equal(typeof LoomEngine, "function");
    assert.ok(LoomEngine.prototype.start);
    assert.ok(LoomEngine.prototype.stop);
    assert.ok(LoomEngine.prototype.setKnots);
    assert.ok(LoomEngine.prototype.setThreads);
    assert.ok(LoomEngine.prototype.setUnweaveProgress);
    assert.ok(LoomEngine.prototype.setReducedMotion);
  });

  test("Components: exported components exist and have valid function structure", () => {
    assert.equal(typeof MetricsCard, "function");
    assert.equal(typeof CrisisControl, "function");
    assert.equal(typeof BaselineComparison, "function");
    assert.equal(typeof RegimeBadge, "function");
    assert.equal(typeof AuditTrail, "function");
  });

  test("Arena Simulation: initial baseline state satisfies multilateral netting efficiency", () => {
    const state = createInitialArenaState();

    assert.equal(state.regime, "NORMAL");
    assert.equal(state.availableLiquidity, 1100000);
    assert.equal(state.requiredLiquidity, 710000);
    assert.equal(state.liquidityShortfall, 0);
    assert.equal(state.batchStatus, "SETTLED");
    assert.equal(state.knots.length, 5);

    // Multilateral netting reduces 12,842 gross obligations down to 3 net transfers
    assert.equal(state.grossObligationsCount, 12842);
    assert.equal(state.netTransfersCount, 3);
    assert.equal(state.grossFlow, 3420000);
    assert.equal(state.netFlow, 710000);

    const compression = (state.grossFlow - state.netFlow) / state.grossFlow;
    assert.ok(compression > 0.75, "Netting efficiency must exceed 75% reduction");
  });

  test("Arena Simulation: -40% liquidity shock triggers regime transition to CONSTRAINED and rejects batch with exact $50,000 shortfall", () => {
    const initialState = createInitialArenaState();
    const shocked = applyLiquidityShock(initialState);

    // Available liquidity drops from $1,100,000 to $660,000
    assert.equal(shocked.isShockActive, true);
    assert.equal(shocked.availableLiquidity, 660000);
    assert.equal(shocked.requiredLiquidity, 710000);

    // Exact numeric shortfall: $710,000 - $660,000 = $50,000
    assert.equal(shocked.liquidityShortfall, 50000);

    // Regime transitions to CONSTRAINED
    assert.equal(shocked.regime, "CONSTRAINED");
    assert.equal(shocked.batchStatus, "REJECTED");
    assert.match(shocked.batchMessage, /shortfall of \$50,000\.00 USDG/i);

    // Audit trail records the rejected batch with exact shortfall
    const latestAudit = shocked.auditTrail[0];
    assert.equal(latestAudit.status, "REJECTED");
    assert.equal(latestAudit.liquidityCheck, "FAIL");
    assert.equal(latestAudit.shortfallAmount, "$50,000.00 USDG");
    assert.equal(latestAudit.regime, "CONSTRAINED");
  });

  test("Arena Simulation: recomputeValidBatch re-solves graph under constrained regime and preserves reserve safety buffer", () => {
    const initialState = createInitialArenaState();
    const shocked = applyLiquidityShock(initialState);
    const recomputed = recomputeValidBatch(shocked);

    // Recomputed batch settles critical obligations within available $660,000
    assert.equal(recomputed.batchStatus, "RECOMPUTED");
    assert.equal(recomputed.requiredLiquidity, 610000);
    assert.equal(recomputed.liquidityShortfall, 0);
    assert.equal(recomputed.netFlow, 610000);

    // Verifies safety buffer: $660,000 available - $610,000 required = $50,000 safety margin
    const safetyBuffer = recomputed.availableLiquidity - recomputed.requiredLiquidity;
    assert.equal(safetyBuffer, 50000);

    // Audit trail updated with RECOMPUTED record
    const latestAudit = recomputed.auditTrail[0];
    assert.equal(latestAudit.status, "RECOMPUTED");
    assert.equal(latestAudit.liquidityCheck, "PASS");
    assert.equal(latestAudit.regime, "CONSTRAINED");
  });

  test("Arena Simulation: counterparty freeze isolates stressed node without halting network", () => {
    const initialState = createInitialArenaState();
    const frozen = toggleCounterpartyFreeze(initialState);

    assert.equal(frozen.isFreezeActive, true);
    const gamma = frozen.knots.find((k) => k.id === "agent-gamma");
    assert.ok(gamma);
    assert.equal(gamma.status, "frozen");

    const alpha = frozen.knots.find((k) => k.id === "agent-alpha");
    assert.ok(alpha);
    assert.notEqual(alpha.status, "frozen");
  });

  test("Arena Simulation: obligation spike scales gross flow to $10.26M", () => {
    const initialState = createInitialArenaState();
    const spiked = toggleObligationSpike(initialState);

    assert.equal(spiked.isSpikeActive, true);
    assert.equal(spiked.grossFlow, 10260000);
    assert.equal(spiked.grossObligationsCount, 38526);
  });

  test("Arena Simulation: reset restores initial healthy state", () => {
    const initialState = createInitialArenaState();
    const shocked = applyLiquidityShock(initialState);
    const reset = resetToBaseline(shocked);

    assert.equal(reset.isShockActive, false);
    assert.equal(reset.regime, "NORMAL");
    assert.equal(reset.availableLiquidity, 1100000);
    assert.equal(reset.batchStatus, "SETTLED");
  });

  test("Strict Zero Emdashes: UI and Arena sources contain zero emdash characters", () => {
    const checkDir = (dirPath) => {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          checkDir(fullPath);
        } else if (file.endsWith(".ts") || file.endsWith(".tsx") || file.endsWith(".js") || file.endsWith(".json")) {
          const content = fs.readFileSync(fullPath, "utf8");
          assert.equal(
            content.includes("\u2014"),
            false,
            `File ${fullPath} contains an emdash character (\\u2014)`
          );
        }
      }
    };

    checkDir(path.resolve(__dirname, "../packages/ui/src"));
    checkDir(path.resolve(__dirname, "../apps/arena/src"));
  });
});
