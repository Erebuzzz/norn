export type Address = `0x${string}`;
export type Bytes32 = `0x${string}`;
export type Hex = `0x${string}`;

export enum ObligationPriority {
  CRITICAL = 0,
  HIGH = 1,
  NORMAL = 2,
  NETTABLE = 3,
  DEFERRED = 4,
}

export enum ParticipantStatus {
  ACTIVE = 0,
  CONSTRAINED = 1,
  FROZEN = 2,
}

export enum ObligationStatus {
  NONE = 0,
  CREATED = 1,
  ACCEPTED = 2,
  CLEARED = 3,
  SETTLED = 4,
  REJECTED = 5,
  EXPIRED = 6,
  CANCELLED = 7,
}

export enum RiskRegime {
  NORMAL = 0,
  CONSTRAINED = 1,
  DEFENSIVE = 2,
  FROZEN = 3,
}

export enum BatchStatus {
  NONE = 0,
  COMMITTED = 1,
  CHALLENGED = 2,
  FINALIZED = 3,
  EXECUTED = 4,
}

export interface Participant {
  id: string;
  address: Address;
  status: ParticipantStatus | "ACTIVE" | "CONSTRAINED" | "FROZEN";
  settlementLimit: bigint;
  liquidityReserve: bigint;
  creditLimit: bigint;
  collateralValue: bigint;
  createdAt?: number;
}

export interface Obligation {
  id: Bytes32;
  payer: Address;
  payee: Address;
  asset: Address;
  amount: bigint;
  nonce: bigint;
  createdAt: number;
  expiresAt: number;
  priority: ObligationPriority | number;
  reference: string;
  referenceHash?: Bytes32;
  sourceProtocol?: string;
  collateralReference?: Bytes32;
  signature?: Hex;
  status?: ObligationStatus | number;
}

export interface SettlementTransfer {
  payer: Address;
  payee: Address;
  asset: Address;
  amount: bigint;
  sourceObligations: Bytes32[];
}

export interface ClearingBatch {
  batchId: Bytes32;
  epoch: bigint;
  obligationRoot: Bytes32;
  participantNetRoot: Bytes32;
  settlementRoot: Bytes32;
  createdAt: number;
  validUntil: number;
  regime: RiskRegime | number;
  solver: Address;
  solverBond: bigint;
  status?: BatchStatus | number;
  settlementTransfers?: SettlementTransfer[];
  clearedObligationIds?: Bytes32[];
  deferredObligationIds?: Bytes32[];
}

export interface LiquidityState {
  totalLiquidity: bigint;
  reservedLiquidity: bigint;
  availableLiquidity: bigint;
  requiredLiquidity: bigint;
  peakDemand: bigint;
}

export interface ParticipantNetBalance {
  participant: Address;
  asset: Address;
  netBalance: bigint;
  grossIncoming: bigint;
  grossOutgoing: bigint;
}

export interface BilateralNetPair {
  partyA: Address;
  partyB: Address;
  asset: Address;
  payer: Address;
  payee: Address;
  netAmount: bigint;
  grossPartyAToB: bigint;
  grossPartyBToA: bigint;
  sourceObligations: Obligation[];
}

export interface BilateralNettingResult {
  activePairs: BilateralNetPair[];
  fullyOffsetPairs: Array<{
    partyA: Address;
    partyB: Address;
    asset: Address;
    offsetAmount: bigint;
    sourceObligations: Obligation[];
  }>;
  grossVolume: bigint;
  netVolume: bigint;
  efficiency: number;
}

export interface MultilateralNettingResult {
  netBalances: ParticipantNetBalance[];
  settlementTransfers: SettlementTransfer[];
  conservationDelta: bigint;
  grossVolume: bigint;
  netVolume: bigint;
  clearedCount: number;
  transferCount: number;
  efficiency: number;
}

export interface ValidationFailure {
  obligation: Obligation;
  reason: string;
  code:
    | "EXPIRED"
    | "PAYER_FROZEN"
    | "PAYEE_FROZEN"
    | "DUPLICATE_NONCE"
    | "INVALID_SIGNATURE"
    | "INVALID_PARTIES"
    | "ZERO_AMOUNT"
    | "INVALID_ASSET";
}

export interface ValidationResult {
  valid: Obligation[];
  invalid: ValidationFailure[];
}

export interface LiquidityShortfall {
  participant: Address;
  asset: Address;
  availableLiquidity: bigint;
  debitAmount: bigint;
  requiredReserve: bigint;
  shortfall: bigint;
}

export interface ResolutionResult {
  acceptedObligations: Obligation[];
  deferredObligations: Obligation[];
  rejectedObligations: ValidationFailure[];
  settlementTransfers: SettlementTransfer[];
  netBalances: ParticipantNetBalance[];
  shortfalls: LiquidityShortfall[];
  isSafe: boolean;
  conservationDelta: bigint;
}
