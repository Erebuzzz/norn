import {
  recoverTypedDataAddress,
  keccak256,
  stringToHex,
  isAddressEqual,
  zeroAddress,
} from "viem";
import {
  Obligation,
  Participant,
  ParticipantStatus,
  ValidationResult,
  ValidationFailure,
  Bytes32,
  Address,
} from "./types.js";

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

export interface ValidationOptions {
  currentTimestamp?: number;
  participants?: Map<string, Participant> | ((address: Address) => Participant | undefined);
  usedNonces?: Set<string>;
  requireSignature?: boolean;
  eip712Domain?: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract?: Address;
  };
}

export function computeReferenceHash(reference: string): Bytes32 {
  return keccak256(stringToHex(reference));
}

export function isParticipantFrozen(participant?: Participant): boolean {
  if (!participant) return false;
  return (
    participant.status === ParticipantStatus.FROZEN ||
    participant.status === "FROZEN"
  );
}

function resolveParticipant(
  address: Address,
  source?: Map<string, Participant> | ((addr: Address) => Participant | undefined)
): Participant | undefined {
  if (!source) return undefined;
  if (typeof source === "function") {
    return source(address);
  }
  return source.get(address.toLowerCase());
}

export async function validateObligation(
  obligation: Obligation,
  options: ValidationOptions = {},
  seenNoncesInBatch?: Set<string>
): Promise<ValidationFailure | null> {
  const currentTimestamp =
    options.currentTimestamp ?? Math.floor(Date.now() / 1000);

  if (!obligation.payer || !obligation.payee) {
    return {
      obligation,
      reason: "Payer and payee addresses are required",
      code: "INVALID_PARTIES",
    };
  }

  if (
    isAddressEqual(obligation.payer, zeroAddress) ||
    isAddressEqual(obligation.payee, zeroAddress)
  ) {
    return {
      obligation,
      reason: "Payer or payee cannot be zero address",
      code: "INVALID_PARTIES",
    };
  }

  if (isAddressEqual(obligation.payer, obligation.payee)) {
    return {
      obligation,
      reason: "Payer and payee cannot be identical",
      code: "INVALID_PARTIES",
    };
  }

  if (!obligation.asset || isAddressEqual(obligation.asset, zeroAddress)) {
    return {
      obligation,
      reason: "Asset address cannot be empty or zero",
      code: "INVALID_ASSET",
    };
  }

  if (obligation.amount <= 0n) {
    return {
      obligation,
      reason: "Obligation amount must be strictly greater than zero",
      code: "ZERO_AMOUNT",
    };
  }

  if (obligation.expiresAt <= currentTimestamp) {
    return {
      obligation,
      reason: `Obligation expired at ${obligation.expiresAt} (current: ${currentTimestamp})`,
      code: "EXPIRED",
    };
  }

  if (options.participants) {
    const payerParticipant = resolveParticipant(obligation.payer, options.participants);
    if (payerParticipant && isParticipantFrozen(payerParticipant)) {
      return {
        obligation,
        reason: `Payer participant ${obligation.payer} is currently frozen`,
        code: "PAYER_FROZEN",
      };
    }

    const payeeParticipant = resolveParticipant(obligation.payee, options.participants);
    if (payeeParticipant && isParticipantFrozen(payeeParticipant)) {
      return {
        obligation,
        reason: `Payee participant ${obligation.payee} is currently frozen`,
        code: "PAYEE_FROZEN",
      };
    }
  }

  const nonceKey = `${obligation.payer.toLowerCase()}:${obligation.nonce.toString()}`;
  if (seenNoncesInBatch && seenNoncesInBatch.has(nonceKey)) {
    return {
      obligation,
      reason: `Duplicate nonce ${obligation.nonce} for payer ${obligation.payer} in batch`,
      code: "DUPLICATE_NONCE",
    };
  }

  if (options.usedNonces && options.usedNonces.has(nonceKey)) {
    return {
      obligation,
      reason: `Nonce ${obligation.nonce} already executed for payer ${obligation.payer}`,
      code: "DUPLICATE_NONCE",
    };
  }

  if (obligation.signature) {
    const domain = options.eip712Domain ?? {
      name: "NORN Obligation Protocol",
      version: "1",
      chainId: 31337,
      verifyingContract: obligation.asset,
    };

    const referenceHash =
      obligation.referenceHash ?? computeReferenceHash(obligation.reference || "");

    try {
      const recoveredSigner = await recoverTypedDataAddress({
        domain,
        types: OBLIGATION_EIP712_TYPES,
        primaryType: "Obligation",
        message: {
          id: obligation.id,
          payer: obligation.payer,
          payee: obligation.payee,
          asset: obligation.asset,
          amount: obligation.amount,
          nonce: obligation.nonce,
          expiresAt: BigInt(obligation.expiresAt),
          priority: Number(obligation.priority),
          referenceHash,
        },
        signature: obligation.signature,
      });

      if (!isAddressEqual(recoveredSigner, obligation.payer)) {
        return {
          obligation,
          reason: `Recovered signer ${recoveredSigner} does not match payer ${obligation.payer}`,
          code: "INVALID_SIGNATURE",
        };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        obligation,
        reason: `Cryptographic signature verification failed: ${message}`,
        code: "INVALID_SIGNATURE",
      };
    }
  } else if (options.requireSignature) {
    return {
      obligation,
      reason: "Missing mandatory cryptographic signature for obligation",
      code: "INVALID_SIGNATURE",
    };
  }

  return null;
}

export async function validateObligations(
  obligations: Obligation[],
  options: ValidationOptions = {}
): Promise<ValidationResult> {
  const valid: Obligation[] = [];
  const invalid: ValidationFailure[] = [];
  const seenNoncesInBatch = new Set<string>();

  for (const obligation of obligations) {
    const failure = await validateObligation(
      obligation,
      options,
      seenNoncesInBatch
    );

    if (failure) {
      invalid.push(failure);
    } else {
      const nonceKey = `${obligation.payer.toLowerCase()}:${obligation.nonce.toString()}`;
      seenNoncesInBatch.add(nonceKey);
      valid.push(obligation);
    }
  }

  return { valid, invalid };
}
