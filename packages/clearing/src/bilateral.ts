import {
  Obligation,
  BilateralNetPair,
  BilateralNettingResult,
  Address,
} from "./types.js";

function getCanonicalPair(
  addr1: Address,
  addr2: Address
): { partyA: Address; partyB: Address } {
  return addr1.toLowerCase() < addr2.toLowerCase()
    ? { partyA: addr1, partyB: addr2 }
    : { partyA: addr2, partyB: addr1 };
}

export function computeBilateralNetting(
  obligations: Obligation[]
): BilateralNettingResult {
  const pairGroups = new Map<
    string,
    {
      partyA: Address;
      partyB: Address;
      asset: Address;
      grossAToB: bigint;
      grossBToA: bigint;
      sourceObligations: Obligation[];
    }
  >();

  let grossVolume = 0n;

  for (const ob of obligations) {
    grossVolume += ob.amount;
    const { partyA, partyB } = getCanonicalPair(ob.payer, ob.payee);
    const key = `${ob.asset.toLowerCase()}:${partyA.toLowerCase()}:${partyB.toLowerCase()}`;

    let entry = pairGroups.get(key);
    if (!entry) {
      entry = {
        partyA,
        partyB,
        asset: ob.asset,
        grossAToB: 0n,
        grossBToA: 0n,
        sourceObligations: [],
      };
      pairGroups.set(key, entry);
    }

    entry.sourceObligations.push(ob);
    if (ob.payer.toLowerCase() === partyA.toLowerCase()) {
      entry.grossAToB += ob.amount;
    } else {
      entry.grossBToA += ob.amount;
    }
  }

  const activePairs: BilateralNetPair[] = [];
  const fullyOffsetPairs: Array<{
    partyA: Address;
    partyB: Address;
    asset: Address;
    offsetAmount: bigint;
    sourceObligations: Obligation[];
  }> = [];

  let netVolume = 0n;

  for (const group of pairGroups.values()) {
    if (group.grossAToB > group.grossBToA) {
      const netAmount = group.grossAToB - group.grossBToA;
      netVolume += netAmount;
      activePairs.push({
        partyA: group.partyA,
        partyB: group.partyB,
        asset: group.asset,
        payer: group.partyA,
        payee: group.partyB,
        netAmount,
        grossPartyAToB: group.grossAToB,
        grossPartyBToA: group.grossBToA,
        sourceObligations: group.sourceObligations,
      });
    } else if (group.grossBToA > group.grossAToB) {
      const netAmount = group.grossBToA - group.grossAToB;
      netVolume += netAmount;
      activePairs.push({
        partyA: group.partyA,
        partyB: group.partyB,
        asset: group.asset,
        payer: group.partyB,
        payee: group.partyA,
        netAmount,
        grossPartyAToB: group.grossAToB,
        grossPartyBToA: group.grossBToA,
        sourceObligations: group.sourceObligations,
      });
    } else {
      fullyOffsetPairs.push({
        partyA: group.partyA,
        partyB: group.partyB,
        asset: group.asset,
        offsetAmount: group.grossAToB,
        sourceObligations: group.sourceObligations,
      });
    }
  }

  const efficiency =
    grossVolume > 0n
      ? Number(grossVolume - netVolume) / Number(grossVolume)
      : 0;

  return {
    activePairs,
    fullyOffsetPairs,
    grossVolume,
    netVolume,
    efficiency,
  };
}

export function netBilateralPair(
  party1: Address,
  party2: Address,
  asset: Address,
  obligations: Obligation[]
): BilateralNetPair | null {
  const filtered = obligations.filter(
    (ob) =>
      ob.asset.toLowerCase() === asset.toLowerCase() &&
      ((ob.payer.toLowerCase() === party1.toLowerCase() &&
        ob.payee.toLowerCase() === party2.toLowerCase()) ||
        (ob.payer.toLowerCase() === party2.toLowerCase() &&
          ob.payee.toLowerCase() === party1.toLowerCase()))
  );

  const result = computeBilateralNetting(filtered);
  return result.activePairs[0] ?? null;
}
