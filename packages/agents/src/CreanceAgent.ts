import type { Address, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { MachinePaymentAdapter, ObligationPriority, type SignedObligation } from "@norn/machine-payments";
import { dispatchServiceRequest, type ServiceResponse } from "@norn/services";
import type { AgentAccountState, ClearingRequestResult } from "./types.js";

export interface CreanceAgentConfig {
  privateKey: Hex;
  initialCash?: bigint;
  creditCapacity?: bigint;
  adapter?: MachinePaymentAdapter;
}

export class CreanceAgent {
  public readonly address: Address;
  private readonly privateKey: Hex;
  private adapter: MachinePaymentAdapter;

  private cash: bigint;
  private reserved: bigint;
  private creditCapacity: bigint;
  private outgoingObligations: SignedObligation[] = [];
  private incomingObligations: SignedObligation[] = [];
  private settledObligationIds = new Set<Hex>();

  constructor(config: CreanceAgentConfig) {
    this.privateKey = config.privateKey;
    const account = privateKeyToAccount(this.privateKey);
    this.address = account.address;

    this.cash = config.initialCash ?? 100000000n; // 100 USDC default (6 decimals)
    this.reserved = 0n;
    this.creditCapacity = config.creditCapacity ?? 50000000n; // 50 USDC credit
    this.adapter = config.adapter ?? new MachinePaymentAdapter();
  }

  getState(): AgentAccountState {
    return {
      address: this.address,
      cash: this.cash,
      reserved: this.reserved,
      creditCapacity: this.creditCapacity,
      outgoingObligations: [...this.outgoingObligations],
      incomingObligations: [...this.incomingObligations],
      settledObligationIds: new Set(this.settledObligationIds),
    };
  }

  // 1. Call a machine micro-service, generate EIP-712 payment obligation, and accumulate
  async callService<T = any>(
    serviceEndpointOrName: string,
    params?: unknown,
    options: { priority?: ObligationPriority } = {}
  ): Promise<{ response: ServiceResponse<T>; obligation: SignedObligation }> {
    const response = await dispatchServiceRequest(serviceEndpointOrName, params);

    const signedObligation = await this.adapter.createSignedObligation(
      this.privateKey,
      {
        service: response.payment.service,
        provider: response.payment.provider,
        priceUnits: response.payment.priceUnits,
        asset: response.payment.asset,
        referenceHash: response.payment.referenceHash,
      },
      {
        priority: options.priority ?? ObligationPriority.NORMAL,
      }
    );

    this.outgoingObligations.push(signedObligation);

    return {
      response,
      obligation: signedObligation,
    };
  }

  // 2. Receive an obligation from a counterparty
  async receiveObligation(signedObligation: SignedObligation): Promise<boolean> {
    const isValid = await this.adapter.verifySignedObligation(signedObligation);
    if (!isValid) {
      throw new Error(`Invalid signature on incoming obligation ${signedObligation.obligation.id}`);
    }

    if (signedObligation.obligation.payee.toLowerCase() !== this.address.toLowerCase()) {
      throw new Error(`Obligation payee does not match agent address`);
    }

    this.incomingObligations.push(signedObligation);
    return true;
  }

  // 3. Accumulate multiple obligations
  accumulateObligations(obligations: SignedObligation[]): void {
    for (const ob of obligations) {
      if (ob.obligation.payer.toLowerCase() === this.address.toLowerCase()) {
        this.outgoingObligations.push(ob);
      } else if (ob.obligation.payee.toLowerCase() === this.address.toLowerCase()) {
        this.incomingObligations.push(ob);
      }
    }
  }

  // 4. Request NORN clearing for accumulated obligations
  requestClearing(): ClearingRequestResult {
    let grossOwed = 0n;
    let grossReceivable = 0n;

    for (const outOb of this.outgoingObligations) {
      grossOwed += outOb.obligation.amount;
    }

    for (const inOb of this.incomingObligations) {
      grossReceivable += inOb.obligation.amount;
    }

    // Net position: receivables minus payables
    const netPosition = grossReceivable - grossOwed;
    const isNetDebtor = netPosition < 0n;
    const isNetCreditor = netPosition > 0n;

    const settlementTransfers: {
      payer: Address;
      payee: Address;
      amount: bigint;
      asset: Address;
    }[] = [];

    const defaultAsset =
      this.outgoingObligations[0]?.obligation.asset ??
      this.incomingObligations[0]?.obligation.asset ??
      ("0x1111111111111111111111111111111111111111" as Address);

    if (isNetDebtor) {
      // Agent owes net difference to the clearing pool
      settlementTransfers.push({
        payer: this.address,
        payee: "0x0000000000000000000000000000000000000000", // pool/clearing counterparty
        amount: -netPosition,
        asset: defaultAsset,
      });
    } else if (isNetCreditor) {
      // Agent receives net difference
      settlementTransfers.push({
        payer: "0x0000000000000000000000000000000000000000",
        payee: this.address,
        amount: netPosition,
        asset: defaultAsset,
      });
    }

    return {
      agentAddress: this.address,
      grossOwed,
      grossReceivable,
      netPosition,
      settlementTransfers,
      isNetDebtor,
      isNetCreditor,
    };
  }

  // 5. Execute settlement of the cleared net position
  settle(clearingResult: ClearingRequestResult): {
    previousCash: bigint;
    newCash: bigint;
    netDelta: bigint;
    settledCount: number;
  } {
    const previousCash = this.cash;

    if (clearingResult.isNetDebtor) {
      const debit = -clearingResult.netPosition;
      if (this.cash < debit) {
        throw new Error(
          `Insufficient liquidity to settle net position: required ${debit}, available ${this.cash}`
        );
      }
      this.cash -= debit;
    } else if (clearingResult.isNetCreditor) {
      this.cash += clearingResult.netPosition;
    }

    const settledCount = this.outgoingObligations.length + this.incomingObligations.length;

    for (const ob of this.outgoingObligations) {
      this.settledObligationIds.add(ob.obligation.id);
    }
    for (const ob of this.incomingObligations) {
      this.settledObligationIds.add(ob.obligation.id);
    }

    this.outgoingObligations = [];
    this.incomingObligations = [];

    return {
      previousCash,
      newCash: this.cash,
      netDelta: clearingResult.netPosition,
      settledCount,
    };
  }
}
