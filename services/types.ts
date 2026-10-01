export type Address = `0x${string}`;

export const DEFAULT_SETTLEMENT_ASSET: Address = "0x1111111111111111111111111111111111111111";

export interface ServicePaymentMetadata {
  service: string;
  provider: Address;
  price: string;
  priceUnits: bigint;
  asset: Address;
  paymentRequired: true;
  referenceHash: `0x${string}`;
}

export interface ServiceResponse<T = Record<string, unknown>> {
  success: boolean;
  service: string;
  timestamp: number;
  payment: ServicePaymentMetadata;
  data: T;
}

export interface MachineService<TReq = unknown, TRes = Record<string, unknown>> {
  name: string;
  endpoint: string;
  providerAddress: Address;
  price: string;
  priceUnits: bigint;
  asset: Address;
  execute(params?: TReq): Promise<ServiceResponse<TRes>>;
}
