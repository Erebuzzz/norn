import { keccak256, toHex } from "viem";
import { type Address, type MachineService, type ServiceResponse, DEFAULT_SETTLEMENT_ASSET } from "../types.js";

export interface DataQuery {
  ticker?: string;
}

export interface MarketData {
  ticker: string;
  price: number;
  currency: string;
  volume24h: number;
  change24hPercent: number;
  lastUpdated: number;
}

export const DATA_PROVIDER_ADDRESS: Address = "0x7002000000000000000000000000000000000002";
export const DATA_PRICE = "0.02";
export const DATA_PRICE_UNITS = 20000n; // 0.02 USDC (6 decimals)

export async function handleData(
  params: DataQuery = {}
): Promise<ServiceResponse<MarketData>> {
  const ticker = (params.ticker ?? "BTC/USD").toUpperCase();
  const timestamp = Math.floor(Date.now() / 1000);

  const referenceHash = keccak256(
    toHex(`data:${ticker}:${timestamp}:${Math.random()}`)
  );

  const tickerPrices: Record<string, number> = {
    "BTC/USD": 94350.25,
    "ETH/USD": 2780.5,
    "USDG/USD": 1.0,
    "HOOD/USD": 38.65,
    "NVDA/USD": 142.8,
  };

  const price = tickerPrices[ticker] ?? 100.0;

  return {
    success: true,
    service: "data",
    timestamp,
    payment: {
      service: "data",
      provider: DATA_PROVIDER_ADDRESS,
      price: DATA_PRICE,
      priceUnits: DATA_PRICE_UNITS,
      asset: DEFAULT_SETTLEMENT_ASSET,
      paymentRequired: true,
      referenceHash,
    },
    data: {
      ticker,
      price,
      currency: "USD",
      volume24h: 18450200,
      change24hPercent: 2.34,
      lastUpdated: timestamp,
    },
  };
}

export const dataService: MachineService<DataQuery, MarketData> = {
  name: "data",
  endpoint: "/data",
  providerAddress: DATA_PROVIDER_ADDRESS,
  price: DATA_PRICE,
  priceUnits: DATA_PRICE_UNITS,
  asset: DEFAULT_SETTLEMENT_ASSET,
  execute: handleData,
};
