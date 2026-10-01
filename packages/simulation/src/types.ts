export type Address = `0x${string}`;

export type AgentRole =
  | "consumer"
  | "service_provider"
  | "market_maker"
  | "treasury"
  | "arbitrageur";

export interface RiskProfile {
  maxNetDebit: bigint;
  reserveRatioBps: number;
  status: "ACTIVE" | "CONSTRAINED" | "FROZEN";
  criticalityTier: 1 | 2 | 3;
}

export interface Agent {
  id: Address;
  name: string;
  role: AgentRole;
  initialLiquidity: bigint;
  currentLiquidity: bigint;
  reservedLiquidity: bigint;
  creditLimit: bigint;
  riskProfile: RiskProfile;
}

export enum ObligationPriority {
  CRITICAL = 0,
  HIGH = 1,
  NORMAL = 2,
  NETTABLE = 3,
  DEFERRED = 4,
}

export type ObligationStatus =
  | "CREATED"
  | "ACCEPTED"
  | "CLEARED"
  | "SETTLED"
  | "DEFERRED"
  | "CANCELLED";

export interface Obligation {
  id: `0x${string}`;
  payer: Address;
  payee: Address;
  asset: Address;
  amount: bigint;
  nonce: bigint;
  createdAt: number;
  expiresAt: number;
  priority: ObligationPriority;
  referenceHash: `0x${string}`;
  status: ObligationStatus;
}

export interface SettlementTransfer {
  payer: Address;
  payee: Address;
  asset: Address;
  amount: bigint;
  sourceObligationIds?: `0x${string}`[];
}

export interface SimulationModeResult {
  mode: "A" | "B" | "C";
  modeName: string;
  transferCount: number;
  settlementVolume: bigint;
  peakLiquidityRequired: bigint;
  transfers: SettlementTransfer[];
  grossObligationVolume: bigint;
  grossObligationCount: number;
}

export interface StressEngineResult {
  initialBatch: SimulationModeResult;
  shockApplied: {
    liquidityReductionPercent: number;
    previousRegime: string;
    newRegime: string;
    reserveRatioBps: number;
  };
  isValid: boolean;
  invalidationReason?: string;
  breachingAgents: {
    agentId: Address;
    availableLiquidity: bigint;
    netDebit: bigint;
    requiredReserve: bigint;
    shortfall: bigint;
  }[];
  recoveredPlan: {
    settlementTransfers: SettlementTransfer[];
    transferCount: number;
    settlementVolume: bigint;
    clearedObligationCount: number;
    deferredObligationCount: number;
    allReservesSatisfied: boolean;
  };
}

export interface BenchmarkMetrics {
  grossObligationVolume: bigint;
  grossObligationCount: number;
  immediateSettlementVolume: bigint;
  immediateTransferCount: number;
  immediatePeakLiquidity: bigint;
  bilateralSettlementVolume: bigint;
  bilateralTransferCount: number;
  bilateralPeakLiquidity: bigint;
  nornSettlementVolume: bigint;
  nornTransferCount: number;
  nornPeakLiquidity: bigint;
  transferCompression: number;
  liquidityReduction: number;
  grossToNetRatio: number;
  bilateralTransferCompression: number;
}
