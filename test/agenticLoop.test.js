import test from 'node:test';
import assert from 'node:assert/strict';
import {
  runAgenticLoop,
  riskOfficerAgent,
  policyOfficerAgent,
} from '../src/agenticLoop.js';

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

const proposal = { from: 'USDC', to: 'AAPL', amountUsd: 150_000, reason: 'Reduce idle USDC exposure' };

function eventNames(result) {
  return result.log.events.map(({ event }) => event);
}

function eventWith(result, event) {
  return result.log.events.find((entry) => entry.event === event);
}

test('scripted outcomes match the agentic loop specification', async () => {
  const beat1 = await runAgenticLoop({ portfolio, market, mandate, proposalOverride: proposal, maxRetries: 0 });
  assert.equal(beat1.outcome, 'REJECTED');
  assert.equal(eventWith(beat1, 'PolicyChecked').code, 'CAP_001');
  assert.ok(!eventNames(beat1).includes('TradeExecuted'));

  const beatBonus = await runAgenticLoop({
    portfolio: { totalValue: 1_000_000, holdings: { USDC: 800_000, AAPL: 200_000 }, spentToday: 0 },
    market,
    mandate,
    proposalOverride: proposal,
    maxRetries: 1,
    humanApprovalFn: async () => true,
  });
  assert.equal(beatBonus.outcome, 'EXECUTED');
  assert.equal(eventWith(beatBonus, 'TradeExecuted').detail.includes('$100,000'), true);
  assert.equal(eventNames(beatBonus).filter((event) => event === 'ProposalCreated').length, 2);

  const looseMandate = { ...mandate, assetCeilings: { AAPL: 0.5 }, equityCeiling: 0.5 };
  const beat3 = await runAgenticLoop({ portfolio, market, mandate: looseMandate, proposalOverride: proposal });
  assert.equal(beat3.outcome, 'AWAITING_HUMAN');
  assert.ok(eventNames(beat3).includes('ApprovalRequested'));
  assert.equal(beat3.pendingIntent.amountUsd, 150_000);

  const approvedBeat3 = await runAgenticLoop({
    portfolio,
    market,
    mandate: looseMandate,
    proposalOverride: proposal,
    humanApprovalFn: async () => true,
  });
  assert.equal(approvedBeat3.outcome, 'EXECUTED');

  const stressedPortfolio = { totalValue: 1_000_000, holdings: { USDC: 550_000, AAPL: 450_000 }, spentToday: 0 };
  const stressedMarket = { ...market, volatility30d: { AAPL: 0.55 } };
  const deRiskProposal = { from: 'AAPL', to: 'USDC', amountUsd: 80_000, reason: 'De-risk after adverse market move' };
  const beat4 = await runAgenticLoop({ portfolio: stressedPortfolio, market: stressedMarket, mandate: looseMandate, proposalOverride: deRiskProposal });
  assert.equal(beat4.outcome, 'EXECUTED');
  assert.equal(eventWith(beat4, 'TradeExecuted').code.startsWith('0xSIMULATED_'), true);

  const beat5 = await runAgenticLoop({ portfolio: stressedPortfolio, market: stressedMarket, mandate: { ...looseMandate, riskFloor: 90 }, proposalOverride: deRiskProposal, maxRetries: 0 });
  assert.equal(beat5.outcome, 'REJECTED');
  assert.equal(eventWith(beat5, 'PolicyChecked').code, 'RISK_002');
});

test('emergency depeg checks both sides and short-circuits retries', async () => {
  const result = await runAgenticLoop({
    portfolio: { totalValue: 1_000_000, holdings: { USDC: 600_000, USDT: 400_000 }, spentToday: 0 },
    market: { volatility30d: {}, depegRisk: { USDC: 0.1, USDT: 0.8 }, liquidityDepthUsd: {}, verifiedSources: [] },
    mandate: { ...mandate, equityTickers: [], depegCriticalThreshold: 0.5 },
    proposalOverride: { from: 'USDC', to: 'USDT', amountUsd: 50_000, reason: 'Move stablecoin liquidity' },
    maxRetries: 2,
  });
  assert.equal(result.outcome, 'FROZEN');
  assert.deepEqual(eventNames(result), ['ProposalCreated', 'RiskVerified', 'EmergencyFreeze']);
  assert.match(eventWith(result, 'RiskVerified').detail, /USDT: heuristic/);
});

test('stablecoin destinations skip asset ceilings and add received liquidity', () => {
  const intent = { id: 'sell-aapl', type: 'REBALANCE', from: 'AAPL', to: 'USDC', amountUsd: 100_000, reason: 'Raise liquidity', createdAt: Date.now() };
  const risk = riskOfficerAgent(intent, portfolio, market, mandate);
  const result = policyOfficerAgent(intent, risk, { ...mandate, assetCeilings: { USDC: 0.01 }, liquidityFloor: 750_000 }, portfolio);
  assert.equal(result.permitted, true);
  assert.equal(result.code, 'CLEAR');
});

test('unknown non-stable liquidity is fully illiquid and explicitly heuristic', () => {
  const intent = { id: 'buy-aapl', type: 'REBALANCE', from: 'USDC', to: 'AAPL', amountUsd: 100_000, reason: 'Buy AAPL', createdAt: Date.now() };
  const assessment = riskOfficerAgent(intent, portfolio, { volatility30d: { AAPL: 0.2 }, depegRisk: { USDC: 0.01 }, liquidityDepthUsd: {}, verifiedSources: [] }, mandate);
  assert.equal(assessment.components.illiquidity, 1);
  assert.match(assessment.signalSources.liquidityDepth, /heuristic/);
});

test('human decline rejects without invoking the executor', async () => {
  let executed = false;
  const result = await runAgenticLoop({
    portfolio,
    market,
    mandate: { ...mandate, equityCeiling: 0.5 },
    proposalOverride: proposal,
    humanApprovalFn: async () => false,
    onchainExecuteFn: async () => { executed = true; return { txHash: 'should-not-exist' }; },
  });
  assert.equal(result.outcome, 'REJECTED');
  assert.equal(executed, false);
  assert.equal(eventWith(result, 'ApprovalRejected').code, 'HUMAN_001');
});

test('executor is injectable without changing policy agents', async () => {
  let receivedIntent;
  const result = await runAgenticLoop({
    portfolio,
    market,
    mandate: { ...mandate, equityCeiling: 0.5 },
    proposalOverride: { ...proposal, amountUsd: 5_000 },
    onchainExecuteFn: async (intent) => {
      receivedIntent = intent;
      return { txHash: '0xCUSTOM_EXECUTOR' };
    },
  });
  assert.equal(result.outcome, 'EXECUTED');
  assert.equal(receivedIntent.amountUsd, 5_000);
  assert.equal(eventWith(result, 'TradeExecuted').code, '0xCUSTOM_EXECUTOR');
});
