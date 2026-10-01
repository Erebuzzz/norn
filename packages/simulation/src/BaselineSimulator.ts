import type { Obligation, SettlementTransfer, SimulationModeResult, Address, Agent } from "./types.js";

export interface SimulatorOptions {
  agents?: Agent[];
}

export class BaselineSimulator {
  private agentMap: Map<Address, Agent>;

  constructor(options: SimulatorOptions = {}) {
    this.agentMap = new Map();
    if (options.agents) {
      for (const agent of options.agents) {
        this.agentMap.set(agent.id, agent);
      }
    }
  }

  // Mode A: Immediate Settlement (RTGS - each obligation settles independently)
  simulateModeA(obligations: Obligation[]): SimulationModeResult {
    const transfers: SettlementTransfer[] = [];
    let settlementVolume = 0n;

    // Peak liquidity: In immediate gross settlement, payers need gross liquidity
    // to fund all their obligations as they arise without credit for incoming ones.
    const grossOutflows = new Map<Address, bigint>();

    for (const ob of obligations) {
      transfers.push({
        payer: ob.payer,
        payee: ob.payee,
        asset: ob.asset,
        amount: ob.amount,
        sourceObligationIds: [ob.id],
      });
      settlementVolume += ob.amount;

      const curOutflow = grossOutflows.get(ob.payer) ?? 0n;
      grossOutflows.set(ob.payer, curOutflow + ob.amount);
    }

    let peakLiquidityRequired = 0n;
    for (const outflow of grossOutflows.values()) {
      peakLiquidityRequired += outflow;
    }

    return {
      mode: "A",
      modeName: "Immediate Settlement (RTGS)",
      transferCount: transfers.length,
      settlementVolume,
      peakLiquidityRequired,
      transfers,
      grossObligationVolume: settlementVolume,
      grossObligationCount: obligations.length,
    };
  }

  // Mode B: Bilateral Batching (pairs netted, moderate transfer count)
  simulateModeB(obligations: Obligation[]): SimulationModeResult {
    let grossObligationVolume = 0n;

    // Key: canonical pair "min(A,B):max(A,B)"
    const pairFlows = new Map<string, {
      party1: Address;
      party2: Address;
      asset: Address;
      party1ToParty2: bigint;
      party2ToParty1: bigint;
      sourceObs: `0x${string}`[];
    }>();

    for (const ob of obligations) {
      grossObligationVolume += ob.amount;
      const [p1, p2] = ob.payer.toLowerCase() < ob.payee.toLowerCase()
        ? [ob.payer, ob.payee]
        : [ob.payee, ob.payer];
      const key = `${p1}:${p2}:${ob.asset.toLowerCase()}`;

      let entry = pairFlows.get(key);
      if (!entry) {
        entry = {
          party1: p1,
          party2: p2,
          asset: ob.asset,
          party1ToParty2: 0n,
          party2ToParty1: 0n,
          sourceObs: [],
        };
        pairFlows.set(key, entry);
      }

      if (ob.payer.toLowerCase() === p1.toLowerCase()) {
        entry.party1ToParty2 += ob.amount;
      } else {
        entry.party2ToParty1 += ob.amount;
      }
      entry.sourceObs.push(ob.id);
    }

    const transfers: SettlementTransfer[] = [];
    let settlementVolume = 0n;
    const bilateralOutflows = new Map<Address, bigint>();

    for (const flow of pairFlows.values()) {
      if (flow.party1ToParty2 > flow.party2ToParty1) {
        const netAmount = flow.party1ToParty2 - flow.party2ToParty1;
        transfers.push({
          payer: flow.party1,
          payee: flow.party2,
          asset: flow.asset,
          amount: netAmount,
          sourceObligationIds: flow.sourceObs,
        });
        settlementVolume += netAmount;
        const cur = bilateralOutflows.get(flow.party1) ?? 0n;
        bilateralOutflows.set(flow.party1, cur + netAmount);
      } else if (flow.party2ToParty1 > flow.party1ToParty2) {
        const netAmount = flow.party2ToParty1 - flow.party1ToParty2;
        transfers.push({
          payer: flow.party2,
          payee: flow.party1,
          asset: flow.asset,
          amount: netAmount,
          sourceObligationIds: flow.sourceObs,
        });
        settlementVolume += netAmount;
        const cur = bilateralOutflows.get(flow.party2) ?? 0n;
        bilateralOutflows.set(flow.party2, cur + netAmount);
      }
      // If exactly equal, net balance is 0: perfectly cleared bilaterally without transfer!
    }

    let peakLiquidityRequired = 0n;
    for (const outflow of bilateralOutflows.values()) {
      peakLiquidityRequired += outflow;
    }

    return {
      mode: "B",
      modeName: "Bilateral Batching",
      transferCount: transfers.length,
      settlementVolume,
      peakLiquidityRequired,
      transfers,
      grossObligationVolume,
      grossObligationCount: obligations.length,
    };
  }

  // Mode C: NORN Multilateral Clearing (maximum compression, lowest peak liquidity)
  simulateModeC(obligations: Obligation[]): SimulationModeResult {
    let grossObligationVolume = 0n;

    // Per asset, per participant net position: receivables minus payables
    const assetNetPositions = new Map<Address, Map<Address, bigint>>();
    const assetObligationSources = new Map<Address, `0x${string}`[]>();

    for (const ob of obligations) {
      grossObligationVolume += ob.amount;

      let netMap = assetNetPositions.get(ob.asset);
      if (!netMap) {
        netMap = new Map<Address, bigint>();
        assetNetPositions.set(ob.asset, netMap);
        assetObligationSources.set(ob.asset, []);
      }

      assetObligationSources.get(ob.asset)!.push(ob.id);

      // Payer owes amount (negative delta)
      const payerNet = netMap.get(ob.payer) ?? 0n;
      netMap.set(ob.payer, payerNet - ob.amount);

      // Payee is owed amount (positive delta)
      const payeeNet = netMap.get(ob.payee) ?? 0n;
      netMap.set(ob.payee, payeeNet + ob.amount);
    }

    const transfers: SettlementTransfer[] = [];
    let settlementVolume = 0n;
    let peakLiquidityRequired = 0n;

    for (const [asset, netMap] of assetNetPositions.entries()) {
      // Invariant: sum of net positions across all participants must equal zero
      let netSum = 0n;
      const debtors: { address: Address; amount: bigint }[] = [];
      const creditors: { address: Address; amount: bigint }[] = [];

      for (const [address, net] of netMap.entries()) {
        netSum += net;
        if (net < 0n) {
          debtors.push({ address, amount: -net });
          peakLiquidityRequired += -net;
        } else if (net > 0n) {
          creditors.push({ address, amount: net });
        }
      }

      if (netSum !== 0n) {
        throw new Error(`Conservation of value invariant violated: sum is ${netSum}`);
      }

      // Sort descending by magnitude to minimize transfer count (greedy clearing)
      debtors.sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0));
      creditors.sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0));

      let dIdx = 0;
      let cIdx = 0;

      while (dIdx < debtors.length && cIdx < creditors.length) {
        const debtor = debtors[dIdx];
        const creditor = creditors[cIdx];

        const matched = debtor.amount < creditor.amount ? debtor.amount : creditor.amount;

        if (matched > 0n) {
          transfers.push({
            payer: debtor.address,
            payee: creditor.address,
            asset,
            amount: matched,
          });
          settlementVolume += matched;
        }

        debtor.amount -= matched;
        creditor.amount -= matched;

        if (debtor.amount === 0n) dIdx++;
        if (creditor.amount === 0n) cIdx++;
      }
    }

    return {
      mode: "C",
      modeName: "NORN Multilateral Clearing",
      transferCount: transfers.length,
      settlementVolume,
      peakLiquidityRequired,
      transfers,
      grossObligationVolume,
      grossObligationCount: obligations.length,
    };
  }

  // Run all 3 modes for comparison
  simulateAll(obligations: Obligation[]): {
    modeA: SimulationModeResult;
    modeB: SimulationModeResult;
    modeC: SimulationModeResult;
  } {
    return {
      modeA: this.simulateModeA(obligations),
      modeB: this.simulateModeB(obligations),
      modeC: this.simulateModeC(obligations),
    };
  }
}
