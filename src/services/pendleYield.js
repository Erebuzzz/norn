/**
 * Pendle yield surfaces for the treasury cell.
 *
 * Mode:
 * - mock (default): deterministic APY / maturity figures for product demo path
 * - live_refs: same surfaces annotated with real Arbitrum Pendle core addresses
 *
 * Live market discovery (routerStatic / subgraph) is a follow-on; this module
 * never presents mock APYs as verified oracle data.
 */

import { PENDLE_ARBITRUM, ARBITRUM_TOKENS } from '../config/arbitrum.js';

const MOCK_SURFACES = [
  {
    id: 'pendle-usdc-pt',
    venue: 'Pendle',
    chainId: 42161,
    underlying: 'USDC',
    instrument: 'PT',
    label: 'PT-USDC fixed yield sleeve',
    impliedApyBps: 480,
    maturity: '2026-12-18',
    liquidityUsd: 42_000_000,
    role: 'stablecoin_yield',
    dataMode: 'mock',
    dataLabel: 'heuristic surface (not a live Pendle quote)',
  },
  {
    id: 'pendle-usdc-yt',
    venue: 'Pendle',
    chainId: 42161,
    underlying: 'USDC',
    instrument: 'YT',
    label: 'YT-USDC floating yield sleeve',
    impliedApyBps: 620,
    maturity: '2026-12-18',
    liquidityUsd: 18_500_000,
    role: 'stablecoin_yield',
    dataMode: 'mock',
    dataLabel: 'heuristic surface (not a live Pendle quote)',
  },
  {
    id: 'pendle-eth-pt',
    venue: 'Pendle',
    chainId: 42161,
    underlying: 'ETH',
    instrument: 'PT',
    label: 'PT-ETH fixed yield sleeve',
    impliedApyBps: 310,
    maturity: '2026-09-25',
    liquidityUsd: 65_000_000,
    role: 'native_yield',
    dataMode: 'mock',
    dataLabel: 'heuristic surface (not a live Pendle quote)',
  },
];

/**
 * @param {{ mode?: 'mock' | 'live_refs' }} [opts]
 */
export function listPendleYieldSurfaces(opts = {}) {
  const mode = opts.mode === 'live_refs' ? 'live_refs' : 'mock';
  const surfaces = MOCK_SURFACES.map((surface) => ({
    ...surface,
    dataMode: mode,
    dataLabel:
      mode === 'live_refs'
        ? 'core addresses live on Arbitrum; APY/maturity remain heuristic until routerStatic quotes are wired'
        : surface.dataLabel,
    integration: {
      router: PENDLE_ARBITRUM.router,
      routerStatic: PENDLE_ARBITRUM.routerStatic,
      pyYtLpOracle: PENDLE_ARBITRUM.pyYtLpOracle,
      underlyingToken: ARBITRUM_TOKENS[surface.underlying] ?? null,
    },
  }));

  return {
    mode,
    chainId: 42161,
    core: {
      router: PENDLE_ARBITRUM.router,
      routerStatic: PENDLE_ARBITRUM.routerStatic,
      pyYtLpOracle: PENDLE_ARBITRUM.pyYtLpOracle,
      marketFactory: PENDLE_ARBITRUM.marketFactory,
      source: PENDLE_ARBITRUM.source,
    },
    surfaces,
    note:
      'Yield sleeves feed Treasurer proposals as optional destinations. Policy still gates every allocation against the mandate.',
  };
}

/**
 * Suggest a Pendle sleeve when idle USDC exceeds a soft target.
 * Used by the agent service as an optional proposal hint — not auto-execution.
 *
 * @param {{ holdings: Record<string, number>, totalValue: number }} portfolio
 */
export function suggestYieldSleeve(portfolio) {
  const usdc = portfolio.holdings.USDC ?? 0;
  const idleWeight = usdc / Math.max(portfolio.totalValue, 1);
  if (idleWeight < 0.55) return null;

  const surface = MOCK_SURFACES.find((s) => s.id === 'pendle-usdc-pt');
  return {
    from: 'USDC',
    to: 'PENDLE_PT_USDC',
    amountUsd: Math.round(usdc * 0.1),
    reason: `Idle USDC at ${(idleWeight * 100).toFixed(1)}%; consider ${surface.label} (${(surface.impliedApyBps / 100).toFixed(2)}% implied APY, heuristic).`,
    surfaceId: surface.id,
    dataLabel: surface.dataLabel,
  };
}
