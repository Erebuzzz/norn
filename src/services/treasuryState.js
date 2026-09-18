/**
 * In-memory treasury cell state — USDG + Stock Token demo portfolio.
 */

import { ASSET_UNIVERSE } from '../config/arbitrum.js';

const DEFAULT_PORTFOLIO = {
  totalValue: 1_000_000,
  holdings: {
    USDG: 700_000,
    AAPL: 300_000,
    MSFT: 0,
    NVDA: 0,
    AMZN: 0,
    ETH: 0,
    USDC: 0,
    PENDLE_PT_USDC: 0,
  },
  spentToday: 0,
};

const DEFAULT_MANDATE = {
  assetCeilings: {},
  issuerCeilings: {},
  chainCeilings: { ROBINHOOD_CHAIN: 1.0, ARBITRUM_ONE: 1.0 },
  equityCeiling: 0.3,
  yieldCeiling: 0.15,
  equityTickers: [...ASSET_UNIVERSE.stockTokens],
  yieldTickers: ['PENDLE_PT_USDC'],
  riskFloor: 40,
  liquidityFloor: 200_000,
  dailySpendCap: 500_000,
  approvalThresholds: { auto: 10_000, review: 100_000 },
  depegCriticalThreshold: 0.5,
};

const DEFAULT_MARKET = {
  volatility30d: { AAPL: 0.28, MSFT: 0.24, NVDA: 0.45, AMZN: 0.3, ETH: 0.55, PENDLE_PT_USDC: 0.12 },
  depegRisk: { USDG: 0.008, USDC: 0.01, USDT: 0.015 },
  liquidityDepthUsd: {
    AAPL: 5_000_000,
    MSFT: 4_000_000,
    NVDA: 3_500_000,
    AMZN: 3_000_000,
    ETH: 80_000_000,
    PENDLE_PT_USDC: 12_000_000,
  },
  verifiedSources: ['AAPL_PRICE:chainlink'],
  signalProvenance: {
    AAPL_PRICE: { kind: 'oracle', source: 'chainlink', label: 'oracle' },
    USDG_DEPEG: { kind: 'heuristic', source: 'conservative_default', label: 'heuristic' },
    USDC_DEPEG: { kind: 'heuristic', source: 'conservative_default', label: 'heuristic' },
    LIQUIDITY_DEPTH: { kind: 'heuristic', source: 'venue_estimate', label: 'heuristic' },
    VOLATILITY_30D: { kind: 'heuristic', source: 'historical_proxy', label: 'heuristic' },
  },
};

const DEFAULT_PROPOSAL = {
  id: 'intent-024',
  from: 'USDG',
  to: 'AAPL',
  amountUsd: 150_000,
  reason: 'Reduce idle USDG exposure into AAPL Stock Token',
};

const DEFAULT_DELEGATE = {
  address: null,
  role: 'REBALANCE',
  active: true,
  spendLimitUsd: 500_000,
  provider: 'zerodev_session_key',
  note: 'Scoped executor (ZeroDev session key stand-in). Owner never shares a discretionary EOA with the agent.',
};

function clone(value) {
  return structuredClone(value);
}

function createInitialState() {
  return {
    treasuryId: 'TC-019',
    name: 'Northstar Treasury',
    targetChain: 'robinhood_chain',
    portfolio: clone(DEFAULT_PORTFOLIO),
    mandate: clone(DEFAULT_MANDATE),
    market: clone(DEFAULT_MARKET),
    activeProposal: clone(DEFAULT_PROPOSAL),
    delegate: clone(DEFAULT_DELEGATE),
    pendingIntent: null,
    pendingOnchainIntentId: null,
    lastRisk: null,
    lastOutcome: null,
    audit: [],
    frozen: false,
    updatedAt: Date.now(),
  };
}

let state = createInitialState();

export function getTreasuryState() {
  const { portfolio, mandate } = state;
  const equityValue = mandate.equityTickers.reduce((sum, t) => sum + (portfolio.holdings[t] ?? 0), 0);
  const yieldValue = (mandate.yieldTickers ?? []).reduce((sum, t) => sum + (portfolio.holdings[t] ?? 0), 0);
  const liquidValue = (portfolio.holdings.USDG ?? 0) + (portfolio.holdings.USDC ?? 0) + (portfolio.holdings.USDT ?? 0);
  return {
    ...clone(state),
    derived: {
      equityWeight: equityValue / portfolio.totalValue,
      yieldWeight: yieldValue / portfolio.totalValue,
      liquidWeight: liquidValue / portfolio.totalValue,
      equityValue,
      yieldValue,
      liquidValue,
      usdgBalance: portfolio.holdings.USDG ?? 0,
      assetCount: Object.values(portfolio.holdings).filter((v) => v > 0).length,
      mandateHealth: state.frozen ? 'Frozen' : state.delegate?.active === false ? 'Delegate revoked' : 'Sound',
      riskBadges: Object.entries(state.market.signalProvenance || {}).map(([key, meta]) => ({
        key,
        label: meta.label,
        kind: meta.kind,
        source: meta.source,
      })),
    },
  };
}

export function resetTreasuryState() {
  state = createInitialState();
  return getTreasuryState();
}

export function updateMandate(patch) {
  if (patch.equityCeiling !== undefined) {
    const ceiling = Number(patch.equityCeiling);
    if (!(ceiling >= 0 && ceiling <= 1)) throw new Error('equityCeiling must be between 0 and 1');
    state.mandate.equityCeiling = ceiling;
  }
  if (patch.yieldCeiling !== undefined) state.mandate.yieldCeiling = Number(patch.yieldCeiling);
  if (patch.riskFloor !== undefined) state.mandate.riskFloor = Number(patch.riskFloor);
  if (patch.liquidityFloor !== undefined) state.mandate.liquidityFloor = Number(patch.liquidityFloor);
  if (patch.dailySpendCap !== undefined) state.mandate.dailySpendCap = Number(patch.dailySpendCap);
  if (patch.approvalThresholds) {
    state.mandate.approvalThresholds = { ...state.mandate.approvalThresholds, ...patch.approvalThresholds };
  }
  state.updatedAt = Date.now();
  return getTreasuryState();
}

export function setActiveProposal(proposal) {
  state.activeProposal = { ...state.activeProposal, ...proposal };
  state.updatedAt = Date.now();
  return state.activeProposal;
}

export function setDelegateActive(active) {
  state.delegate = { ...state.delegate, active: Boolean(active) };
  state.updatedAt = Date.now();
  return getTreasuryState();
}

export function applyLoopResult(result) {
  state.lastOutcome = result.outcome;
  state.audit = result.log.events.map((e) => ({ ...e }));
  state.pendingIntent = result.pendingIntent ?? null;
  state.pendingOnchainIntentId = result.pendingOnchainIntentId ?? null;
  state.lastRisk = result.lastRisk ?? null;
  state.frozen = result.outcome === 'FROZEN';

  if (result.outcome === 'EXECUTED' && result.executedIntent) {
    const intent = result.executedIntent;
    const holdings = { ...state.portfolio.holdings };
    holdings[intent.from] = (holdings[intent.from] ?? 0) - intent.amountUsd;
    holdings[intent.to] = (holdings[intent.to] ?? 0) + intent.amountUsd;
    state.portfolio.holdings = holdings;
    state.portfolio.spentToday += intent.amountUsd;
    state.pendingIntent = null;
    state.pendingOnchainIntentId = null;
  }

  state.updatedAt = Date.now();
  return getTreasuryState();
}

export function getAuditLog() {
  return clone(state.audit);
}

export function clearPending() {
  state.pendingIntent = null;
  state.pendingOnchainIntentId = null;
  state.updatedAt = Date.now();
}

export function appendAuditEvent(entry) {
  state.audit = [...state.audit, { timestamp: Date.now(), ...entry }];
  state.updatedAt = Date.now();
  return getTreasuryState();
}

export function getPendingOnchainIntentId() {
  return state.pendingOnchainIntentId;
}
