/**
 * Smoke tests for treasury state + Pendle surfaces + chain gateway path.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  getTreasuryState,
  resetTreasuryState,
  updateMandate,
  applyLoopResult,
} from '../src/services/treasuryState.js';
import { listPendleYieldSurfaces, suggestYieldSleeve } from '../src/services/pendleYield.js';
import { getChainConfig, PENDLE_ARBITRUM } from '../src/config/arbitrum.js';
import {
  evaluateProposal,
  ensurePolicyGateway,
  getGatewayStatus,
  resetTreasuryAndSyncChain,
  syncMandateOnChain,
} from '../src/services/agentService.js';

describe('treasuryState', () => {
  it('resets to $1M / USDG + AAPL / 30% equity', () => {
    resetTreasuryState();
    const snap = getTreasuryState();
    assert.equal(snap.portfolio.totalValue, 1_000_000);
    assert.equal(snap.portfolio.holdings.USDG, 700_000);
    assert.equal(snap.mandate.equityCeiling, 0.3);
    assert.equal(snap.derived.equityWeight, 0.3);
    assert.equal(snap.derived.usdgBalance, 700_000);
  });

  it('updates equity ceiling via mandate patch', () => {
    resetTreasuryState();
    const snap = updateMandate({ equityCeiling: 0.5 });
    assert.equal(snap.mandate.equityCeiling, 0.5);
  });

  it('applies executed intent to holdings', () => {
    resetTreasuryState();
    applyLoopResult({
      outcome: 'EXECUTED',
      log: { events: [{ event: 'TradeExecuted', detail: 'ok', code: '0x1', timestamp: Date.now() }] },
      executedIntent: { from: 'USDG', to: 'AAPL', amountUsd: 50_000, id: 't1', reason: 'test' },
    });
    const snap = getTreasuryState();
    assert.equal(snap.portfolio.holdings.USDG, 650_000);
    assert.equal(snap.portfolio.holdings.AAPL, 350_000);
    assert.equal(snap.portfolio.spentToday, 50_000);
  });
});

describe('pendleYield', () => {
  it('lists mock surfaces with heuristic labels', () => {
    const catalog = listPendleYieldSurfaces({ mode: 'mock' });
    assert.ok(catalog.surfaces.length >= 2);
    assert.equal(catalog.core.router, PENDLE_ARBITRUM.router);
    assert.match(catalog.surfaces[0].dataLabel, /heuristic/i);
  });

  it('suggests a PT sleeve when USDG/USDC is idle-heavy', () => {
    const hint = suggestYieldSleeve({ totalValue: 1_000_000, holdings: { USDC: 700_000 } });
    assert.ok(hint);
    assert.equal(hint.surfaceId, 'pendle-usdc-pt');
  });
});

describe('chain config', () => {
  it('exposes RH primary + Arb Sepolia dry-run + Pendle Arb-only', () => {
    const cfg = getChainConfig();
    assert.equal(cfg.demoPrimary.shortName, 'rh');
    assert.equal(cfg.dryRun.chainId, 421614);
    assert.equal(cfg.pendle.router, '0x888888888889758F76e7103c6CbF23ABbF58F946');
    assert.equal(cfg.policyContract.solidityOnly, true);
  });
});

describe('live policy gateway CAP_001', () => {
  before(async () => {
    await ensurePolicyGateway();
  });

  it('boots a local policy contract', () => {
    const status = getGatewayStatus();
    assert.equal(status.ready, true);
    assert.ok(status.address?.startsWith('0x'));
  });

  it('rejects $150K AAPL at 30% ceiling with on-chain txHash', async () => {
    await resetTreasuryAndSyncChain();
    const result = await evaluateProposal({ maxRetries: 0 });
    assert.equal(result.outcome, 'REJECTED');
    const codes = result.log.events.map((e) => e.code).filter(Boolean);
    assert.ok(codes.includes('CAP_001'));
    const withTx = result.log.events.filter((e) => e.txHash?.startsWith('0x'));
    assert.ok(withTx.length >= 1, 'reject must carry a real tx hash');
  });

  it('awaits human approval after ceiling loosened to 50%', async () => {
    await resetTreasuryAndSyncChain();
    await syncMandateOnChain({ equityCeiling: 0.5 });
    const result = await evaluateProposal({ maxRetries: 0 });
    assert.equal(result.outcome, 'AWAITING_HUMAN');
    assert.ok(result.log.events.some((e) => e.txHash?.startsWith('0x')));
  });

  it('reset re-syncs on-chain mandate so CAP_001 fires again', async () => {
    await resetTreasuryAndSyncChain();
    await syncMandateOnChain({ equityCeiling: 0.5 });
    const open = await evaluateProposal({ maxRetries: 0 });
    assert.equal(open.outcome, 'AWAITING_HUMAN');

    const reset = await resetTreasuryAndSyncChain();
    assert.equal(reset.treasury.mandate.equityCeiling, 0.3);
    assert.ok(reset.chainTx?.txHash?.startsWith('0x'));
    assert.ok(reset.treasury.audit.some((e) => e.event === 'TreasuryReset'));

    const blocked = await evaluateProposal({ maxRetries: 0 });
    assert.equal(blocked.outcome, 'REJECTED');
    assert.ok(blocked.log.events.some((e) => e.code === 'CAP_001'));
  });
});
