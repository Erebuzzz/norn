import { keccak256, toHex } from "viem";
import { type Address, type MachineService, type ServiceResponse, DEFAULT_SETTLEMENT_ASSET } from "../types.js";

export interface SearchQuery {
  query?: string;
  limit?: number;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  relevanceScore: number;
}

export const SEARCH_PROVIDER_ADDRESS: Address = "0x7001000000000000000000000000000000000001";
export const SEARCH_PRICE = "0.01";
export const SEARCH_PRICE_UNITS = 10000n; // 0.01 USDC (6 decimals)

export async function handleSearch(
  params: SearchQuery = {}
): Promise<ServiceResponse<{ query: string; totalResults: number; results: SearchResult[] }>> {
  const query = params.query ?? "autonomous machine clearing protocol";
  const limit = params.limit ?? 3;
  const timestamp = Math.floor(Date.now() / 1000);

  const referenceHash = keccak256(
    toHex(`search:${query}:${timestamp}:${Math.random()}`)
  );

  const sampleResults: SearchResult[] = [
    {
      title: "NORN Protocol Specification",
      url: "https://norn.network/spec/v1",
      snippet: "Decentralized multilateral obligation routing and liquidity netting engine.",
      relevanceScore: 0.98,
    },
    {
      title: "Autonomous Agent Payment Standards",
      url: "https://standards.machines.org/eip712-clearing",
      snippet: "Cryptographic obligation signing guidelines for high-frequency machine economies.",
      relevanceScore: 0.89,
    },
    {
      title: "Liquidity Conservation in Graph Netting",
      url: "https://research.loom.io/conservation-proofs",
      snippet: "Zero-sum conservation properties in directed machine credit graphs.",
      relevanceScore: 0.82,
    },
  ];

  return {
    success: true,
    service: "search",
    timestamp,
    payment: {
      service: "search",
      provider: SEARCH_PROVIDER_ADDRESS,
      price: SEARCH_PRICE,
      priceUnits: SEARCH_PRICE_UNITS,
      asset: DEFAULT_SETTLEMENT_ASSET,
      paymentRequired: true,
      referenceHash,
    },
    data: {
      query,
      totalResults: sampleResults.length,
      results: sampleResults.slice(0, limit),
    },
  };
}

export const searchService: MachineService<SearchQuery, { query: string; totalResults: number; results: SearchResult[] }> = {
  name: "search",
  endpoint: "/search",
  providerAddress: SEARCH_PROVIDER_ADDRESS,
  price: SEARCH_PRICE,
  priceUnits: SEARCH_PRICE_UNITS,
  asset: DEFAULT_SETTLEMENT_ASSET,
  execute: handleSearch,
};
