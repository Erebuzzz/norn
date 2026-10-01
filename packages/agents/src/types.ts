import type { Address, Hex } from "viem";
import type { SignedObligation } from "@norn/machine-payments";

export interface AgentAccountState {
  address: Address;
  cash: bigint;
  reserved: bigint;
  creditCapacity: bigint;
  outgoingObligations: SignedObligation[];
  incomingObligations: SignedObligation[];
  settledObligationIds: Set<Hex>;
}

export interface ClearingRequestResult {
  agentAddress: Address;
  grossOwed: bigint;
  grossReceivable: bigint;
  netPosition: bigint;
  settlementTransfers: {
    payer: Address;
    payee: Address;
    amount: bigint;
    asset: Address;
  }[];
  isNetDebtor: boolean;
  isNetCreditor: boolean;
}
