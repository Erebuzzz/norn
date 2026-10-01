import { keccak256, toHex } from "viem";
import type { Agent, AgentRole, Address, RiskProfile } from "./types.js";

export class SeededPRNG {
  private state: number;

  constructor(seed: number = 42) {
    this.state = Math.abs(Math.floor(seed)) % 2147483647;
    if (this.state === 0) this.state = 1;
  }

  next(): number {
    this.state = (this.state * 16807) % 2147483647;
    return (this.state - 1) / 2147483646;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(min + this.next() * (max - min + 1));
  }

  nextBigInt(min: bigint, max: bigint): bigint {
    const range = max - min;
    const precision = 1000000n;
    const sample = BigInt(Math.floor(this.next() * Number(precision)));
    return min + (range * sample) / precision;
  }
}

export interface AgentGeneratorOptions {
  count?: number;
  seed?: number;
  baseAssetDecimals?: number;
}

export class AgentGenerator {
  private prng: SeededPRNG;
  private seed: number;
  private decimalsMultiplier: bigint;

  constructor(options: AgentGeneratorOptions = {}) {
    this.seed = options.seed ?? 42;
    this.prng = new SeededPRNG(this.seed);
    const decimals = options.baseAssetDecimals ?? 6;
    this.decimalsMultiplier = 10n ** BigInt(decimals);
  }

  generateAgents(count: number = 1000): Agent[] {
    const agents: Agent[] = [];

    for (let i = 0; i < count; i++) {
      const entropy = `norn-agent-${this.seed}-${i}`;
      const hash = keccak256(toHex(entropy));
      const id = `0x${hash.slice(26)}` as Address;

      let role: AgentRole;
      let initialLiquidity: bigint;
      let criticalityTier: 1 | 2 | 3;

      const ratio = i / count;

      if (ratio < 0.05) {
        // High-capacity treasuries (5%)
        role = "treasury";
        initialLiquidity = this.prng.nextBigInt(20000n, 50000n) * this.decimalsMultiplier;
        criticalityTier = 1;
      } else if (ratio < 0.20) {
        // Market makers & arbitrageurs (15%)
        role = i % 2 === 0 ? "market_maker" : "arbitrageur";
        initialLiquidity = this.prng.nextBigInt(3000n, 8000n) * this.decimalsMultiplier;
        criticalityTier = 2;
      } else if (ratio < 0.40) {
        // Specialized machine service providers (20%)
        role = "service_provider";
        initialLiquidity = this.prng.nextBigInt(800n, 2500n) * this.decimalsMultiplier;
        criticalityTier = 2;
      } else {
        // Standard autonomous machine consumers (60%)
        role = "consumer";
        initialLiquidity = this.prng.nextBigInt(100n, 400n) * this.decimalsMultiplier;
        criticalityTier = 3;
      }

      const creditLimit = (initialLiquidity * 30n) / 100n; // 30% credit capacity
      const maxNetDebit = (initialLiquidity * 85n) / 100n; // 85% max debit threshold

      const riskProfile: RiskProfile = {
        maxNetDebit,
        reserveRatioBps: 1000, // 10% reserve in NORMAL regime
        status: "ACTIVE",
        criticalityTier,
      };

      const name = `${role.toUpperCase()}-${String(i + 1).padStart(4, "0")}`;

      agents.push({
        id,
        name,
        role,
        initialLiquidity,
        currentLiquidity: initialLiquidity,
        reservedLiquidity: 0n,
        creditLimit,
        riskProfile,
      });
    }

    return agents;
  }
}
