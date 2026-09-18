/**
 * ZeroDev-shaped executor model (session key / scoped permissions).
 * Complements CreancePolicy — does not replace the mandate contract.
 * Real ZeroDev Project ID plugs in via CREANCE_ZERODEV_PROJECT_ID later.
 */

export function getExecutorModel() {
  const projectId = process.env.CREANCE_ZERODEV_PROJECT_ID || null;
  return {
    provider: 'zerodev',
    docs: 'https://docs.zerodev.app/',
    mode: projectId ? 'configured' : 'stand_in',
    projectIdConfigured: Boolean(projectId),
    roles: [
      {
        id: 'REBALANCE',
        permissions: ['submitDecision', 'markTradeExecuted'],
        assetAllowlist: ['USDG', 'USDC', 'AAPL', 'MSFT', 'NVDA', 'AMZN'],
        spendLimitUsd: 500_000,
        ttlHours: 168,
        revocable: true,
      },
      {
        id: 'YIELD',
        permissions: ['submitDecision'],
        assetAllowlist: ['USDG', 'USDC', 'PENDLE_PT_USDC'],
        spendLimitUsd: 150_000,
        ttlHours: 72,
        revocable: true,
        chainNote: 'Pendle venue is Arbitrum-only stretch; not on Robinhood Chain.',
      },
    ],
    principle: 'Owner never hands the agent a discretionary EOA. Session keys are scoped and instantly revocable; CreancePolicy still enforces the mandate on every intent.',
  };
}
