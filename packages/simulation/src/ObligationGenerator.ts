import { keccak256, toHex, encodePacked } from "viem";
import { type Agent, type Obligation, ObligationPriority, type Address } from "./types.js";
import { SeededPRNG } from "./AgentGenerator.js";

export interface ObligationGeneratorOptions {
  seed?: number;
  asset?: Address;
  decimals?: number;
}

export class ObligationGenerator {
  private prng: SeededPRNG;
  private defaultAsset: Address;
  private decimalsMultiplier: bigint;

  constructor(options: ObligationGeneratorOptions = {}) {
    this.prng = new SeededPRNG(options.seed ?? 1337);
    this.defaultAsset = options.asset ?? "0x1111111111111111111111111111111111111111";
    const decimals = options.decimals ?? 6;
    this.decimalsMultiplier = 10n ** BigInt(decimals);
  }

  generateObligations(agents: Agent[], count: number = 10000): Obligation[] {
    if (agents.length < 2) {
      throw new Error("At least two agents are required to generate obligations");
    }

    const obligations: Obligation[] = [];
    const agentNonces = new Map<Address, bigint>();
    const baseTimestamp = 1770000000;

    const consumers = agents.filter((a) => a.role === "consumer");
    const providers = agents.filter((a) => a.role === "service_provider");
    const marketMakers = agents.filter((a) => a.role === "market_maker" || a.role === "arbitrageur");
    const treasuries = agents.filter((a) => a.role === "treasury");

    const pickAgent = (pool: Agent[]) => {
      const active = pool.length > 0 ? pool : agents;
      return active[this.prng.nextInt(0, active.length - 1)];
    };

    let i = 0;
    while (i < count) {
      const roll = this.prng.next();

      if (roll < 0.40 && i + 3 <= count) {
        // 40%: Multi-hop circular service chains (A -> B -> C -> A)
        // High netting potential matching realistic autonomous service meshes
        const chainLength = Math.min(count - i, this.prng.nextInt(3, 5));
        const cycleAgents: Agent[] = [];
        for (let k = 0; k < chainLength; k++) {
          cycleAgents.push(pickAgent(this.prng.next() < 0.5 ? providers : marketMakers));
        }

        const cycleAmount = BigInt(this.prng.nextInt(10, 200)) * this.decimalsMultiplier;
        const priority = this.prng.next() < 0.2 ? ObligationPriority.HIGH : ObligationPriority.NETTABLE;

        for (let k = 0; k < chainLength; k++) {
          const payer = cycleAgents[k];
          const payee = cycleAgents[(k + 1) % chainLength];
          if (payer.id === payee.id) continue;

          const nonce = (agentNonces.get(payer.id) ?? 0n) + 1n;
          agentNonces.set(payer.id, nonce);

          const refHash = keccak256(toHex(`cycle-${payer.id}-${payee.id}-${nonce}-${i}`));
          const id = keccak256(
            encodePacked(
              ["address", "address", "uint256", "uint256", "bytes32"],
              [payer.id, payee.id, cycleAmount, nonce, refHash]
            )
          );

          obligations.push({
            id,
            payer: payer.id,
            payee: payee.id,
            asset: this.defaultAsset,
            amount: cycleAmount,
            nonce,
            createdAt: baseTimestamp + i * 2,
            expiresAt: baseTimestamp + i * 2 + 86400,
            priority,
            referenceHash: refHash,
            status: "CREATED",
          });
          i++;
        }
      } else if (roll < 0.75) {
        // 35%: Bilateral cross-service supply chain (A -> B and B -> A)
        const agentA = pickAgent(providers);
        let agentB = pickAgent(marketMakers.length > 0 ? marketMakers : providers);
        if (agentA.id === agentB.id) {
          agentB = agents[(agents.indexOf(agentA) + 1) % agents.length];
        }

        const amountA = BigInt(this.prng.nextInt(20, 150)) * this.decimalsMultiplier;
        const nonceA = (agentNonces.get(agentA.id) ?? 0n) + 1n;
        agentNonces.set(agentA.id, nonceA);

        const refHashA = keccak256(toHex(`b2b-${agentA.id}-${agentB.id}-${nonceA}-${i}`));
        const idA = keccak256(
          encodePacked(
            ["address", "address", "uint256", "uint256", "bytes32"],
            [agentA.id, agentB.id, amountA, nonceA, refHashA]
          )
        );

        obligations.push({
          id: idA,
          payer: agentA.id,
          payee: agentB.id,
          asset: this.defaultAsset,
          amount: amountA,
          nonce: nonceA,
          createdAt: baseTimestamp + i * 2,
          expiresAt: baseTimestamp + i * 2 + 86400,
          priority: ObligationPriority.NORMAL,
          referenceHash: refHashA,
          status: "CREATED",
        });
        i++;

        if (i < count && this.prng.next() < 0.7) {
          // Offsetting return flow from B to A
          const amountB = (amountA * BigInt(this.prng.nextInt(70, 130))) / 100n;
          const nonceB = (agentNonces.get(agentB.id) ?? 0n) + 1n;
          agentNonces.set(agentB.id, nonceB);

          const refHashB = keccak256(toHex(`b2b-rev-${agentB.id}-${agentA.id}-${nonceB}-${i}`));
          const idB = keccak256(
            encodePacked(
              ["address", "address", "uint256", "uint256", "bytes32"],
              [agentB.id, agentA.id, amountB, nonceB, refHashB]
            )
          );

          obligations.push({
            id: idB,
            payer: agentB.id,
            payee: agentA.id,
            asset: this.defaultAsset,
            amount: amountB,
            nonce: nonceB,
            createdAt: baseTimestamp + i * 2,
            expiresAt: baseTimestamp + i * 2 + 86400,
            priority: ObligationPriority.NETTABLE,
            referenceHash: refHashB,
            status: "CREATED",
          });
          i++;
        }
      } else if (roll < 0.90) {
        // 15%: Consumer micro-payments to services
        const payer = pickAgent(consumers);
        const payee = pickAgent(providers);
        const priceCents = this.prng.nextInt(1, 10); // $0.01 to $0.10
        const amount = (BigInt(priceCents) * this.decimalsMultiplier) / 100n;
        const nonce = (agentNonces.get(payer.id) ?? 0n) + 1n;
        agentNonces.set(payer.id, nonce);

        const refHash = keccak256(toHex(`consumer-${payer.id}-${payee.id}-${nonce}-${i}`));
        const id = keccak256(
          encodePacked(
            ["address", "address", "uint256", "uint256", "bytes32"],
            [payer.id, payee.id, amount, nonce, refHash]
          )
        );

        obligations.push({
          id,
          payer: payer.id,
          payee: payee.id,
          asset: this.defaultAsset,
          amount,
          nonce,
          createdAt: baseTimestamp + i * 2,
          expiresAt: baseTimestamp + i * 2 + 86400,
          priority: ObligationPriority.NORMAL,
          referenceHash: refHash,
          status: "CREATED",
        });
        i++;
      } else {
        // 10%: Critical treasury transfers and high-priority reallocations
        const payer = pickAgent(treasuries);
        let payee = pickAgent(agents);
        if (payer.id === payee.id) {
          payee = agents[(agents.indexOf(payer) + 2) % agents.length];
        }

        const amount = BigInt(this.prng.nextInt(200, 2000)) * this.decimalsMultiplier;
        const nonce = (agentNonces.get(payer.id) ?? 0n) + 1n;
        agentNonces.set(payer.id, nonce);

        const refHash = keccak256(toHex(`treasury-${payer.id}-${payee.id}-${nonce}-${i}`));
        const id = keccak256(
          encodePacked(
            ["address", "address", "uint256", "uint256", "bytes32"],
            [payer.id, payee.id, amount, nonce, refHash]
          )
        );

        obligations.push({
          id,
          payer: payer.id,
          payee: payee.id,
          asset: this.defaultAsset,
          amount,
          nonce,
          createdAt: baseTimestamp + i * 2,
          expiresAt: baseTimestamp + i * 2 + 86400,
          priority: this.prng.next() < 0.5 ? ObligationPriority.CRITICAL : ObligationPriority.HIGH,
          referenceHash: refHash,
          status: "CREATED",
        });
        i++;
      }
    }

    return obligations;
  }
}
