/**
 * Creance - Agentic Loop
 * ----------------------
 * Reference implementation of the four-stage decision loop described in
 * `creance.md`: Treasurer -> Risk Officer -> Policy Officer -> Executor.
 *
 * This module is deliberately framework-agnostic and has zero external
 * dependencies. The Treasurer's proposal step and the Executor's on-chain
 * call are both injectable, so this same loop can run:
 *   - fully deterministic (default heuristics below), for tests and demos
 *   - with a real LLM agent swarm plugged into `proposeFn`
 *   - with a real chain client (viem/ethers) plugged into `onchainExecuteFn`
 *
 * The Policy Officer's checks here are intentionally written to mirror,
 * line for line, the invariants the Solidity policy contract must enforce
 * on-chain. Treat this file as the off-chain pre-check whose job is to
 * never submit a transaction the contract would revert anyway, and treat
 * the contract as the actual authorization boundary (this file is not one -
 * see code_review.md).
 *
 * Audit event sequence (matches AGENTIC_LOOP_SPEC.md exactly):
 *   ProposalCreated -> RiskVerified -> PolicyChecked -> ApprovalRequested
 *   -> ApprovalGranted | ApprovalRejected -> TradeExecuted -> PolicyUpdated
 *   -> EmergencyFreeze (only on critical risk override)
 */

// ---------------------------------------------------------------------------
// Types (JSDoc only - no build step required)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} Mandate
 * @property {Record<string, number>} assetCeilings   e.g. { AAPL: 0.10 } - max weight per asset
 * @property {Record<string, number>} issuerCeilings  e.g. { USDC_ISSUER: 0.60 }
 * @property {Record<string, number>} chainCeilings   e.g. { ARBITRUM_ONE: 0.70 }
 * @property {number} equityCeiling                   max combined Stock Token weight, 0-1
 * @property {number} riskFloor                       minimum acceptable safety score, 0-100
 * @property {number} liquidityFloor                  minimum liquid (stablecoin) balance, in USD
 * @property {number} dailySpendCap                   max USD moved per day
 * @property {{ auto: number, review: number }} approvalThresholds
 *           amount < auto            -> executes without human sign-off
 *           auto <= amount < review  -> requires Policy Officer pass only
 *           amount >= review         -> requires human approval callback
 * @property {number} depegCriticalThreshold           depeg risk (0-1) above which the loop
 *           freezes new positions regardless of any other check
 * @property {string[]} equityTickers  which holdings count toward the aggregate equity ceiling
 */

const STABLECOINS = ['USDC', 'USDT'];

const usdFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const formatUsd = (value) => usdFormatter.format(value);

function isStablecoin(ticker) {
  return STABLECOINS.includes(ticker);
}

function hasVerifiedSource(market, prefixes) {
  const sources = (market.verifiedSources ?? []).map((source) => source.toUpperCase());
  return sources.some((source) => prefixes.some((prefix) => source.startsWith(prefix.toUpperCase())));
}

/**
 * @typedef {Object} Portfolio
 * @property {number} totalValue
 * @property {Record<string, number>} holdings   asset ticker -> USD value
 * @property {number} spentToday                 USD moved so far today
 */

/**
 * @typedef {Object} MarketSnapshot
 * @property {Record<string, number>} volatility30d   per-asset, 0-1
 * @property {Record<string, number>} depegRisk        per-stablecoin, 0-1 (0 = fully pegged)
 * @property {Record<string, number>} liquidityDepthUsd
 * @property {string[]} verifiedSources   which fields above come from a live oracle/feed,
 *           e.g. ['STOCK_TOKEN_PRICES:chainlink']. Anything not listed here is a heuristic
 *           and must be labeled as such wherever it's surfaced (see creance.md "Risk data boundary").
 */

/**
 * @typedef {Object} Intent
 * @property {string} id
 * @property {'REBALANCE'} type
 * @property {string} from
 * @property {string} to
 * @property {number} amountUsd
 * @property {string} reason
 * @property {number} createdAt
 */

/**
 * @typedef {Object} RiskAssessment
 * @property {number} safetyScore        0-100, higher is safer (this is the mandate's "RiskScore")
 * @property {Record<string, number>} components
 * @property {Record<string, string>} signalSources  verified or conservative heuristic labels
 * @property {boolean} criticalDepeg
 */

/**
 * @typedef {Object} PolicyResult
 * @property {boolean} permitted
 * @property {string} code               e.g. 'CLEAR', 'CAP_001', 'RISK_002', 'LIQ_003', 'SPEND_004'
 * @property {string} reason
 * @property {boolean} requiresHumanApproval
 */

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

function createAuditLog() {
  /** @type {{ timestamp: number, event: string, detail: string, code: string }[]} */
  const events = [];
  return {
    events,
    emit(event, detail, code = '') {
      const entry = { timestamp: Date.now(), event, detail, code };
      events.push(entry);
      return entry;
    },
  };
}

// ---------------------------------------------------------------------------
// Agent 1: Treasurer - proposes an intent
// ---------------------------------------------------------------------------

/**
 * Default heuristic proposer. Real deployments should pass a `proposeFn`
 * (e.g. an LLM call reading the same portfolio/market/mandate context) into
 * `runAgenticLoop` instead of relying on this.
 *
 * @param {Portfolio} portfolio
 * @param {MarketSnapshot} market
 * @param {Mandate} mandate
 * @param {{ from: string, to: string, amountUsd: number, reason?: string }} [override]
 * @returns {Intent}
 */
function treasurerAgent(portfolio, market, mandate, override) {
  const from = override?.from ?? 'USDC';
  const to = override?.to ?? 'AAPL';
  const amountUsd = override?.amountUsd ?? Math.round(portfolio.totalValue * 0.05);
  return {
    id: `intent-${Date.now()}`,
    type: 'REBALANCE',
    from,
    to,
    amountUsd,
    reason: override?.reason ?? `Reduce idle ${from} exposure, deploy into ${to}.`,
    createdAt: Date.now(),
  };
}

/**
 * Revises a rejected intent by scaling it down against the specific
 * constraint that failed. This is what makes the loop "agentic" rather than
 * a single linear pass: the Treasurer sees the rejection and tries again
 * within bounds, instead of a human having to resubmit manually.
 *
 * @param {Intent} intent
 * @param {PolicyResult} rejection
 * @param {Mandate} mandate
 * @param {Portfolio} portfolio
 * @returns {Intent}
 */
function reviseIntent(intent, rejection, mandate, portfolio) {
  if (rejection.code === 'CAP_001') {
    // Exposure cap breach: shrink the proposal to exactly fit whichever
    // ceiling actually fired - the per-asset one if it exists, otherwise
    // the aggregate equity ceiling.
    const equityTickers = mandate.equityTickers ?? [];
    const assetCeilings = mandate.assetCeilings ?? {};
    const usesEquityCeiling = assetCeilings[intent.to] === undefined && equityTickers.includes(intent.to);
    const ceiling = usesEquityCeiling ? mandate.equityCeiling : assetCeilings[intent.to];
    const currentValue = usesEquityCeiling
      ? equityTickers.reduce((sum, t) => sum + Math.max(portfolio.holdings[t] ?? 0, 0), 0)
      : Math.max(portfolio.holdings[intent.to] ?? 0, 0);
    const maxAdditionalUsd = Math.max(0, Math.floor(ceiling * portfolio.totalValue - currentValue + Number.EPSILON));
    return {
      ...intent,
      id: `${intent.id}-revised`,
      amountUsd: Math.min(intent.amountUsd, maxAdditionalUsd),
      reason: `${intent.reason} (revised down to fit the ${(ceiling * 100).toFixed(1)}% ceiling after rejection)`,
    };
  }
  if (rejection.code === 'SPEND_004') {
    const remaining = Math.max(mandate.dailySpendCap - portfolio.spentToday, 0);
    return { ...intent, id: `${intent.id}-revised`, amountUsd: Math.min(intent.amountUsd, remaining) };
  }
  // RISK_002 / LIQ_003 aren't sizing problems - halving the trade is the only
  // generic move available without new market information.
  return { ...intent, id: `${intent.id}-revised`, amountUsd: Math.floor(intent.amountUsd / 2) };
}

// ---------------------------------------------------------------------------
// Agent 2: Risk Officer - computes the safety score and stress-tests
// ---------------------------------------------------------------------------

/**
 * Projects the portfolio's holdings after an intent executes, without
 * mutating the input.
 * @param {Portfolio} portfolio
 * @param {Intent} intent
 * @returns {Record<string, number>}
 */
function projectHoldings(portfolio, intent) {
  const holdings = { ...portfolio.holdings };
  holdings[intent.from] = (holdings[intent.from] ?? 0) - intent.amountUsd;
  holdings[intent.to] = (holdings[intent.to] ?? 0) + intent.amountUsd;
  return holdings;
}

/**
 * Implements the risk formula from creance.md, inverted into a 0-100 safety
 * score so it reads naturally against `mandate.riskFloor` (higher = safer).
 *
 * safetyScore = 100 - (w1*depeg + w2*illiquidity + w3*concentration + w4*volatility) * 100
 *
 * Concentration is measured on total post-trade equity exposure (all of
 * `mandate.equityTickers` combined), not on whichever asset happens to be
 * `intent.to` - otherwise a sell into a stablecoin gets scored as if it were
 * increasing risk, when it's doing the opposite.
 *
 * @param {Intent} intent
 * @param {Portfolio} portfolio
 * @param {MarketSnapshot} market
 * @param {Mandate} mandate
 * @returns {RiskAssessment}
 */
function riskOfficerAgent(intent, portfolio, market, mandate) {
  const weights = { depeg: 0.35, liquidity: 0.25, concentration: 0.2, volatility: 0.2 };

  const stableSides = [intent.from, intent.to].filter(isStablecoin);
  const depegValues = stableSides.map((ticker) => {
    const value = market.depegRisk?.[ticker];
    // Missing depeg data is treated conservatively. It must never look like a
    // healthy peg simply because an oracle field was omitted.
    return typeof value === 'number' && Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 1;
  });
  const depegRisk = depegValues.length ? Math.max(...depegValues) : 0;
  const depegSource = stableSides.length
    ? stableSides.map((ticker) => hasVerifiedSource(market, [`${ticker}_DEPEG`, `${ticker}_DEPEG_RISK`, 'STABLECOIN_DEPEG', 'DEPEG_RISK'])
      ? `${ticker}: verified`
      : `${ticker}: heuristic (missing feed; conservative unknown)`).join(', ')
    : 'not applicable';

  // Liquidity is scored against whichever side of the trade isn't a
  // stablecoin (stablecoins are assumed deep unless a depth figure says
  // otherwise) - that's the side actually at risk of slippage.
  const illiquidTicker = isStablecoin(intent.to) ? intent.from : intent.to;
  const knownDepth = market.liquidityDepthUsd?.[illiquidTicker];
  const illiquidity = isStablecoin(illiquidTicker)
    ? 0
    : knownDepth > 0
      ? Math.min(intent.amountUsd / knownDepth, 1)
      : 1; // unknown depth for a non-stable asset is treated as fully illiquid, not free

  const projected = projectHoldings(portfolio, intent);
  const equityTickers = mandate.equityTickers ?? [];
  const equityValue = equityTickers.reduce((sum, t) => sum + Math.max(projected[t] ?? 0, 0), 0);
  const concentration = Math.min(equityValue / Math.max(portfolio.totalValue, 1), 1);

  const volatilityTicker = isStablecoin(intent.to) ? intent.from : intent.to;
  const volatility = market.volatility30d?.[volatilityTicker] ?? 0.5;

  const weightedPenalty =
    weights.depeg * depegRisk +
    weights.liquidity * illiquidity +
    weights.concentration * concentration +
    weights.volatility * volatility;

  const safetyScore = Math.max(0, Math.round(100 - weightedPenalty * 100));

  return {
    safetyScore,
    components: { depegRisk, illiquidity, concentration, volatility },
    signalSources: {
      depegRisk: depegSource,
      liquidityDepth: hasVerifiedSource(market, [`${illiquidTicker}_LIQUIDITY`, `${illiquidTicker}_LIQUIDITY_DEPTH`, 'LIQUIDITY_DEPTH'])
        ? `${illiquidTicker}: verified`
        : 'heuristic: liquidity depth is not verified; unknown depth treated as fully illiquid',
      volatility: hasVerifiedSource(market, [`${volatilityTicker}_VOLATILITY`, `${volatilityTicker}_VOLATILITY_30D`, 'VOLATILITY_30D', 'MARKET_VOLATILITY'])
        ? `${volatilityTicker}: verified`
        : 'heuristic: volatility is not verified',
    },
    criticalDepeg: false, // set by caller against mandate.depegCriticalThreshold
  };
}

// ---------------------------------------------------------------------------
// Agent 3: Policy Officer - the deterministic gate
// ---------------------------------------------------------------------------

/**
 * Every check here should have a 1:1 counterpart in the Solidity policy
 * contract. If you add a rule here, add it there too, or this module gives
 * the Treasurer false confidence the chain won't share.
 *
 * @param {Intent} intent
 * @param {RiskAssessment} risk
 * @param {Mandate} mandate
 * @param {Portfolio} portfolio
 * @returns {PolicyResult}
 */
function policyOfficerAgent(intent, risk, mandate, portfolio) {
  // Per-asset ceiling: only applies when the destination has an explicit
  // ceiling entry. A stablecoin destination is never checked here - moving
  // capital INTO USDC cannot breach an equity cap, only OUT of it.
  const assetCeilings = mandate.assetCeilings ?? {};
  if (!isStablecoin(intent.to) && assetCeilings[intent.to] !== undefined) {
    const projected = (portfolio.holdings[intent.to] ?? 0) + intent.amountUsd;
    const projectedWeight = projected / portfolio.totalValue;
    const ceiling = assetCeilings[intent.to];
    if (projectedWeight > ceiling) {
      return {
        permitted: false,
        code: 'CAP_001',
        reason: `Resulting ${intent.to} exposure ${(projectedWeight * 100).toFixed(1)}% would exceed its ${(ceiling * 100).toFixed(1)}% asset ceiling.`,
        requiresHumanApproval: false,
      };
    }
  }

  // Aggregate equity ceiling: only checked when the destination is itself
  // an equity/Stock Token. Selling equity into a stablecoin can only reduce
  // this figure, so it's never a candidate for CAP_001.
  const equityTickers = mandate.equityTickers ?? [];
  if (equityTickers.includes(intent.to)) {
    const projected = projectHoldings(portfolio, intent);
    const equityValue = equityTickers.reduce((sum, t) => sum + Math.max(projected[t] ?? 0, 0), 0);
    const equityWeight = equityValue / portfolio.totalValue;
    if (equityWeight > mandate.equityCeiling) {
      return {
        permitted: false,
        code: 'CAP_001',
        reason: `Resulting combined Stock Token exposure ${(equityWeight * 100).toFixed(1)}% would exceed the ${(mandate.equityCeiling * 100).toFixed(1)}% equity ceiling.`,
        requiresHumanApproval: false,
      };
    }
  }

  if (risk.safetyScore < mandate.riskFloor) {
    return {
      permitted: false,
      code: 'RISK_002',
      reason: `Safety score ${risk.safetyScore} is below the mandate floor of ${mandate.riskFloor}.`,
      requiresHumanApproval: false,
    };
  }

  const usdcBalance = portfolio.holdings['USDC'] ?? 0;
  const liquidAfter =
    usdcBalance - (intent.from === 'USDC' ? intent.amountUsd : 0) + (intent.to === 'USDC' ? intent.amountUsd : 0);
  if (liquidAfter < mandate.liquidityFloor) {
    return {
      permitted: false,
      code: 'LIQ_003',
      reason: `Executing would leave liquidity at $${formatUsd(Math.max(liquidAfter, 0))}, below the $${formatUsd(mandate.liquidityFloor)} floor.`,
      requiresHumanApproval: false,
    };
  }

  if (portfolio.spentToday + intent.amountUsd > mandate.dailySpendCap) {
    return {
      permitted: false,
      code: 'SPEND_004',
      reason: `Executing would push today's spend to $${formatUsd(portfolio.spentToday + intent.amountUsd)}, above the $${formatUsd(mandate.dailySpendCap)} daily cap.`,
      requiresHumanApproval: false,
    };
  }

  const requiresHumanApproval = intent.amountUsd >= mandate.approvalThresholds.review;

  return { permitted: true, code: 'CLEAR', reason: 'All mandate constraints satisfied.', requiresHumanApproval };
}

// ---------------------------------------------------------------------------
// Agent 4: Executor - turns an approved intent into an on-chain action
// ---------------------------------------------------------------------------

/**
 * Default no-op executor for tests/demos. Pass a real `onchainExecuteFn`
 * (e.g. a viem/ethers contract call) into `runAgenticLoop` for production use.
 * @param {Intent} intent
 * @returns {Promise<{ txHash: string }>}
 */
async function defaultExecutor(intent) {
  return { txHash: `0xSIMULATED_${intent.id}` };
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Runs the full Treasurer -> Risk Officer -> Policy Officer -> Executor loop,
 * with a bounded retry: if the Policy Officer rejects on a sizing-fixable
 * constraint, the Treasurer revises the intent and resubmits before giving up.
 *
 * @param {Object} params
 * @param {Portfolio} params.portfolio
 * @param {MarketSnapshot} params.market
 * @param {Mandate} params.mandate
 * @param {{ from: string, to: string, amountUsd: number, reason?: string }} [params.proposalOverride]
 * @param {(portfolio: Portfolio, market: MarketSnapshot, mandate: Mandate) => Intent} [params.proposeFn]
 * @param {(intent: Intent) => Promise<{ txHash: string }>} [params.onchainExecuteFn]
 * @param {(intent: Intent) => Promise<boolean>} [params.humanApprovalFn]
 * @param {number} [params.maxRetries]
 * @returns {Promise<{ outcome: 'EXECUTED' | 'REJECTED' | 'FROZEN' | 'AWAITING_HUMAN', log: ReturnType<typeof createAuditLog>, pendingIntent?: Intent }>}
 */
async function runAgenticLoop({
  portfolio,
  market,
  mandate,
  proposalOverride,
  proposeFn = treasurerAgent,
  onchainExecuteFn = defaultExecutor,
  humanApprovalFn,
  maxRetries = 2,
}) {
  const log = createAuditLog();

  let intent = proposeFn(portfolio, market, mandate, proposalOverride);
  log.emit('ProposalCreated', `${intent.reason} ($${formatUsd(intent.amountUsd)} ${intent.from} -> ${intent.to})`);

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const risk = riskOfficerAgent(intent, portfolio, market, mandate);
    risk.criticalDepeg = risk.components.depegRisk >= mandate.depegCriticalThreshold;
    log.emit('RiskVerified', `Safety score ${risk.safetyScore}/100. Depeg ${(risk.components.depegRisk * 100).toFixed(1)}%, concentration ${(risk.components.concentration * 100).toFixed(1)}%. Depeg data: ${risk.signalSources.depegRisk}.`);

    if (risk.criticalDepeg) {
      log.emit('EmergencyFreeze', `Depeg risk ${(risk.components.depegRisk * 100).toFixed(1)}% exceeds the critical threshold. New positions frozen regardless of the pending proposal.`, 'FREEZE_001');
      return { outcome: 'FROZEN', log };
    }

    const policy = policyOfficerAgent(intent, risk, mandate, portfolio);
    log.emit('PolicyChecked', policy.reason, policy.code);

    if (!policy.permitted) {
      log.emit('ApprovalRejected', policy.reason, policy.code);
      if (attempt === maxRetries) {
        return { outcome: 'REJECTED', log };
      }
      const revisedIntent = reviseIntent(intent, policy, mandate, portfolio);
      if (revisedIntent.amountUsd <= 0) {
        log.emit('ApprovalRejected', 'No positive compliant amount remains after applying the rejected constraint.', policy.code);
        return { outcome: 'REJECTED', log };
      }
      intent = revisedIntent;
      log.emit('ProposalCreated', `Revised: ${intent.reason} ($${formatUsd(intent.amountUsd)} ${intent.from} -> ${intent.to})`);
      continue;
    }

    if (policy.requiresHumanApproval) {
      log.emit('ApprovalRequested', `$${formatUsd(intent.amountUsd)} exceeds the auto-approval threshold; human sign-off required.`);
      if (!humanApprovalFn) {
        return { outcome: 'AWAITING_HUMAN', log, pendingIntent: intent };
      }
      const approved = await humanApprovalFn(intent);
      if (!approved) {
        log.emit('ApprovalRejected', 'Human operator declined the proposed intent.', 'HUMAN_001');
        return { outcome: 'REJECTED', log };
      }
    }

    log.emit('ApprovalGranted', 'Intent cleared for execution.', policy.code);
    const { txHash } = await onchainExecuteFn(intent);
    log.emit('TradeExecuted', `${intent.from} -> ${intent.to}, $${formatUsd(intent.amountUsd)}.`, txHash);
    return { outcome: 'EXECUTED', log };
  }

  // Unreachable, satisfies TS/JSDoc control-flow analysis.
  return { outcome: 'REJECTED', log };
}

export {
  runAgenticLoop,
  treasurerAgent,
  riskOfficerAgent,
  policyOfficerAgent,
  reviseIntent,
  defaultExecutor,
  createAuditLog,
};
