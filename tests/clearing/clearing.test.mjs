import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  keccak256,
  stringToHex,
  toHex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  ObligationPriority,
  ParticipantStatus,
  RiskRegime,
  validateObligation,
  validateObligations,
  computeReferenceHash,
  computeBilateralNetting,
  netBilateralPair,
  buildDirectedObligationGraph,
  computeParticipantNetBalances,
  verifyConservationInvariant,
  formulateSettlementTransfers,
  computeMultilateralNetting,
  computeLiquidityShortfalls,
  resolveClearingBatch,
  LiquidityBreachError,
  computeObligationRoot,
  computeParticipantNetRoot,
  computeSettlementRoot,
  generateMerkleProof,
  verifyMerkleProof,
  computeObligationLeaf,
  generateClearingCommitments,
  OBLIGATION_EIP712_TYPES,
} from "../../packages/clearing/dist/index.js";

const TEST_ASSET = "0x00000000000000000000000000000000000000aa";
const ALT_ASSET = "0x00000000000000000000000000000000000000bb";

function createMockObligation(params) {
  const reference = params.reference ?? `ref-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id: params.id ?? keccak256(stringToHex(`ob-${Math.random().toString(36).slice(2, 8)}`)),
    payer: params.payer,
    payee: params.payee,
    asset: params.asset ?? TEST_ASSET,
    amount: params.amount,
    nonce: params.nonce ?? 1n,
    createdAt: params.createdAt ?? Math.floor(Date.now() / 1000),
    expiresAt: params.expiresAt ?? Math.floor(Date.now() / 1000) + 86400,
    priority: params.priority ?? ObligationPriority.NORMAL,
    reference,
    referenceHash: computeReferenceHash(reference),
    signature: params.signature,
  };
}

describe("NORN Clearing and Netting Engine Test Suite", () => {
  describe("1. Bilateral Netting", () => {
    test("correctly offsets reciprocal obligations between two parties", () => {
      const partyA = "0x1111111111111111111111111111111111111111";
      const partyB = "0x2222222222222222222222222222222222222222";

      const obligations = [
        createMockObligation({ payer: partyA, payee: partyB, amount: 100n }),
        createMockObligation({ payer: partyB, payee: partyA, amount: 40n }),
      ];

      const result = computeBilateralNetting(obligations);

      assert.equal(result.activePairs.length, 1);
      assert.equal(result.fullyOffsetPairs.length, 0);
      assert.equal(result.grossVolume, 140n);
      assert.equal(result.netVolume, 60n);

      const netPair = result.activePairs[0];
      assert.equal(netPair.payer.toLowerCase(), partyA.toLowerCase());
      assert.equal(netPair.payee.toLowerCase(), partyB.toLowerCase());
      assert.equal(netPair.netAmount, 60n);
      assert.equal(netPair.grossPartyAToB, 100n);
      assert.equal(netPair.grossPartyBToA, 40n);
      assert.equal(netPair.sourceObligations.length, 2);
    });

    test("handles multiple obligations and perfectly offsetting balances", () => {
      const partyA = "0x1111111111111111111111111111111111111111";
      const partyB = "0x2222222222222222222222222222222222222222";

      const obligations = [
        createMockObligation({ payer: partyA, payee: partyB, amount: 25n }),
        createMockObligation({ payer: partyA, payee: partyB, amount: 25n }),
        createMockObligation({ payer: partyB, payee: partyA, amount: 50n }),
      ];

      const result = computeBilateralNetting(obligations);

      assert.equal(result.activePairs.length, 0);
      assert.equal(result.fullyOffsetPairs.length, 1);
      assert.equal(result.grossVolume, 100n);
      assert.equal(result.netVolume, 0n);
      assert.equal(result.efficiency, 1.0);
      assert.equal(result.fullyOffsetPairs[0].offsetAmount, 50n);
    });

    test("isolates bilateral pairs across distinct assets", () => {
      const partyA = "0x1111111111111111111111111111111111111111";
      const partyB = "0x2222222222222222222222222222222222222222";

      const obligations = [
        createMockObligation({ payer: partyA, payee: partyB, asset: TEST_ASSET, amount: 100n }),
        createMockObligation({ payer: partyB, payee: partyA, asset: TEST_ASSET, amount: 30n }),
        createMockObligation({ payer: partyB, payee: partyA, asset: ALT_ASSET, amount: 70n }),
      ];

      const result = computeBilateralNetting(obligations);

      assert.equal(result.activePairs.length, 2);
      const testAssetPair = result.activePairs.find((p) => p.asset === TEST_ASSET);
      const altAssetPair = result.activePairs.find((p) => p.asset === ALT_ASSET);

      assert.equal(testAssetPair.netAmount, 70n);
      assert.equal(testAssetPair.payer.toLowerCase(), partyA.toLowerCase());

      assert.equal(altAssetPair.netAmount, 70n);
      assert.equal(altAssetPair.payer.toLowerCase(), partyB.toLowerCase());
    });
  });

  describe("2. Multilateral Netting and Conservation Invariant", () => {
    test("preserves conservation (sum of net balances == 0) in cyclic topology", () => {
      const partyA = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      const partyB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
      const partyC = "0xcccccccccccccccccccccccccccccccccccccccc";

      const obligations = [
        createMockObligation({ payer: partyA, payee: partyB, amount: 100n }),
        createMockObligation({ payer: partyB, payee: partyC, amount: 100n }),
        createMockObligation({ payer: partyC, payee: partyA, amount: 100n }),
      ];

      const result = computeMultilateralNetting(obligations);

      assert.equal(result.conservationDelta, 0n);
      assert.equal(result.grossVolume, 300n);
      assert.equal(result.netVolume, 0n);
      assert.equal(result.settlementTransfers.length, 0);
      assert.equal(result.efficiency, 1.0);

      for (const balance of result.netBalances) {
        assert.equal(balance.netBalance, 0n);
      }
    });

    test("computes net balances and minimal transfers for complex NORN participant graph", () => {
      const partyA = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      const partyB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
      const partyC = "0xcccccccccccccccccccccccccccccccccccccccc";

      const obligations = [
        createMockObligation({ id: "0x01", payer: partyA, payee: partyB, amount: 100n }),
        createMockObligation({ id: "0x02", payer: partyA, payee: partyC, amount: 50n }),
        createMockObligation({ id: "0x03", payer: partyB, payee: partyC, amount: 80n }),
        createMockObligation({ id: "0x04", payer: partyC, payee: partyA, amount: 90n }),
        createMockObligation({ id: "0x05", payer: partyC, payee: partyB, amount: 20n }),
      ];

      const result = computeMultilateralNetting(obligations);

      assert.equal(result.grossVolume, 340n);
      assert.equal(result.conservationDelta, 0n);

      const netMap = new Map(result.netBalances.map((b) => [b.participant.toLowerCase(), b.netBalance]));
      assert.equal(netMap.get(partyA.toLowerCase()), -60n);
      assert.equal(netMap.get(partyB.toLowerCase()), 40n);
      assert.equal(netMap.get(partyC.toLowerCase()), 20n);

      const totalNetSum = Array.from(netMap.values()).reduce((acc, v) => acc + v, 0n);
      assert.equal(totalNetSum, 0n);

      assert.equal(result.settlementTransfers.length, 2);
      assert.equal(result.netVolume, 60n);

      const transferToB = result.settlementTransfers.find((t) => t.payee.toLowerCase() === partyB.toLowerCase());
      const transferToC = result.settlementTransfers.find((t) => t.payee.toLowerCase() === partyC.toLowerCase());

      assert.ok(transferToB);
      assert.equal(transferToB.payer.toLowerCase(), partyA.toLowerCase());
      assert.equal(transferToB.amount, 40n);

      assert.ok(transferToC);
      assert.equal(transferToC.payer.toLowerCase(), partyA.toLowerCase());
      assert.equal(transferToC.amount, 20n);
    });

    test("directed graph builder produces correct adjacency and nodes", () => {
      const partyA = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      const partyB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

      const obligations = [
        createMockObligation({ payer: partyA, payee: partyB, amount: 45n }),
        createMockObligation({ payer: partyA, payee: partyB, amount: 15n }),
      ];

      const graph = buildDirectedObligationGraph(obligations);
      assert.equal(graph.nodes.size, 2);
      assert.equal(graph.edges.length, 1);
      assert.equal(graph.edges[0].amount, 60n);
      assert.equal(graph.edges[0].sourceObligations.length, 2);
    });
  });

  describe("3. Ingestion and Validation", () => {
    test("filters expired obligations", async () => {
      const now = Math.floor(Date.now() / 1000);
      const validOb = createMockObligation({
        payer: "0x1111111111111111111111111111111111111111",
        payee: "0x2222222222222222222222222222222222222222",
        amount: 50n,
        expiresAt: now + 3600,
      });
      const expiredOb = createMockObligation({
        payer: "0x1111111111111111111111111111111111111111",
        payee: "0x2222222222222222222222222222222222222222",
        amount: 50n,
        expiresAt: now - 100,
      });

      const { valid, invalid } = await validateObligations([validOb, expiredOb], {
        currentTimestamp: now,
      });

      assert.equal(valid.length, 1);
      assert.equal(invalid.length, 1);
      assert.equal(invalid[0].code, "EXPIRED");
      assert.equal(invalid[0].obligation.id, expiredOb.id);
    });

    test("filters frozen participants (payer or payee)", async () => {
      const frozenPayer = "0x9999999999999999999999999999999999999999";
      const normalParty = "0x8888888888888888888888888888888888888888";

      const participants = new Map();
      participants.set(frozenPayer.toLowerCase(), {
        id: "frozen-agent",
        address: frozenPayer,
        status: ParticipantStatus.FROZEN,
        settlementLimit: 1000n,
        liquidityReserve: 100n,
        creditLimit: 0n,
        collateralValue: 0n,
      });
      participants.set(normalParty.toLowerCase(), {
        id: "active-agent",
        address: normalParty,
        status: ParticipantStatus.ACTIVE,
        settlementLimit: 1000n,
        liquidityReserve: 100n,
        creditLimit: 0n,
        collateralValue: 0n,
      });

      const obPayerFrozen = createMockObligation({ payer: frozenPayer, payee: normalParty, amount: 20n });
      const obPayeeFrozen = createMockObligation({ payer: normalParty, payee: frozenPayer, amount: 20n });

      const resPayer = await validateObligations([obPayerFrozen], { participants });
      assert.equal(resPayer.valid.length, 0);
      assert.equal(resPayer.invalid[0].code, "PAYER_FROZEN");

      const resPayee = await validateObligations([obPayeeFrozen], { participants });
      assert.equal(resPayee.valid.length, 0);
      assert.equal(resPayee.invalid[0].code, "PAYEE_FROZEN");
    });

    test("filters duplicate nonces within batch and against historical records", async () => {
      const payer = "0x1111111111111111111111111111111111111111";
      const payee = "0x2222222222222222222222222222222222222222";

      const ob1 = createMockObligation({ payer, payee, nonce: 5n, amount: 10n });
      const ob2DuplicateInBatch = createMockObligation({ payer, payee, nonce: 5n, amount: 20n });
      const ob3Historical = createMockObligation({ payer, payee, nonce: 9n, amount: 30n });

      const usedNonces = new Set([`${payer.toLowerCase()}:9`]);

      const result = await validateObligations([ob1, ob2DuplicateInBatch, ob3Historical], { usedNonces });
      assert.equal(result.valid.length, 1);
      assert.equal(result.invalid.length, 2);
      assert.equal(result.invalid[0].code, "DUPLICATE_NONCE");
      assert.equal(result.invalid[1].code, "DUPLICATE_NONCE");
    });

    test("verifies valid EIP-712 cryptographic signatures and rejects forged ones", async () => {
      const privateKey = generatePrivateKey();
      const account = privateKeyToAccount(privateKey);
      const payer = account.address;
      const payee = "0x3333333333333333333333333333333333333333";

      const domain = {
        name: "NORN Obligation Protocol",
        version: "1",
        chainId: 31337,
        verifyingContract: TEST_ASSET,
      };

      const obParams = {
        id: keccak256(stringToHex("signed-ob-01")),
        payer,
        payee,
        asset: TEST_ASSET,
        amount: 75_000_000n,
        nonce: 1n,
        createdAt: Math.floor(Date.now() / 1000),
        expiresAt: Math.floor(Date.now() / 1000) + 86400,
        priority: ObligationPriority.HIGH,
        reference: "invoice-771",
        referenceHash: computeReferenceHash("invoice-771"),
      };

      const validSignature = await account.signTypedData({
        domain,
        types: OBLIGATION_EIP712_TYPES,
        primaryType: "Obligation",
        message: {
          id: obParams.id,
          payer: obParams.payer,
          payee: obParams.payee,
          asset: obParams.asset,
          amount: obParams.amount,
          nonce: obParams.nonce,
          expiresAt: BigInt(obParams.expiresAt),
          priority: Number(obParams.priority),
          referenceHash: obParams.referenceHash,
        },
      });

      const validOb = { ...obParams, signature: validSignature };
      const validResult = await validateObligations([validOb], { eip712Domain: domain });
      assert.equal(validResult.valid.length, 1);
      assert.equal(validResult.invalid.length, 0);

      const otherAccount = privateKeyToAccount(generatePrivateKey());
      const forgedSignature = await otherAccount.signTypedData({
        domain,
        types: OBLIGATION_EIP712_TYPES,
        primaryType: "Obligation",
        message: {
          id: obParams.id,
          payer: obParams.payer,
          payee: obParams.payee,
          asset: obParams.asset,
          amount: obParams.amount,
          nonce: obParams.nonce,
          expiresAt: BigInt(obParams.expiresAt),
          priority: Number(obParams.priority),
          referenceHash: obParams.referenceHash,
        },
      });

      const forgedOb = { ...obParams, signature: forgedSignature };
      const forgedResult = await validateObligations([forgedOb], { eip712Domain: domain });
      assert.equal(forgedResult.valid.length, 0);
      assert.equal(forgedResult.invalid[0].code, "INVALID_SIGNATURE");
    });
  });

  describe("4. Priority and Liquidity Constraint Resolver", () => {
    test("properly rejects an over-debit batch with exact shortfall calculation", () => {
      const payer = "0x4444444444444444444444444444444444444444";
      const payee = "0x5555555555555555555555555555555555555555";

      const liquidityLookup = new Map();
      liquidityLookup.set(`${TEST_ASSET.toLowerCase()}:${payer.toLowerCase()}`, {
        totalLiquidity: 100n,
        reservedLiquidity: 20n,
        availableLiquidity: 80n,
        requiredReserve: 10n,
      });

      const obligation = createMockObligation({
        payer,
        payee,
        amount: 75n,
        priority: ObligationPriority.CRITICAL,
      });

      const shortfalls = computeLiquidityShortfalls([obligation], liquidityLookup);
      assert.equal(shortfalls.length, 1);
      assert.equal(shortfalls[0].participant.toLowerCase(), payer.toLowerCase());
      assert.equal(shortfalls[0].availableLiquidity, 80n);
      assert.equal(shortfalls[0].debitAmount, 75n);
      assert.equal(shortfalls[0].requiredReserve, 10n);
      assert.equal(shortfalls[0].shortfall, 5n);

      assert.throws(
        () => {
          resolveClearingBatch([obligation], liquidityLookup, {
            rejectUnsafeBatches: true,
          });
        },
        (err) => {
          assert.ok(err instanceof LiquidityBreachError);
          assert.equal(err.shortfalls.length, 1);
          assert.equal(err.shortfalls[0].shortfall, 5n);
          return true;
        }
      );
    });

    test("calculates exact shortfall when requested debit exceeds total available liquidity", () => {
      const payer = "0x4444444444444444444444444444444444444444";
      const payee = "0x5555555555555555555555555555555555555555";

      const liquidityLookup = new Map();
      liquidityLookup.set(`${TEST_ASSET.toLowerCase()}:${payer.toLowerCase()}`, {
        availableLiquidity: 50n,
        requiredReserve: 10n,
      });

      const obligation = createMockObligation({
        payer,
        payee,
        amount: 65n,
        priority: ObligationPriority.CRITICAL,
      });

      const shortfalls = computeLiquidityShortfalls([obligation], liquidityLookup);
      assert.equal(shortfalls.length, 1);
      assert.equal(shortfalls[0].shortfall, 25n);
    });

    test("priority queue ensures CRITICAL and HIGH obligations settle before NORMAL obligations", () => {
      const payer = "0x6666666666666666666666666666666666666666";
      const payee = "0x7777777777777777777777777777777777777777";

      const liquidityLookup = new Map();
      liquidityLookup.set(`${TEST_ASSET.toLowerCase()}:${payer.toLowerCase()}`, {
        availableLiquidity: 50n,
        requiredReserve: 0n,
      });

      const obCritical = createMockObligation({
        id: "0x01",
        payer,
        payee,
        amount: 30n,
        priority: ObligationPriority.CRITICAL,
        nonce: 1n,
      });

      const obHigh = createMockObligation({
        id: "0x02",
        payer,
        payee,
        amount: 20n,
        priority: ObligationPriority.HIGH,
        nonce: 2n,
      });

      const obNormal = createMockObligation({
        id: "0x03",
        payer,
        payee,
        amount: 40n,
        priority: ObligationPriority.NORMAL,
        nonce: 3n,
      });

      const result = resolveClearingBatch(
        [obNormal, obCritical, obHigh],
        liquidityLookup,
        { regime: RiskRegime.NORMAL }
      );

      assert.equal(result.isSafe, true);
      assert.equal(result.acceptedObligations.length, 2);
      assert.equal(result.deferredObligations.length, 1);

      assert.equal(result.acceptedObligations[0].id, obCritical.id);
      assert.equal(result.acceptedObligations[1].id, obHigh.id);
      assert.equal(result.deferredObligations[0].id, obNormal.id);

      assert.equal(result.settlementTransfers.length, 1);
      assert.equal(result.settlementTransfers[0].amount, 50n);
    });

    test("defensive risk regime restricts settlement strictly to CRITICAL obligations", () => {
      const payer = "0x6666666666666666666666666666666666666666";
      const payee = "0x7777777777777777777777777777777777777777";

      const liquidityLookup = new Map();
      liquidityLookup.set(`${TEST_ASSET.toLowerCase()}:${payer.toLowerCase()}`, {
        availableLiquidity: 1000n,
        requiredReserve: 0n,
      });

      const obCritical = createMockObligation({ payer, payee, amount: 20n, priority: ObligationPriority.CRITICAL });
      const obHigh = createMockObligation({ payer, payee, amount: 20n, priority: ObligationPriority.HIGH });
      const obNormal = createMockObligation({ payer, payee, amount: 20n, priority: ObligationPriority.NORMAL });

      const result = resolveClearingBatch(
        [obCritical, obHigh, obNormal],
        liquidityLookup,
        { regime: RiskRegime.DEFENSIVE }
      );

      assert.equal(result.acceptedObligations.length, 1);
      assert.equal(result.acceptedObligations[0].priority, ObligationPriority.CRITICAL);
      assert.equal(result.deferredObligations.length, 2);
    });
  });

  describe("5. Merkle Commitment Engine", () => {
    test("computes obligationRoot, participantNetRoot, and settlementRoot deterministically", () => {
      const partyA = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      const partyB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
      const partyC = "0xcccccccccccccccccccccccccccccccccccccccc";

      const ob1 = createMockObligation({ id: keccak256(stringToHex("ob-merkle-1")), payer: partyA, payee: partyB, amount: 100n });
      const ob2 = createMockObligation({ id: keccak256(stringToHex("ob-merkle-2")), payer: partyB, payee: partyC, amount: 80n });
      const ob3 = createMockObligation({ id: keccak256(stringToHex("ob-merkle-3")), payer: partyC, payee: partyA, amount: 50n });

      const obligations = [ob1, ob2, ob3];
      const { netBalances, settlementTransfers } = computeMultilateralNetting(obligations);

      const root1 = computeObligationRoot(obligations);
      const root2 = computeObligationRoot([ob3, ob1, ob2]);
      assert.equal(root1, root2);
      assert.notEqual(root1, "0x0000000000000000000000000000000000000000000000000000000000000000");

      const netRoot1 = computeParticipantNetRoot(netBalances);
      const netRoot2 = computeParticipantNetRoot([...netBalances].reverse());
      assert.equal(netRoot1, netRoot2);

      const settlementRoot = computeSettlementRoot(settlementTransfers);
      assert.ok(settlementRoot.startsWith("0x"));
      assert.equal(settlementRoot.length, 66);

      const batch = generateClearingCommitments({
        epoch: 1n,
        solver: "0x9999999999999999999999999999999999999999",
        solverBond: 1000n,
        validUntil: Math.floor(Date.now() / 1000) + 3600,
        regime: RiskRegime.NORMAL,
        obligations,
        netBalances,
        settlementTransfers,
      });

      assert.equal(batch.obligationRoot, root1);
      assert.equal(batch.participantNetRoot, netRoot1);
      assert.equal(batch.settlementRoot, settlementRoot);
      assert.ok(batch.batchId.startsWith("0x"));
      assert.equal(batch.batchId.length, 66);
    });

    test("generates and verifies cryptographic Merkle proofs for individual obligation leaves", () => {
      const obligations = [
        createMockObligation({ id: keccak256(stringToHex("ob-proof-1")), payer: "0x1111111111111111111111111111111111111111", payee: "0x2222222222222222222222222222222222222222", amount: 10n }),
        createMockObligation({ id: keccak256(stringToHex("ob-proof-2")), payer: "0x2222222222222222222222222222222222222222", payee: "0x3333333333333333333333333333333333333333", amount: 20n }),
        createMockObligation({ id: keccak256(stringToHex("ob-proof-3")), payer: "0x3333333333333333333333333333333333333333", payee: "0x1111111111111111111111111111111111111111", amount: 30n }),
        createMockObligation({ id: keccak256(stringToHex("ob-proof-4")), payer: "0x1111111111111111111111111111111111111111", payee: "0x3333333333333333333333333333333333333333", amount: 40n }),
      ];

      const root = computeObligationRoot(obligations);
      const leafHashes = obligations.map(computeObligationLeaf);

      const targetObligation = obligations[2];
      const targetLeaf = computeObligationLeaf(targetObligation);

      const proof = generateMerkleProof(leafHashes, targetLeaf);
      assert.ok(proof.length > 0);

      const isValid = verifyMerkleProof(proof, root, targetLeaf);
      assert.equal(isValid, true);

      const forgedLeaf = keccak256(stringToHex("forged-obligation"));
      const isForgedValid = verifyMerkleProof(proof, root, forgedLeaf);
      assert.equal(isForgedValid, false);
    });

    test("handles empty arrays and single leaf inputs consistently", () => {
      const emptyObRoot = computeObligationRoot([]);
      assert.equal(emptyObRoot, "0x0000000000000000000000000000000000000000000000000000000000000000");

      const singleOb = createMockObligation({
        payer: "0x1111111111111111111111111111111111111111",
        payee: "0x2222222222222222222222222222222222222222",
        amount: 50n,
      });
      const singleRoot = computeObligationRoot([singleOb]);
      const expectedLeaf = computeObligationLeaf(singleOb);
      assert.equal(singleRoot, expectedLeaf);
    });
  });

  describe("6. Edge Cases and Regime Transitions", () => {
    test("throws explicit error when conservation invariant is broken", () => {
      const imbalanced = [
        {
          participant: "0x1111111111111111111111111111111111111111",
          asset: TEST_ASSET,
          netBalance: 50n,
          grossIncoming: 50n,
          grossOutgoing: 0n,
        },
        {
          participant: "0x2222222222222222222222222222222222222222",
          asset: TEST_ASSET,
          netBalance: -40n,
          grossIncoming: 0n,
          grossOutgoing: 40n,
        },
      ];

      assert.throws(
        () => verifyConservationInvariant(imbalanced),
        /Conservation invariant violation/
      );
    });

    test("filters zero amount, zero address, and identical party obligations", async () => {
      const party = "0x1111111111111111111111111111111111111111";
      const other = "0x2222222222222222222222222222222222222222";
      const zero = "0x0000000000000000000000000000000000000000";

      const obZeroAmount = createMockObligation({ payer: party, payee: other, amount: 0n });
      const obIdentical = createMockObligation({ payer: party, payee: party, amount: 10n });
      const obZeroPayer = createMockObligation({ payer: zero, payee: other, amount: 10n });
      const obZeroAsset = createMockObligation({ payer: party, payee: other, asset: zero, amount: 10n });

      const resZeroAmount = await validateObligations([obZeroAmount]);
      assert.equal(resZeroAmount.invalid[0].code, "ZERO_AMOUNT");

      const resIdentical = await validateObligations([obIdentical]);
      assert.equal(resIdentical.invalid[0].code, "INVALID_PARTIES");

      const resZeroPayer = await validateObligations([obZeroPayer]);
      assert.equal(resZeroPayer.invalid[0].code, "INVALID_PARTIES");

      const resZeroAsset = await validateObligations([obZeroAsset]);
      assert.equal(resZeroAsset.invalid[0].code, "INVALID_ASSET");
    });

    test("frozen regime defers all obligations regardless of liquidity", () => {
      const payer = "0x1111111111111111111111111111111111111111";
      const payee = "0x2222222222222222222222222222222222222222";

      const liquidityLookup = new Map();
      liquidityLookup.set(`${TEST_ASSET.toLowerCase()}:${payer.toLowerCase()}`, {
        availableLiquidity: 10000n,
        requiredReserve: 0n,
      });

      const ob = createMockObligation({ payer, payee, amount: 10n, priority: ObligationPriority.CRITICAL });

      const result = resolveClearingBatch([ob], liquidityLookup, {
        regime: RiskRegime.FROZEN,
      });

      assert.equal(result.acceptedObligations.length, 0);
      assert.equal(result.deferredObligations.length, 1);
      assert.equal(result.settlementTransfers.length, 0);
    });
  });
});
