import {
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  concatHex,
  stringToHex,
  padHex,
} from "viem";
import {
  Obligation,
  ParticipantNetBalance,
  SettlementTransfer,
  ClearingBatch,
  RiskRegime,
  Address,
  Bytes32,
} from "./types.js";
import { computeReferenceHash } from "./validation.js";

export const EMPTY_ROOT: Bytes32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

export function hashPair(left: Bytes32, right: Bytes32): Bytes32 {
  return left.toLowerCase() <= right.toLowerCase()
    ? keccak256(concatHex([left, right]))
    : keccak256(concatHex([right, left]));
}

export function buildMerkleTree(leafHashes: Bytes32[]): {
  root: Bytes32;
  layers: Bytes32[][];
} {
  if (leafHashes.length === 0) {
    return { root: EMPTY_ROOT, layers: [[]] };
  }

  const sortedLeaves = [...leafHashes].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );

  const layers: Bytes32[][] = [sortedLeaves];
  let currentLayer = sortedLeaves;

  while (currentLayer.length > 1) {
    const nextLayer: Bytes32[] = [];
    for (let i = 0; i < currentLayer.length; i += 2) {
      if (i + 1 < currentLayer.length) {
        nextLayer.push(hashPair(currentLayer[i], currentLayer[i + 1]));
      } else {
        nextLayer.push(currentLayer[i]);
      }
    }
    layers.push(nextLayer);
    currentLayer = nextLayer;
  }

  return { root: currentLayer[0], layers };
}

export function generateMerkleProof(
  leafHashes: Bytes32[],
  targetLeaf: Bytes32
): Bytes32[] {
  const { layers } = buildMerkleTree(leafHashes);
  const proof: Bytes32[] = [];

  let index = layers[0].findIndex(
    (h) => h.toLowerCase() === targetLeaf.toLowerCase()
  );
  if (index === -1) {
    return proof;
  }

  for (let i = 0; i < layers.length - 1; i++) {
    const currentLayer = layers[i];
    const isRightNode = index % 2 === 1;
    const siblingIndex = isRightNode ? index - 1 : index + 1;

    if (siblingIndex < currentLayer.length) {
      proof.push(currentLayer[siblingIndex]);
    }
    index = Math.floor(index / 2);
  }

  return proof;
}

export function verifyMerkleProof(
  proof: Bytes32[],
  root: Bytes32,
  leaf: Bytes32
): boolean {
  let computedHash = leaf;
  for (const proofElement of proof) {
    computedHash = hashPair(computedHash, proofElement);
  }
  return computedHash.toLowerCase() === root.toLowerCase();
}

export function computeObligationLeaf(ob: Obligation): Bytes32 {
  const refHash =
    ob.referenceHash ?? computeReferenceHash(ob.reference || "");

  const idBytes32 = padHex(ob.id, { size: 32 });
  const refHashBytes32 = padHex(refHash, { size: 32 });

  return keccak256(
    encodeAbiParameters(
      parseAbiParameters(
        "bytes32, address, address, address, uint256, uint256, uint256, uint8, bytes32"
      ),
      [
        idBytes32,
        ob.payer,
        ob.payee,
        ob.asset,
        ob.amount,
        ob.nonce,
        BigInt(ob.expiresAt),
        Number(ob.priority),
        refHashBytes32,
      ]
    )
  );
}

export function computeParticipantNetLeaf(nb: ParticipantNetBalance): Bytes32 {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters("address, address, int256"),
      [nb.participant, nb.asset, nb.netBalance]
    )
  );
}

export function computeSettlementLeaf(transfer: SettlementTransfer): Bytes32 {
  const sourceBytes32 = transfer.sourceObligations.map((id) =>
    padHex(id, { size: 32 })
  );

  return keccak256(
    encodeAbiParameters(
      parseAbiParameters("address, address, address, uint256, bytes32[]"),
      [
        transfer.payer,
        transfer.payee,
        transfer.asset,
        transfer.amount,
        sourceBytes32,
      ]
    )
  );
}

export function computeObligationRoot(obligations: Obligation[]): Bytes32 {
  if (obligations.length === 0) return EMPTY_ROOT;
  const leaves = obligations.map(computeObligationLeaf);
  return buildMerkleTree(leaves).root;
}

export function computeParticipantNetRoot(
  netBalances: ParticipantNetBalance[]
): Bytes32 {
  if (netBalances.length === 0) return EMPTY_ROOT;
  const leaves = netBalances.map(computeParticipantNetLeaf);
  return buildMerkleTree(leaves).root;
}

export function computeSettlementRoot(
  transfers: SettlementTransfer[]
): Bytes32 {
  if (transfers.length === 0) return EMPTY_ROOT;
  const leaves = transfers.map(computeSettlementLeaf);
  return buildMerkleTree(leaves).root;
}

export function computeBatchId(
  epoch: bigint,
  obligationRoot: Bytes32,
  participantNetRoot: Bytes32,
  settlementRoot: Bytes32
): Bytes32 {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters("uint256, bytes32, bytes32, bytes32"),
      [epoch, obligationRoot, participantNetRoot, settlementRoot]
    )
  );
}

export interface BatchCommitmentParams {
  epoch: bigint;
  solver: Address;
  solverBond: bigint;
  validUntil: number;
  regime: RiskRegime;
  obligations: Obligation[];
  netBalances: ParticipantNetBalance[];
  settlementTransfers: SettlementTransfer[];
}

export function generateClearingCommitments(
  params: BatchCommitmentParams
): ClearingBatch {
  const obligationRoot = computeObligationRoot(params.obligations);
  const participantNetRoot = computeParticipantNetRoot(params.netBalances);
  const settlementRoot = computeSettlementRoot(params.settlementTransfers);

  const batchId = computeBatchId(
    params.epoch,
    obligationRoot,
    participantNetRoot,
    settlementRoot
  );

  return {
    batchId,
    epoch: params.epoch,
    obligationRoot,
    participantNetRoot,
    settlementRoot,
    createdAt: Math.floor(Date.now() / 1000),
    validUntil: params.validUntil,
    regime: params.regime,
    solver: params.solver,
    solverBond: params.solverBond,
    settlementTransfers: params.settlementTransfers,
    clearedObligationIds: params.obligations.map((o) => o.id),
  };
}
