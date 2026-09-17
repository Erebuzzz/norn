/**
 * Runs the exact 5-beat scenario from creance.md's demo script through the
 * real agentic loop, end to end, without a browser dependency. Use this to
 * confirm the loop's decisions match the shared policy contract before a live
 * chain call is enabled.
 *
 * Run: node src/demo.js
 */

import { runAgenticLoop } from './agenticLoop.js';

function printLog(label, result) {
  console.log(`\n=== ${label} -> ${result.outcome} ===`);
  for (const e of result.log.events) {
    console.log(`  [${e.code || '----'}] ${e.event}: ${e.detail}`);
  }
}

const portfolio = {
  totalValue: 1_000_000,
  holdings: { USDC: 700_000, AAPL: 300_000 },
  spentToday: 0,
};

const market = {
  volatility30d: { AAPL: 0.28 },
  depegRisk: { USDC: 0.01 },
  liquidityDepthUsd: { AAPL: 5_000_000 },
  verifiedSources: ['AAPL_PRICE:chainlink'],
};

const mandate = {
  assetCeilings: {},
  issuerCeilings: {},
  chainCeilings: {},
  equityCeiling: 0.3,
  equityTickers: ['AAPL', 'MSFT', 'NVDA', 'AMZN'],
  riskFloor: 40,
  liquidityFloor: 200_000,
  dailySpendCap: 500_000,
  approvalThresholds: { auto: 10_000, review: 100_000 },
  depegCriticalThreshold: 0.5,
};

async function main() {
  // Beat 1: propose $150K AAPL against a 30% equity ceiling, starting at
  // exactly 30% AAPL already -> rejected. No auto-revision here: this is
  // the beat where a human is meant to see the rejection and decide whether
  // to loosen the mandate, not where the agent should quietly shrink the
  // trade to $0 and call that a win.
  const beat1 = await runAgenticLoop({
    portfolio,
    market,
    mandate,
    proposalOverride: { from: 'USDC', to: 'AAPL', amountUsd: 150_000, reason: 'Reduce idle USDC exposure' },
    maxRetries: 0,
  });
  printLog('Beat 1: propose $150K AAPL, 30% ceiling already fully used', beat1);

  // Bonus beat: same rejection mechanics, but starting under the ceiling, so
  // the auto-revision retry loop actually has room to find a compliant size
  // on its own - this is the capability the browser timeline also exposes
  // after the shared policy evaluator clears an intent.
  const underCapPortfolio = { totalValue: 1_000_000, holdings: { USDC: 800_000, AAPL: 200_000 }, spentToday: 0 };
  const beatBonus = await runAgenticLoop({
    portfolio: underCapPortfolio,
    market,
    mandate,
    proposalOverride: { from: 'USDC', to: 'AAPL', amountUsd: 150_000, reason: 'Reduce idle USDC exposure' },
    maxRetries: 1,
    humanApprovalFn: async () => true,
  });
  printLog('Bonus: same $150K proposal, portfolio starts under the ceiling (auto-revision)', beatBonus);

  // Beat 3: loosen the mandate to 50% and resubmit the same $150K proposal.
  const looseMandate = { ...mandate, assetCeilings: { AAPL: 0.5 }, equityCeiling: 0.5 };
  const beat3 = await runAgenticLoop({
    portfolio,
    market,
    mandate: looseMandate,
    proposalOverride: { from: 'USDC', to: 'AAPL', amountUsd: 150_000, reason: 'Reduce idle USDC exposure' },
    humanApprovalFn: async () => true,
  });
  printLog('Beat 3: same $150K proposal, ceiling loosened to 50%', beat3);

  // Beat 4: adverse market event, agent proposes reducing exposure instead.
  const stressedPortfolio = { totalValue: 1_000_000, holdings: { USDC: 550_000, AAPL: 450_000 }, spentToday: 0 };
  const stressedMarket = { ...market, volatility30d: { AAPL: 0.55 } };
  const beat4 = await runAgenticLoop({
    portfolio: stressedPortfolio,
    market: stressedMarket,
    mandate: looseMandate,
    proposalOverride: { from: 'AAPL', to: 'USDC', amountUsd: 80_000, reason: 'De-risk after adverse market move' },
  });
  printLog('Beat 4: adverse event, reduce AAPL exposure', beat4);

  // Beat 5: tighten the risk floor so the same reduction proposal now fails
  // on safety score rather than exposure, proving continuous enforcement.
  const tightenedMandate = { ...looseMandate, riskFloor: 90 };
  const beat5 = await runAgenticLoop({
    portfolio: stressedPortfolio,
    market: stressedMarket,
    mandate: tightenedMandate,
    proposalOverride: { from: 'AAPL', to: 'USDC', amountUsd: 80_000, reason: 'De-risk after adverse market move' },
    maxRetries: 0,
  });
  printLog('Beat 5: risk floor tightened to 90, same proposal', beat5);
}

main();
