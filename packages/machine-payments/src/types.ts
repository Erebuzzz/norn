export type Address = `0x${string}`;
export type Hex = `0x${string}`;

export enum ObligationPriority {
  CRITICAL = 0,
  HIGH = 1,
  NORMAL = 2,
  NETTABLE = 3,
  DEFERRED = 4,
}

export interface ObligationData {
  id: Hex;
  payer: Address;
  payee: Address;
  asset: Address;
  amount: bigint;
  nonce: bigint;
  expiresAt: bigint;
  priority: number;
  referenceHash: Hex;
}

export interface SignedObligation {
  obligation: ObligationData;
  signature: Hex;
  signer: Address;
  typedDataHash: Hex;
  serviceName: string;
}

export interface EIP712DomainConfig {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: Address;
}
