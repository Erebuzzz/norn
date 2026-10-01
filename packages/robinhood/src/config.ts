import { defineChain, type Chain, type Address } from "viem";

export const ROBINHOOD_CHAIN_ID = 46630;

export const ROBINHOOD_CHAIN_CONFIG = {
  chainId: ROBINHOOD_CHAIN_ID,
  chainName: "Robinhood Chain Testnet",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: "https://rpc.testnet.robinhood.com",
    fallback: "https://rpc.testnet.chain.robinhood.com",
    quicknode: "https://robinhood-testnet.quiknode.pro",
  },
  blockExplorerUrls: {
    default: "https://explorer.testnet.chain.robinhood.com",
  },
} as const;

export const robinhoodTestnet: Chain = defineChain({
  id: ROBINHOOD_CHAIN_ID,
  name: ROBINHOOD_CHAIN_CONFIG.chainName,
  nativeCurrency: ROBINHOOD_CHAIN_CONFIG.nativeCurrency,
  rpcUrls: {
    default: {
      http: [ROBINHOOD_CHAIN_CONFIG.rpcUrls.default],
    },
  },
  blockExplorers: {
    default: {
      name: "Robinhood Chain Explorer",
      url: ROBINHOOD_CHAIN_CONFIG.blockExplorerUrls.default,
    },
  },
  contracts: {},
});

export const ROBINHOOD_DOCS = {
  overview: "https://docs.robinhood.com/chain/",
  connecting: "https://docs.robinhood.com/chain/connecting/",
  deploySmartContracts: "https://docs.robinhood.com/chain/deploy-smart-contracts/",
  contracts: "https://docs.robinhood.com/chain/contracts/",
  stockTokens: "https://docs.robinhood.com/chain/stock-tokens/",
  stockTokenApis: "https://docs.robinhood.com/chain/stock-token-apis/",
  faucet: "https://faucet.testnet.chain.robinhood.com/",
} as const;

export const STOCK_TOKEN_SECURITY_GUIDANCE = {
  rule: "Distinguish canonical contract addresses rather than trusting ticker or name alone.",
  warning:
    "ERC-20 token contracts on EVM chains can be deployed by any party with arbitrary ticker symbols and names. Protocols accepting Stock Tokens as collateral or settlement references must never identify assets by ticker symbol string alone. Every asset must be validated against a pinned canonical contract address registered by verified issuers.",
  recommendations: [
    "Always resolve tokens via immutable or governance-managed canonical address registries.",
    "Reject any token transaction whose contract address does not match the canonical map.",
    "Ensure oracle price feeds and corporate action feeds are strictly linked to canonical contract addresses.",
  ],
} as const;

export interface CanonicalStockToken {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
  oracleAddress: Address;
  issuer: string;
}

export const CANONICAL_STOCK_TOKENS: Record<string, CanonicalStockToken> = {
  HOOD: {
    symbol: "HOOD",
    name: "Robinhood Markets Inc. Token",
    address: "0x4663000000000000000000000000000000000001",
    decimals: 18,
    oracleAddress: "0x4663000000000000000000000000000000000011",
    issuer: "Robinhood Financial LLC",
  },
  AAPL: {
    symbol: "AAPL",
    name: "Apple Inc. Token",
    address: "0x4663000000000000000000000000000000000002",
    decimals: 18,
    oracleAddress: "0x4663000000000000000000000000000000000012",
    issuer: "Robinhood Financial LLC",
  },
  NVDA: {
    symbol: "NVDA",
    name: "NVIDIA Corporation Token",
    address: "0x4663000000000000000000000000000000000003",
    decimals: 18,
    oracleAddress: "0x4663000000000000000000000000000000000013",
    issuer: "Robinhood Financial LLC",
  },
  TSLA: {
    symbol: "TSLA",
    name: "Tesla Inc. Token",
    address: "0x4663000000000000000000000000000000000004",
    decimals: 18,
    oracleAddress: "0x4663000000000000000000000000000000000014",
    issuer: "Robinhood Financial LLC",
  },
  MSFT: {
    symbol: "MSFT",
    name: "Microsoft Corporation Token",
    address: "0x4663000000000000000000000000000000000005",
    decimals: 18,
    oracleAddress: "0x4663000000000000000000000000000000000015",
    issuer: "Robinhood Financial LLC",
  },
};

export const CANONICAL_SETTLEMENT_ASSETS = {
  USDG: {
    symbol: "USDG",
    name: "Paxos USDG Token",
    address: "0x4663000000000000000000000000000000000100" as Address,
    decimals: 6,
    issuer: "Paxos Trust Company",
  },
  USDC: {
    symbol: "USDC",
    name: "Circle USD Coin",
    address: "0x4663000000000000000000000000000000000101" as Address,
    decimals: 6,
    issuer: "Circle Internet Financial",
  },
} as const;

export const MOCK_SETTLEMENT_ASSETS = {
  TESTNET_MOCK_USDG: {
    symbol: "TESTNET_MOCK_USDG",
    name: "Testnet Mock USDG (NOT ACTUAL USDG)",
    address: "0x4663000000000000000000000000000000000999" as Address,
    decimals: 6,
    isMock: true,
  },
  TESTNET_MOCK_USDC: {
    symbol: "TESTNET_MOCK_USDC",
    name: "Testnet Mock USDC (NOT ACTUAL USDC)",
    address: "0x4663000000000000000000000000000000000998" as Address,
    decimals: 6,
    isMock: true,
  },
} as const;

export function isCanonicalStockTokenAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  return Object.values(CANONICAL_STOCK_TOKENS).some(
    (token) => token.address.toLowerCase() === normalized
  );
}

export function getCanonicalStockTokenBySymbol(
  symbol: string
): CanonicalStockToken | undefined {
  const key = symbol.toUpperCase();
  return CANONICAL_STOCK_TOKENS[key];
}

export function getCanonicalStockTokenByAddress(
  address: string
): CanonicalStockToken | undefined {
  const normalized = address.toLowerCase();
  return Object.values(CANONICAL_STOCK_TOKENS).find(
    (token) => token.address.toLowerCase() === normalized
  );
}

export function verifyCanonicalStockToken(
  symbol: string,
  contractAddress: string
): boolean {
  const canonical = getCanonicalStockTokenBySymbol(symbol);
  if (!canonical) {
    return false;
  }
  return canonical.address.toLowerCase() === contractAddress.toLowerCase();
}
