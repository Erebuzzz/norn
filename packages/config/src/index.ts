export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  fallbackRpcUrls?: string[];
  faucetUrls?: string[];
  currency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorerUrl?: string;
}

export const NETWORKS: Record<string, NetworkConfig> = {
  robinhood: {
    chainId: 46630,
    name: "Robinhood Chain",
    rpcUrl: process.env.ROBINHOOD_CHAIN_RPC_URL || "https://rpc.testnet.robinhood.com",
    fallbackRpcUrls: [
      "https://rpc.testnet.chain.robinhood.com",
      "https://rpc.robinhood.com",
    ],
    faucetUrls: ["https://faucet.testnet.chain.robinhood.com/"],
    currency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    blockExplorerUrl: "https://explorer.testnet.chain.robinhood.com",
  },
  arbitrumSepolia: {
    chainId: 421614,
    name: "Arbitrum Sepolia",
    rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
    faucetUrls: [
      "https://arbitrum.faucet.dev/",
      "https://faucet.quicknode.com/arbitrum/sepolia",
      "https://www.l2faucet.com/arbitrum",
      "https://faucet.circle.com/",
    ],
    currency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    blockExplorerUrl: "https://sepolia.arbiscan.io",
  },
  arbitrumOne: {
    chainId: 42161,
    name: "Arbitrum One",
    rpcUrl: process.env.ARBITRUM_ONE_RPC_URL || "https://arb1.arbitrum.io/rpc",
    fallbackRpcUrls: [
      "https://rpc.ankr.com/arbitrum",
      "https://arbitrum.llamarpc.com",
    ],
    currency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    blockExplorerUrl: "https://arbiscan.io",
  },
  local: {
    chainId: 1337,
    name: "NORN Local Testbed",
    rpcUrl: "http://127.0.0.1:8545",
    currency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
  },
};

export const PROTOCOL_CONSTANTS = {
  VERSION: "2.0.0",
  PROTOCOL_NAME: "NORN Obligation Protocol",
  PRIMARY_CHAIN_ID: 46630,
  DEFAULT_EPOCH_DURATION_SECONDS: 3600,
  MAX_SETTLEMENT_BATCH_SIZE: 1000,
  
  // Reserve ratio regimes (1e18 WAD basis)
  RESERVE_THRESHOLDS: {
    NORMAL: 3000n,       // 30.00%
    CONSTRAINED: 2000n,  // 20.00%
    DEFENSIVE: 1000n,    // 10.00%
    FROZEN: 0n,
  },

  // Priority tiers
  PRIORITIES: {
    CRITICAL: 0,
    HIGH: 1,
    NORMAL: 2,
    NETTABLE: 3,
    DEFERRED: 4,
  },

  // Machine micro-service default prices in USD (1e6 fixed point)
  SERVICE_PRICES_USDC_6DEC: {
    SEARCH: 10_000n,     // $0.01
    DATA: 20_000n,       // $0.02
    INFERENCE: 50_000n,  // $0.05
    WEATHER: 5_000n,     // $0.005
    COMPUTE: 100_000n,   // $0.10
  },
};
