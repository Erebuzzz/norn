/**
 * Agent loop service — off-chain deliberation + on-chain CreancePolicy gate.
 */

import { runAgenticLoop, riskOfficerAgent } from '../agenticLoop.js';
import {
  getTreasuryState,
  applyLoopResult,
  clearPending,
  getPendingOnchainIntentId,
  setDelegateActive,
} from './treasuryState.js';
import {
  ensurePolicyGateway,
  getGatewayStatus,
  onchainSubmitDecision,
  onchainSetMandate,
  onchainApproveIntent,
  onchainMarkTradeExecuted,
  onchainRevokeDelegate,
} from '../chain/policyGateway.js';

async function withChain(opts = {}) {
  await ensurePolicyGateway();
  const snap = getTreasuryState();
  if (snap.delegate && snap.delegate.active === false) {
    return {
      outcome: 'REJECTED',
      log: {
        events: [
          {
            timestamp: Date.now(),
            event: 'ApprovalRejected',
            detail: 'REBALANCE delegate is revoked. Owner must grant a new scoped executor.',
            code: 'ROLE_REVOKED',
          },
        ],
      },
      treasury: snap,
      chain: getGatewayStatus(),
    };
  }

  const proposalOverride = {
    ...snap.activeProposal,
    ...(opts.proposal ?? {}),
  };

  const maxRetries = opts.maxRetries === undefined ? 0 : Number(opts.maxRetries);
  const humanApprovalFn = opts.approve === true ? async () => true : undefined;

  let executedIntent = null;
  let lastRisk = null;

  const result = await runAgenticLoop({
    portfolio: snap.portfolio,
    market: snap.market,
    mandate: snap.mandate,
    proposalOverride,
    maxRetries,
    humanApprovalFn,
    onchainPolicyFn: async ({ intent, risk, portfolio, mandate }) => {
      lastRisk = risk;
      return onchainSubmitDecision({ intent, risk, portfolio, mandate });
    },
    onchainExecuteFn: async (intent, ctx = {}) => {
      executedIntent = intent;
      const risk = ctx.risk || lastRisk || riskOfficerAgent(intent, snap.portfolio, snap.market, snap.mandate);
      const intentId = ctx.pendingOnchainIntentId;
      // Only call approveIntent when the prior submitDecision left a pending human gate.
      // Auto-cleared intents are already in approvedIntents.
      if (intentId && humanApprovalFn) {
        try {
          await onchainApproveIntent(intentId);
        } catch {
          /* already approved by submitDecision when under review threshold */
        }
      }
      return onchainMarkTradeExecuted({
        intent,
        risk,
        portfolio: snap.portfolio,
        mandate: snap.mandate,
        intentId,
      });
    },
  });

  const treasury = applyLoopResult({
    ...result,
    executedIntent,
    lastRisk: result.lastRisk || lastRisk,
  });

  return {
    outcome: result.outcome,
    pendingIntent: result.pendingIntent ?? null,
    log: { events: result.log.events },
    treasury,
    chain: getGatewayStatus(),
  };
}

export async function evaluateProposal(opts = {}) {
  const snap = getTreasuryState();
  if (snap.frozen) {
    return {
      outcome: 'FROZEN',
      log: { events: snap.audit },
      treasury: snap,
      chain: getGatewayStatus(),
      error: 'Treasury is frozen by emergency override. Reset required.',
    };
  }
  return withChain(opts);
}

export async function approvePendingIntent() {
  const snap = getTreasuryState();
  if (!snap.pendingIntent) {
    return { error: 'No pending intent awaiting approval', treasury: snap, chain: getGatewayStatus() };
  }

  const pending = snap.pendingIntent;
  const pendingId = getPendingOnchainIntentId();
  clearPending();

  let executedIntent = null;
  const risk = riskOfficerAgent(pending, snap.portfolio, snap.market, snap.mandate);

  // Owner approval on-chain, then executor marks trade executed
  let approveTx = null;
  if (pendingId) {
    approveTx = await onchainApproveIntent(pendingId);
  }

  const exec = await onchainMarkTradeExecuted({
    intent: pending,
    risk,
    portfolio: snap.portfolio,
    mandate: snap.mandate,
    intentId: pendingId,
  });
  executedIntent = pending;

  const logEvents = [
    ...(snap.audit || []),
    {
      timestamp: Date.now(),
      event: 'ApprovalGranted',
      detail: 'Owner approved pending intent on-chain.',
      code: 'CLEAR',
      txHash: approveTx?.txHash,
      explorerUrl: approveTx?.explorerUrl,
    },
    {
      timestamp: Date.now(),
      event: 'TradeExecuted',
      detail: `${pending.from} -> ${pending.to}, $${pending.amountUsd}.`,
      code: exec.txHash,
      txHash: exec.txHash,
      explorerUrl: exec.explorerUrl,
    },
  ];

  const treasury = applyLoopResult({
    outcome: 'EXECUTED',
    log: { events: logEvents },
    executedIntent,
    pendingIntent: null,
    pendingOnchainIntentId: null,
    lastRisk: risk,
  });

  return {
    outcome: 'EXECUTED',
    pendingIntent: null,
    log: { events: logEvents },
    treasury,
    chain: getGatewayStatus(),
  };
}

export async function syncMandateOnChain(patch) {
  const { updateMandate, appendAuditEvent } = await import('./treasuryState.js');
  updateMandate(patch);
  const chainTx = await onchainSetMandate(getTreasuryState().mandate);
  const treasury = appendAuditEvent({
    event: 'MandateUpdated',
    detail: `On-chain mandate updated (equity ceiling ${(getTreasuryState().mandate.equityCeiling * 100).toFixed(1)}%).`,
    code: 'MANDATE',
    txHash: chainTx.txHash,
    explorerUrl: chainTx.explorerUrl,
  });
  return { treasury, chainTx, chain: getGatewayStatus() };
}

/**
 * Demo reset: wipe off-chain treasury AND push default mandate (0.3 equity ceiling)
 * back on-chain so CAP_001 fires again without restarting the API.
 */
export async function resetTreasuryAndSyncChain() {
  const { resetTreasuryState, appendAuditEvent } = await import('./treasuryState.js');
  await ensurePolicyGateway();
  resetTreasuryState();
  const mandate = getTreasuryState().mandate;
  const chainTx = await onchainSetMandate(mandate);
  const treasury = appendAuditEvent({
    event: 'TreasuryReset',
    detail: `Off-chain treasury restored; on-chain mandate re-synced (equity ceiling ${(mandate.equityCeiling * 100).toFixed(1)}%).`,
    code: 'RESET',
    txHash: chainTx.txHash,
    explorerUrl: chainTx.explorerUrl,
  });
  return { treasury, chainTx, chain: getGatewayStatus() };
}

export async function revokeExecutorDelegate() {
  const { appendAuditEvent } = await import('./treasuryState.js');
  const chainTx = await onchainRevokeDelegate();
  setDelegateActive(false);
  const treasury = appendAuditEvent({
    event: 'DelegateRevoked',
    detail: `Owner revoked REBALANCE delegate ${chainTx.revoked}.`,
    code: 'ROLE_REVOKED',
    txHash: chainTx.txHash,
    explorerUrl: chainTx.explorerUrl,
  });
  return {
    treasury,
    chainTx,
    chain: getGatewayStatus(),
  };
}

export { getGatewayStatus, ensurePolicyGateway };
