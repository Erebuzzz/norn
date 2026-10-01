import { keccak256, toHex } from "viem";
import { type Address, type MachineService, type ServiceResponse, DEFAULT_SETTLEMENT_ASSET } from "../types.js";

export interface ComputeJobRequest {
  jobType?: "matrix_mul" | "hash_batch" | "proof_generation";
  workloadSize?: number;
}

export interface ComputeJobReceipt {
  jobId: string;
  clusterId: string;
  jobType: string;
  flopsExecuted: string;
  durationMs: number;
  completedAt: number;
  outputDigest: `0x${string}`;
}

export const COMPUTE_PROVIDER_ADDRESS: Address = "0x7005000000000000000000000000000000000005";
export const COMPUTE_PRICE = "0.10";
export const COMPUTE_PRICE_UNITS = 100000n; // 0.10 USDC (6 decimals)

export async function handleCompute(
  params: ComputeJobRequest = {}
): Promise<ServiceResponse<ComputeJobReceipt>> {
  const jobType = params.jobType ?? "proof_generation";
  const workloadSize = params.workloadSize ?? 1024;
  const timestamp = Math.floor(Date.now() / 1000);

  const referenceHash = keccak256(
    toHex(`compute:${jobType}:${workloadSize}:${timestamp}:${Math.random()}`)
  );

  const outputDigest = keccak256(
    toHex(`output-batch-${referenceHash}-${workloadSize}`)
  );

  return {
    success: true,
    service: "compute",
    timestamp,
    payment: {
      service: "compute",
      provider: COMPUTE_PROVIDER_ADDRESS,
      price: COMPUTE_PRICE,
      priceUnits: COMPUTE_PRICE_UNITS,
      asset: DEFAULT_SETTLEMENT_ASSET,
      paymentRequired: true,
      referenceHash,
    },
    data: {
      jobId: `gpu-${timestamp}-${Math.floor(Math.random() * 10000)}`,
      clusterId: "NVIDIA-H100-CLUSTER-US-EAST",
      jobType,
      flopsExecuted: "1.42e15",
      durationMs: 48,
      completedAt: timestamp,
      outputDigest,
    },
  };
}

export const computeService: MachineService<ComputeJobRequest, ComputeJobReceipt> = {
  name: "compute",
  endpoint: "/compute",
  providerAddress: COMPUTE_PROVIDER_ADDRESS,
  price: COMPUTE_PRICE,
  priceUnits: COMPUTE_PRICE_UNITS,
  asset: DEFAULT_SETTLEMENT_ASSET,
  execute: handleCompute,
};
