import { keccak256, toHex } from "viem";
import { type Address, type MachineService, type ServiceResponse, DEFAULT_SETTLEMENT_ASSET } from "../types.js";

export interface WeatherQuery {
  stationId?: string;
  location?: string;
}

export interface WeatherReading {
  stationId: string;
  location: string;
  temperatureCelsius: number;
  relativeHumidityPercent: number;
  barometricPressureHpa: number;
  windSpeedKmh: number;
  airQualityIndex: number;
  sensorTimestamp: number;
}

export const WEATHER_PROVIDER_ADDRESS: Address = "0x7004000000000000000000000000000000000004";
export const WEATHER_PRICE = "0.005";
export const WEATHER_PRICE_UNITS = 5000n; // 0.005 USDC (6 decimals)

export async function handleWeather(
  params: WeatherQuery = {}
): Promise<ServiceResponse<WeatherReading>> {
  const stationId = params.stationId ?? "IOT-WEATHER-ALPHA-09";
  const location = params.location ?? "San Francisco, CA";
  const timestamp = Math.floor(Date.now() / 1000);

  const referenceHash = keccak256(
    toHex(`weather:${stationId}:${location}:${timestamp}:${Math.random()}`)
  );

  return {
    success: true,
    service: "weather",
    timestamp,
    payment: {
      service: "weather",
      provider: WEATHER_PROVIDER_ADDRESS,
      price: WEATHER_PRICE,
      priceUnits: WEATHER_PRICE_UNITS,
      asset: DEFAULT_SETTLEMENT_ASSET,
      paymentRequired: true,
      referenceHash,
    },
    data: {
      stationId,
      location,
      temperatureCelsius: 16.8,
      relativeHumidityPercent: 72,
      barometricPressureHpa: 1014.2,
      windSpeedKmh: 14.5,
      airQualityIndex: 28,
      sensorTimestamp: timestamp,
    },
  };
}

export const weatherService: MachineService<WeatherQuery, WeatherReading> = {
  name: "weather",
  endpoint: "/weather",
  providerAddress: WEATHER_PROVIDER_ADDRESS,
  price: WEATHER_PRICE,
  priceUnits: WEATHER_PRICE_UNITS,
  asset: DEFAULT_SETTLEMENT_ASSET,
  execute: handleWeather,
};
