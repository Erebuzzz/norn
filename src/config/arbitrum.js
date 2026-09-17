/**
 * Chain targets for Creance.
 * Primary demo path: Robinhood Chain Stock Tokens + USDG.
 * Dry-run: Arbitrum Sepolia. Pendle stretch: Arbitrum One only (no RH Pendle).
 */

export const ARBITRUM_ONE = {
  chainId: 42161,
  name: 'Arbitrum One',
  shortName: 'arb1',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: 'https://arb1.arbitrum.io/rpc',
    public: 'https://arb1.arbitrum.io/rpc',
  },
  blockExplorer: 'https://arbiscan.io',
  wrappedNative: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
};

export const ARBITRUM_SEPOLIA = {
  chainId: 421614,
  name: 'Arbitrum Sepolia',
  shortName: 'arb-sep',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    // From Arbitrum docs — not in Resources paste RPC list
    default: process.env.CREANCE_ARB_SEPOLIA_RPC || 'https://sepolia-rollup.arbitrum.io/rpc',
  },
  blockExplorer: 'https://sepolia.arbiscan.io',
  faucets: {
    eth: 'https://arbitrum.faucet.dev/',
    usdc: 'https://faucet.circle.com/',
  },
};

/**
 * Robinhood Chain — MUST-TOUCH for Stock Token CAP_001 demo.
 * RPC/chainId filled from env / Robinhood docs when available (Resources paste omits RH RPC).
 */
export const ROBINHOOD_CHAIN = {
  name: 'Robinhood Chain',
  shortName: 'rh',
  docs: 'https://docs.robinhood.com/chain/',
  faucet: 'https://faucet.testnet.chain.robinhood.com/',
  // Defaults from https://docs.robinhood.com/chain/connecting/ (testnet)
  chainId: process.env.CREANCE_RH_CHAIN_ID ? Number(process.env.CREANCE_RH_CHAIN_ID) : 46630,
  rpcUrls: {
    default: process.env.CREANCE_RH_RPC || 'https://rpc.testnet.chain.robinhood.com',
  },
  blockExplorer: process.env.CREANCE_RH_EXPLORER || 'https://explorer.testnet.chain.robinhood.com',
  role: 'primary_stock_token_demo',
  note: 'Deploy CreancePolicy here for the Stock Token mandate demo. Allowlist + USDG liquidity.',
};

export const ASSET_UNIVERSE = {
  stablecoins: ['USDG', 'USDC', 'USDT'],
  stockTokens: ['AAPL', 'MSFT', 'NVDA', 'AMZN'],
  yieldVenues: ['PENDLE_PT_USDC'],
  native: ['ETH'],
};

export const ARBITRUM_TOKENS = {
  USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  WETH: ARBITRUM_ONE.wrappedNative,
  PENDLE: '0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8',
  // USDG venue address: set when Paxos/RH listing address is confirmed
  USDG: process.env.CREANCE_USDG_ADDRESS || null,
};

export const PENDLE_ARBITRUM = {
  chainId: 42161,
  source: 'pendle-finance/pendle-core-v2-public/deployments/42161-core.json',
  router: '0x888888888889758F76e7103c6CbF23ABbF58F946',
  routerStatic: '0xAdB09F65bd90d19e3148D9ccb693F3161C6DB3E8',
  pyYtLpOracle: '0x5542be50420E88dd7D5B4a3D488FA6ED82F6DAc2',
  marketFactory: '0xf5a7De2D276dbda3EEf1b62A9E718EFf4d29dDC8',
  note: 'Arbitrum-only stretch. No RH Pendle in public core. Thin policy-capped router call or skip name-drop.',
};

export function getChainConfig() {
  return {
    demoPrimary: ROBINHOOD_CHAIN,
    dryRun: ARBITRUM_SEPOLIA,
    arbitrumOne: ARBITRUM_ONE,
    tokens: ARBITRUM_TOKENS,
    pendle: PENDLE_ARBITRUM,
    assetUniverse: ASSET_UNIVERSE,
    policyContract: {
      name: 'CreancePolicy',
      solidityOnly: true,
      stylus: 'skip_v1',
      oz: 'Ownable',
      status: 'artifact_ready',
      deployedAddress: process.env.CREANCE_POLICY_ADDRESS || null,
      note: 'Local Ganache boots automatically for API. Set CREANCE_RPC_URL + CREANCE_PRIVATE_KEY + CREANCE_POLICY_ADDRESS for RH / Arb Sepolia.',
    },
    zerodev: {
      role: 'scoped_executor_session_keys',
      docs: 'https://docs.zerodev.app/',
      replacesPolicy: false,
    },
  };
}
