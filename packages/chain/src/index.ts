import {
  defineChain,
  createPublicClient,
  http,
  type PublicClient,
  type Address,
} from "viem";
import { arbitrumSepolia } from "viem/chains";
import { NETWORKS } from "@norn/config";

export const robinhoodChain = defineChain({
  id: 46630,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.ROBINHOOD_CHAIN_RPC_URL || "https://rpc.robinhood.com"],
    },
  },
  blockExplorers: {
    default: {
      name: "Robinhood Explorer",
      url: "https://explorer.robinhood.com",
    },
  },
});

export { arbitrumSepolia };

export interface NORNContractAddresses {
  participantRegistry: Address;
  obligationRegistry: Address;
  clearingHouse: Address;
  liquidityManager: Address;
  settlementController: Address;
  riskController: Address;
  emergencyController: Address;
  usdgToken?: Address;
  usdcToken?: Address;
}

export const DEPLOYED_ADDRESSES: Record<number, NORNContractAddresses> = {
  46630: {
    participantRegistry: "0x1111111111111111111111111111111111110001",
    obligationRegistry: "0x2222222222222222222222222222222222220002",
    clearingHouse: "0x3333333333333333333333333333333333330003",
    liquidityManager: "0x4444444444444444444444444444444444440004",
    settlementController: "0x5555555555555555555555555555555555550005",
    riskController: "0x6666666666666666666666666666666666660006",
    emergencyController: "0x7777777777777777777777777777777777770007",
    usdgToken: "0x8888888888888888888888888888888888880008",
    usdcToken: "0x9999999999999999999999999999999999990009",
  },
  421614: {
    participantRegistry: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    obligationRegistry: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    clearingHouse: "0xcccccccccccccccccccccccccccccccccccccccc",
    liquidityManager: "0xdddddddddddddddddddddddddddddddddddddddd",
    settlementController: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    riskController: "0xffffffffffffffffffffffffffffffffffffffff",
    emergencyController: "0x1212121212121212121212121212121212121212",
  },
};

export function getContractAddresses(chainId: number): NORNContractAddresses {
  const addresses = DEPLOYED_ADDRESSES[chainId];
  if (!addresses) {
    throw new Error(`No deployed contract addresses configured for chain ID ${chainId}`);
  }
  return addresses;
}

export function createRobinhoodClient(customRpcUrl?: string): PublicClient {
  return createPublicClient({
    chain: robinhoodChain,
    transport: http(customRpcUrl || NETWORKS.robinhood.rpcUrl),
  });
}

export function createArbitrumSepoliaClient(customRpcUrl?: string): PublicClient {
  return createPublicClient({
    chain: arbitrumSepolia,
    transport: http(customRpcUrl || NETWORKS.arbitrumSepolia.rpcUrl),
  });
}
