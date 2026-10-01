import { keccak256, toHex } from "viem";
import { type Address, type MachineService, type ServiceResponse, DEFAULT_SETTLEMENT_ASSET } from "../types.js";

export interface InferenceQuery {
  prompt?: string;
  model?: string;
  maxTokens?: number;
}

export interface InferenceResult {
  model: string;
  completion: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: "stop" | "length";
}

export const INFERENCE_PROVIDER_ADDRESS: Address = "0x7003000000000000000000000000000000000003";
export const INFERENCE_PRICE = "0.05";
export const INFERENCE_PRICE_UNITS = 50000n; // 0.05 USDC (6 decimals)

export async function handleInference(
  params: InferenceQuery = {}
): Promise<ServiceResponse<InferenceResult>> {
  const prompt = params.prompt ?? "Evaluate current network liquidity risk.";
  const model = params.model ?? "deepseek-r1-distill-qwen-32b";
  const timestamp = Math.floor(Date.now() / 1000);

  const referenceHash = keccak256(
    toHex(`inference:${prompt}:${model}:${timestamp}:${Math.random()}`)
  );

  return {
    success: true,
    service: "inference",
    timestamp,
    payment: {
      service: "inference",
      provider: INFERENCE_PROVIDER_ADDRESS,
      price: INFERENCE_PRICE,
      priceUnits: INFERENCE_PRICE_UNITS,
      asset: DEFAULT_SETTLEMENT_ASSET,
      paymentRequired: true,
      referenceHash,
    },
    data: {
      model,
      completion: `[INFERENCE OUTPUT]: Obligation graph density is optimal. Multilateral netting index is 84.6%. Solvency margin healthy under current epoch constraints.`,
      usage: {
        promptTokens: 24,
        completionTokens: 38,
        totalTokens: 62,
      },
      finishReason: "stop",
    },
  };
}

export const inferenceService: MachineService<InferenceQuery, InferenceResult> = {
  name: "inference",
  endpoint: "/inference",
  providerAddress: INFERENCE_PROVIDER_ADDRESS,
  price: INFERENCE_PRICE,
  priceUnits: INFERENCE_PRICE_UNITS,
  asset: DEFAULT_SETTLEMENT_ASSET,
  execute: handleInference,
};
