import { searchService, handleSearch, SEARCH_PROVIDER_ADDRESS, SEARCH_PRICE, SEARCH_PRICE_UNITS } from "./search/index.js";
import { dataService, handleData, DATA_PROVIDER_ADDRESS, DATA_PRICE, DATA_PRICE_UNITS } from "./data/index.js";
import { inferenceService, handleInference, INFERENCE_PROVIDER_ADDRESS, INFERENCE_PRICE, INFERENCE_PRICE_UNITS } from "./inference/index.js";
import { weatherService, handleWeather, WEATHER_PROVIDER_ADDRESS, WEATHER_PRICE, WEATHER_PRICE_UNITS } from "./weather/index.js";
import { computeService, handleCompute, COMPUTE_PROVIDER_ADDRESS, COMPUTE_PRICE, COMPUTE_PRICE_UNITS } from "./compute/index.js";
import type { MachineService, ServiceResponse } from "./types.js";

export * from "./types.js";
export * from "./search/index.js";
export * from "./data/index.js";
export * from "./inference/index.js";
export * from "./weather/index.js";
export * from "./compute/index.js";

export const ALL_SERVICES: Record<string, MachineService<any, any>> = {
  "/search": searchService,
  "/data": dataService,
  "/inference": inferenceService,
  "/weather": weatherService,
  "/compute": computeService,
  search: searchService,
  data: dataService,
  inference: inferenceService,
  weather: weatherService,
  compute: computeService,
};

export async function dispatchServiceRequest(
  endpointOrName: string,
  params?: unknown
): Promise<ServiceResponse<any>> {
  const service = ALL_SERVICES[endpointOrName];
  if (!service) {
    throw new Error(`Unknown machine service: ${endpointOrName}. Available: /search, /data, /inference, /weather, /compute`);
  }
  return service.execute(params);
}
