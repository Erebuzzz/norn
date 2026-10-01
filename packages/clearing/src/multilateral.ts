import {
  Obligation,
  ParticipantNetBalance,
  SettlementTransfer,
  MultilateralNettingResult,
  Address,
  Bytes32,
} from "./types.js";

export interface GraphEdge {
  payer: Address;
  payee: Address;
  asset: Address;
  amount: bigint;
  sourceObligations: Obligation[];
}

export interface DirectedObligationGraph {
  nodes: Set<Address>;
  edges: GraphEdge[];
  adjacency: Map<string, GraphEdge[]>;
}

export function buildDirectedObligationGraph(
  obligations: Obligation[]
): DirectedObligationGraph {
  const nodes = new Set<Address>();
  const edgeMap = new Map<string, GraphEdge>();
  const adjacency = new Map<string, GraphEdge[]>();

  for (const ob of obligations) {
    nodes.add(ob.payer);
    nodes.add(ob.payee);

    const edgeKey = `${ob.asset.toLowerCase()}:${ob.payer.toLowerCase()}->${ob.payee.toLowerCase()}`;
    let edge = edgeMap.get(edgeKey);
    if (!edge) {
      edge = {
        payer: ob.payer,
        payee: ob.payee,
        asset: ob.asset,
        amount: 0n,
        sourceObligations: [],
      };
      edgeMap.set(edgeKey, edge);
    }
    edge.amount += ob.amount;
    edge.sourceObligations.push(ob);
  }

  const edges = Array.from(edgeMap.values());
  for (const edge of edges) {
    const payerKey = edge.payer.toLowerCase();
    const existing = adjacency.get(payerKey) ?? [];
    existing.push(edge);
    adjacency.set(payerKey, existing);
  }

  return { nodes, edges, adjacency };
}

export function computeParticipantNetBalances(
  obligations: Obligation[]
): Map<string, ParticipantNetBalance> {
  const balanceMap = new Map<string, ParticipantNetBalance>();

  for (const ob of obligations) {
    const payerKey = `${ob.asset.toLowerCase()}:${ob.payer.toLowerCase()}`;
    const payeeKey = `${ob.asset.toLowerCase()}:${ob.payee.toLowerCase()}`;

    let payerEntry = balanceMap.get(payerKey);
    if (!payerEntry) {
      payerEntry = {
        participant: ob.payer,
        asset: ob.asset,
        netBalance: 0n,
        grossIncoming: 0n,
        grossOutgoing: 0n,
      };
      balanceMap.set(payerKey, payerEntry);
    }
    payerEntry.grossOutgoing += ob.amount;
    payerEntry.netBalance -= ob.amount;

    let payeeEntry = balanceMap.get(payeeKey);
    if (!payeeEntry) {
      payeeEntry = {
        participant: ob.payee,
        asset: ob.asset,
        netBalance: 0n,
        grossIncoming: 0n,
        grossOutgoing: 0n,
      };
      balanceMap.set(payeeKey, payeeEntry);
    }
    payeeEntry.grossIncoming += ob.amount;
    payeeEntry.netBalance += ob.amount;
  }

  return balanceMap;
}

export function verifyConservationInvariant(
  netBalances: ParticipantNetBalance[]
): bigint {
  const assetDeltas = new Map<string, bigint>();

  for (const item of netBalances) {
    const assetKey = item.asset.toLowerCase();
    const current = assetDeltas.get(assetKey) ?? 0n;
    assetDeltas.set(assetKey, current + item.netBalance);
  }

  let totalAbsoluteDelta = 0n;
  for (const [asset, delta] of assetDeltas.entries()) {
    if (delta !== 0n) {
      totalAbsoluteDelta += delta < 0n ? -delta : delta;
      throw new Error(
        `Conservation invariant violation for asset ${asset}: sum(Net_i) is ${delta}, expected 0`
      );
    }
  }

  return totalAbsoluteDelta;
}

export function formulateSettlementTransfers(
  netBalances: ParticipantNetBalance[],
  obligations: Obligation[]
): SettlementTransfer[] {
  const obligationsByAssetAndPayer = new Map<string, Bytes32[]>();
  for (const ob of obligations) {
    const key = `${ob.asset.toLowerCase()}:${ob.payer.toLowerCase()}`;
    const list = obligationsByAssetAndPayer.get(key) ?? [];
    list.push(ob.id);
    obligationsByAssetAndPayer.set(key, list);
  }

  const assetGroups = new Map<string, ParticipantNetBalance[]>();
  for (const nb of netBalances) {
    const key = nb.asset.toLowerCase();
    const group = assetGroups.get(key) ?? [];
    group.push(nb);
    assetGroups.set(key, group);
  }

  const transfers: SettlementTransfer[] = [];

  for (const balances of assetGroups.values()) {
    const debtors: Array<{
      address: Address;
      remainingDebt: bigint;
      sourceObligations: Bytes32[];
    }> = [];

    const creditors: Array<{
      address: Address;
      remainingCredit: bigint;
    }> = [];

    for (const b of balances) {
      if (b.netBalance < 0n) {
        const debt = -b.netBalance;
        const key = `${b.asset.toLowerCase()}:${b.participant.toLowerCase()}`;
        const sourceObs = obligationsByAssetAndPayer.get(key) ?? [];
        debtors.push({
          address: b.participant,
          remainingDebt: debt,
          sourceObligations: Array.from(new Set(sourceObs)),
        });
      } else if (b.netBalance > 0n) {
        creditors.push({
          address: b.participant,
          remainingCredit: b.netBalance,
        });
      }
    }

    debtors.sort((a, b) => (b.remainingDebt > a.remainingDebt ? 1 : -1));
    creditors.sort((a, b) => (b.remainingCredit > a.remainingCredit ? 1 : -1));

    let d = 0;
    let c = 0;

    while (d < debtors.length && c < creditors.length) {
      const debtor = debtors[d];
      const creditor = creditors[c];

      const settleAmount =
        debtor.remainingDebt < creditor.remainingCredit
          ? debtor.remainingDebt
          : creditor.remainingCredit;

      if (settleAmount > 0n) {
        transfers.push({
          payer: debtor.address,
          payee: creditor.address,
          asset: balances[0].asset,
          amount: settleAmount,
          sourceObligations: debtor.sourceObligations,
        });

        debtor.remainingDebt -= settleAmount;
        creditor.remainingCredit -= settleAmount;
      }

      if (debtor.remainingDebt === 0n) {
        d++;
      }
      if (creditor.remainingCredit === 0n) {
        c++;
      }
    }
  }

  return transfers;
}

export function computeMultilateralNetting(
  obligations: Obligation[]
): MultilateralNettingResult {
  let grossVolume = 0n;
  for (const ob of obligations) {
    grossVolume += ob.amount;
  }

  if (obligations.length === 0) {
    return {
      netBalances: [],
      settlementTransfers: [],
      conservationDelta: 0n,
      grossVolume: 0n,
      netVolume: 0n,
      clearedCount: 0,
      transferCount: 0,
      efficiency: 0,
    };
  }

  const balanceMap = computeParticipantNetBalances(obligations);
  const netBalances = Array.from(balanceMap.values());

  const delta = verifyConservationInvariant(netBalances);
  const settlementTransfers = formulateSettlementTransfers(netBalances, obligations);

  let netVolume = 0n;
  for (const t of settlementTransfers) {
    netVolume += t.amount;
  }

  const efficiency =
    grossVolume > 0n
      ? Number(grossVolume - netVolume) / Number(grossVolume)
      : 0;

  return {
    netBalances,
    settlementTransfers,
    conservationDelta: delta,
    grossVolume,
    netVolume,
    clearedCount: obligations.length,
    transferCount: settlementTransfers.length,
    efficiency,
  };
}
