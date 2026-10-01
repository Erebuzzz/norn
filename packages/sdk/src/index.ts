import {
  keccak256,
  stringToHex,
  encodePacked,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";

export enum ObligationPriority {
  CRITICAL = 0,
  HIGH = 1,
  NORMAL = 2,
  NETTABLE = 3,
  DEFERRED = 4,
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

export interface ObligationParams {
  id: Hex;
  payer: Address;
  payee: Address;
  asset: Address;
  amount: bigint;
  nonce: bigint;
  expiresAt: bigint;
  priority: ObligationPriority;
  referenceHash: Hex;
}

export interface SignedObligation {
  params: ObligationParams;
  signature: Hex;
}

export interface NORNConfig {
  chainId: number;
  obligationRegistryAddress: Address;
  clearingHouseAddress?: Address;
  liquidityManagerAddress?: Address;
  riskControllerAddress?: Address;
  publicClient: PublicClient;
  walletClient?: WalletClient;
}

export class NORNClient {
  public config: NORNConfig;

  constructor(config: NORNConfig) {
    this.config = config;
  }

  public createObligation(data: {
    payer: Address;
    payee: Address;
    asset: Address;
    amount: bigint;
    nonce: bigint;
    expiresInSeconds?: number;
    priority?: ObligationPriority;
    reference?: string;
  }): ObligationParams {
    const reference = data.reference || `ref-${Date.now()}-${data.nonce}`;
    const referenceHash = keccak256(stringToHex(reference));
    const expiresIn = BigInt(data.expiresInSeconds || 86400);
    const expiresAt = BigInt(Math.floor(Date.now() / 1000)) + expiresIn;

    const id = keccak256(
      encodePacked(
        ["address", "address", "address", "uint256", "uint256", "uint256"],
        [data.payer, data.payee, data.asset, data.amount, data.nonce, expiresAt]
      )
    );

    return {
      id,
      payer: data.payer,
      payee: data.payee,
      asset: data.asset,
      amount: data.amount,
      nonce: data.nonce,
      expiresAt,
      priority: data.priority ?? ObligationPriority.NORMAL,
      referenceHash,
    };
  }

  public async signObligation(params: ObligationParams): Promise<Hex> {
    if (!this.config.walletClient || !this.config.walletClient.account) {
      throw new Error("WalletClient with active account required for signing obligations.");
    }

    const domain = {
      name: "NORN Obligation Protocol",
      version: "1",
      chainId: this.config.chainId,
      verifyingContract: this.config.obligationRegistryAddress,
    };

    const types = {
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
    };

    const signature = await this.config.walletClient.signTypedData({
      domain,
      types,
      primaryType: "Obligation",
      message: params,
    });

    return signature;
  }
}
