import {
  keccak256,
  encodePacked,
  hashTypedData,
  verifyTypedData,
  Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  type Address,
  type ObligationData,
  type SignedObligation,
  ObligationPriority,
  type EIP712DomainConfig,
} from "./types.js";

export const DEFAULT_EIP712_DOMAIN: EIP712DomainConfig = {
  name: "NORN Obligation Protocol",
  version: "1",
  chainId: 31337,
  verifyingContract: "0x0000000000000000000000000000000000000099",
};

export const OBLIGATION_EIP712_TYPES = {
  Obligation: [
    { name: "id", type: "bytes32" },
    { name: "payer", type: "address" },
    { name: "payee", type: "address" },
    { name: "asset", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "expiresAt", type: "uint256" },
    { name: "priority", type: "uint8" },
    { name: "referenceHash", type: "bytes32" },
  ],
} as const;

export interface AdapterOptions {
  domain?: Partial<EIP712DomainConfig>;
}

export interface ServicePaymentInput {
  service: string;
  provider: Address;
  priceUnits: bigint;
  asset: Address;
  referenceHash: Hex;
}

export class MachinePaymentAdapter {
  private domain: EIP712DomainConfig;
  private nonces = new Map<Address, bigint>();

  constructor(options: AdapterOptions = {}) {
    this.domain = {
      ...DEFAULT_EIP712_DOMAIN,
      ...options.domain,
    };
  }

  getDomain(): EIP712DomainConfig {
    return this.domain;
  }

  getNextNonce(payer: Address): bigint {
    const next = (this.nonces.get(payer) ?? 0n) + 1n;
    this.nonces.set(payer, next);
    return next;
  }

  async createSignedObligation(
    payerPrivateKey: Hex,
    paymentMeta: ServicePaymentInput,
    options: {
      priority?: ObligationPriority;
      ttlSeconds?: number;
      customNonce?: bigint;
    } = {}
  ): Promise<SignedObligation> {
    const account = privateKeyToAccount(payerPrivateKey);
    const payer = account.address;

    const nonce = options.customNonce ?? this.getNextNonce(payer);
    const ttl = options.ttlSeconds ?? 86400; // 24 hours
    const expiresAt = BigInt(Math.floor(Date.now() / 1000) + ttl);
    const priority = options.priority ?? ObligationPriority.NORMAL;

    const id = keccak256(
      encodePacked(
        ["address", "address", "address", "uint256", "uint256", "bytes32"],
        [
          payer,
          paymentMeta.provider,
          paymentMeta.asset,
          paymentMeta.priceUnits,
          nonce,
          paymentMeta.referenceHash,
        ]
      )
    );

    const obligation: ObligationData = {
      id,
      payer,
      payee: paymentMeta.provider,
      asset: paymentMeta.asset,
      amount: paymentMeta.priceUnits,
      nonce,
      expiresAt,
      priority,
      referenceHash: paymentMeta.referenceHash,
    };

    const signature = await account.signTypedData({
      domain: this.domain,
      types: OBLIGATION_EIP712_TYPES,
      primaryType: "Obligation",
      message: obligation,
    });

    const typedDataHash = hashTypedData({
      domain: this.domain,
      types: OBLIGATION_EIP712_TYPES,
      primaryType: "Obligation",
      message: obligation,
    });

    return {
      obligation,
      signature,
      signer: payer,
      typedDataHash,
      serviceName: paymentMeta.service,
    };
  }

  async verifySignedObligation(signedObligation: SignedObligation): Promise<boolean> {
    const { obligation, signature, signer } = signedObligation;

    return verifyTypedData({
      address: signer,
      domain: this.domain,
      types: OBLIGATION_EIP712_TYPES,
      primaryType: "Obligation",
      message: obligation,
      signature,
    });
  }
}
