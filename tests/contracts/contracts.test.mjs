import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { keccak256, toHex, stringToHex, parseUnits, encodeAbiParameters, parseAbiParameters } from "viem";
import { setupTestEnvironment, loadArtifact } from "./test-helper.mjs";

describe("NORN Core Smart Contracts Suite", async () => {
  test("ParticipantRegistry: registration, limits, and freezing", async () => {
    const env = await setupTestEnvironment();
    const artifact = loadArtifact("NORNParticipantRegistry");

    const hash = await env.adminClient.deployContract({
      abi: artifact.abi,
      bytecode: `0x${artifact.bytecode}`,
      args: [env.adminAccount.address],
    });
    const receipt = await env.publicClient.waitForTransactionReceipt({ hash });
    const registryAddress = receipt.contractAddress;

    // Register participant
    const regTx = await env.adminClient.writeContract({
      address: registryAddress,
      abi: artifact.abi,
      functionName: "registerParticipant",
      args: [env.payerAccount.address, 1000000n, 500000n],
    });
    await env.publicClient.waitForTransactionReceipt({ hash: regTx });

    // Verify participant state
    const participant = await env.publicClient.readContract({
      address: registryAddress,
      abi: artifact.abi,
      functionName: "getParticipant",
      args: [env.payerAccount.address],
    });
    assert.equal(participant.participantAddress.toLowerCase(), env.payerAccount.address.toLowerCase());
    assert.equal(participant.status, 0); // ACTIVE
    assert.equal(participant.settlementLimit, 1000000n);

    // Freeze participant
    const freezeTx = await env.adminClient.writeContract({
      address: registryAddress,
      abi: artifact.abi,
      functionName: "freezeParticipant",
      args: [env.payerAccount.address, "Suspicious exposure spike"],
    });
    await env.publicClient.waitForTransactionReceipt({ hash: freezeTx });

    const isFrozen = await env.publicClient.readContract({
      address: registryAddress,
      abi: artifact.abi,
      functionName: "isParticipantFrozen",
      args: [env.payerAccount.address],
    });
    assert.equal(isFrozen, true);

    // Unfreeze
    const unfreezeTx = await env.adminClient.writeContract({
      address: registryAddress,
      abi: artifact.abi,
      functionName: "unfreezeParticipant",
      args: [env.payerAccount.address],
    });
    await env.publicClient.waitForTransactionReceipt({ hash: unfreezeTx });

    const isNowActive = await env.publicClient.readContract({
      address: registryAddress,
      abi: artifact.abi,
      functionName: "isParticipantActive",
      args: [env.payerAccount.address],
    });
    assert.equal(isNowActive, true);
  });

  test("RiskController: regimes, dynamic reserve ratios, and permission gates", async () => {
    const env = await setupTestEnvironment();
    const artifact = loadArtifact("RiskController");

    const hash = await env.adminClient.deployContract({
      abi: artifact.abi,
      bytecode: `0x${artifact.bytecode}`,
      args: [env.adminAccount.address],
    });
    const receipt = await env.publicClient.waitForTransactionReceipt({ hash });
    const riskAddress = receipt.contractAddress;

    // Check default NORMAL regime and 10% reserve ratio (1000 bps)
    const initialRegime = await env.publicClient.readContract({
      address: riskAddress,
      abi: artifact.abi,
      functionName: "currentRegime",
    });
    assert.equal(initialRegime, 0); // NORMAL

    const normalRatio = await env.publicClient.readContract({
      address: riskAddress,
      abi: artifact.abi,
      functionName: "getRequiredReserveRatio",
    });
    assert.equal(normalRatio, 1000n);

    // Transition to CONSTRAINED
    const tx = await env.adminClient.writeContract({
      address: riskAddress,
      abi: artifact.abi,
      functionName: "setRegime",
      args: [1, "Macro liquidity contraction"], // CONSTRAINED = 1
      gas: 300_000n,
    });
    const txReceipt = await env.publicClient.waitForTransactionReceipt({ hash: tx });
    assert.equal(txReceipt.status, "success");

    const constrainedRatio = await env.publicClient.readContract({
      address: riskAddress,
      abi: artifact.abi,
      functionName: "getRequiredReserveRatio",
    });
    assert.equal(constrainedRatio, 2500n); // 25%

    // Priority checks under CONSTRAINED (CRITICAL=0 and HIGH=1 permitted; NORMAL=2 blocked)
    const isCriticalPermitted = await env.publicClient.readContract({
      address: riskAddress,
      abi: artifact.abi,
      functionName: "isSettlementPermitted",
      args: [0], // CRITICAL
    });
    assert.equal(isCriticalPermitted, true);

    const isNormalPermitted = await env.publicClient.readContract({
      address: riskAddress,
      abi: artifact.abi,
      functionName: "isSettlementPermitted",
      args: [2], // NORMAL
    });
    assert.equal(isNormalPermitted, false);
  });

  test("LiquidityManager: reservations, balance tracking, and reserve breach protection", async () => {
    const env = await setupTestEnvironment();
    const riskArtifact = loadArtifact("RiskController");
    const lmArtifact = loadArtifact("LiquidityManager");
    const erc20Artifact = loadArtifact("MockERC20");

    // Deploy Mock USDG
    const erc20Hash = await env.adminClient.deployContract({
      abi: erc20Artifact.abi,
      bytecode: `0x${erc20Artifact.bytecode}`,
      args: ["Paxos USDG", "USDG", 6],
    });
    const erc20Receipt = await env.publicClient.waitForTransactionReceipt({ hash: erc20Hash });
    const usdgAddress = erc20Receipt.contractAddress;

    // Deploy RiskController
    const riskHash = await env.adminClient.deployContract({
      abi: riskArtifact.abi,
      bytecode: `0x${riskArtifact.bytecode}`,
      args: [env.adminAccount.address],
    });
    const riskReceipt = await env.publicClient.waitForTransactionReceipt({ hash: riskHash });
    const riskAddress = riskReceipt.contractAddress;

    // Deploy LiquidityManager
    const lmHash = await env.adminClient.deployContract({
      abi: lmArtifact.abi,
      bytecode: `0x${lmArtifact.bytecode}`,
      args: [env.adminAccount.address, riskAddress],
    });
    const lmReceipt = await env.publicClient.waitForTransactionReceipt({ hash: lmHash });
    const lmAddress = lmReceipt.contractAddress;

    // Grant roles to admin for testing
    const clearRole = await env.publicClient.readContract({
      address: lmAddress,
      abi: lmArtifact.abi,
      functionName: "CLEARING_HOUSE_ROLE",
    });
    const setRole = await env.publicClient.readContract({
      address: lmAddress,
      abi: lmArtifact.abi,
      functionName: "SETTLEMENT_CONTROLLER_ROLE",
    });
    await env.adminClient.writeContract({
      address: lmAddress,
      abi: lmArtifact.abi,
      functionName: "grantRole",
      args: [clearRole, env.adminAccount.address],
    });
    await env.adminClient.writeContract({
      address: lmAddress,
      abi: lmArtifact.abi,
      functionName: "grantRole",
      args: [setRole, env.adminAccount.address],
    });

    // Transfer USDG to payer and approve LiquidityManager
    const depositAmount = 100_000_000n; // 100 USDG
    await env.adminClient.writeContract({
      address: usdgAddress,
      abi: erc20Artifact.abi,
      functionName: "transfer",
      args: [env.payerAccount.address, depositAmount],
    });
    await env.payerClient.writeContract({
      address: usdgAddress,
      abi: erc20Artifact.abi,
      functionName: "approve",
      args: [lmAddress, depositAmount],
    });

    // Payer deposits
    await env.payerClient.writeContract({
      address: lmAddress,
      abi: lmArtifact.abi,
      functionName: "deposit",
      args: [usdgAddress, depositAmount],
    });

    // Verify liquidity state
    let [total, reserved, available, reqReserve] = await env.publicClient.readContract({
      address: lmAddress,
      abi: lmArtifact.abi,
      functionName: "getLiquidityState",
      args: [env.payerAccount.address, usdgAddress],
    });
    assert.equal(total, depositAmount);
    assert.equal(reserved, 0n);
    assert.equal(available, depositAmount);
    assert.equal(reqReserve, 10_000_000n); // 10% in NORMAL regime

    // Reserve 20 USDG
    await env.adminClient.writeContract({
      address: lmAddress,
      abi: lmArtifact.abi,
      functionName: "reserve",
      args: [env.payerAccount.address, usdgAddress, 20_000_000n],
    });

    [total, reserved, available, reqReserve] = await env.publicClient.readContract({
      address: lmAddress,
      abi: lmArtifact.abi,
      functionName: "getLiquidityState",
      args: [env.payerAccount.address, usdgAddress],
    });
    assert.equal(reserved, 20_000_000n);
    assert.equal(available, 80_000_000n);

    // Try to debit 75 USDG when required reserve is 10 USDG (available 80 - 75 = 5 < 10 reserve) -> should revert
    await assert.rejects(
      async () => {
        await env.adminClient.writeContract({
          address: lmAddress,
          abi: lmArtifact.abi,
          functionName: "validateAndDebit",
          args: [env.payerAccount.address, usdgAddress, 75_000_000n],
        });
      },
      (err) => {
        return err.message.includes("PostSettlementReserveBreach") || err.message.includes("revert");
      }
    );

    // Safe debit: 60 USDG (available 80 - 60 = 20 >= 10 reserve) -> succeeds
    await env.adminClient.writeContract({
      address: lmAddress,
      abi: lmArtifact.abi,
      functionName: "validateAndDebit",
      args: [env.payerAccount.address, usdgAddress, 60_000_000n],
    });

    [total, reserved, available, reqReserve] = await env.publicClient.readContract({
      address: lmAddress,
      abi: lmArtifact.abi,
      functionName: "getLiquidityState",
      args: [env.payerAccount.address, usdgAddress],
    });
    assert.equal(total, 40_000_000n);
  });

  test("ObligationRegistry: EIP-712 structured signing, replay protection, and lifecycle", async () => {
    const env = await setupTestEnvironment();
    const partArtifact = loadArtifact("NORNParticipantRegistry");
    const obArtifact = loadArtifact("ObligationRegistry");

    // Deploy ParticipantRegistry
    const partHash = await env.adminClient.deployContract({
      abi: partArtifact.abi,
      bytecode: `0x${partArtifact.bytecode}`,
      args: [env.adminAccount.address],
    });
    const partReceipt = await env.publicClient.waitForTransactionReceipt({ hash: partHash });
    const partAddress = partReceipt.contractAddress;

    // Register payer and payee
    await env.adminClient.writeContract({
      address: partAddress,
      abi: partArtifact.abi,
      functionName: "registerParticipant",
      args: [env.payerAccount.address, 1000000n, 1000000n],
    });
    await env.adminClient.writeContract({
      address: partAddress,
      abi: partArtifact.abi,
      functionName: "registerParticipant",
      args: [env.payeeAccount.address, 1000000n, 1000000n],
    });

    // Deploy ObligationRegistry
    const obHash = await env.adminClient.deployContract({
      abi: obArtifact.abi,
      bytecode: `0x${obArtifact.bytecode}`,
      args: [env.adminAccount.address, partAddress],
    });
    const obReceipt = await env.publicClient.waitForTransactionReceipt({ hash: obHash });
    const obAddress = obReceipt.contractAddress;

    const dummyAsset = "0x0000000000000000000000000000000000000001";
    const obId = keccak256(stringToHex("obligation-genesis-001"));
    const referenceHash = keccak256(stringToHex("ref-invoice-9921"));
    const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 86400);

    const obligationParams = {
      id: obId,
      payer: env.payerAccount.address,
      payee: env.payeeAccount.address,
      asset: dummyAsset,
      amount: 50_000_000n,
      nonce: 1n,
      expiresAt: expiresAt,
      priority: 2, // NORMAL
      referenceHash: referenceHash,
    };

    // Sign typed obligation adhering to EIP-712
    const signature = await env.payerClient.signTypedData({
      domain: {
        name: "NORN Obligation Protocol",
        version: "1",
        chainId: 31337,
        verifyingContract: obAddress,
      },
      types: {
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
      },
      primaryType: "Obligation",
      message: {
        id: obligationParams.id,
        payer: obligationParams.payer,
        payee: obligationParams.payee,
        asset: obligationParams.asset,
        amount: obligationParams.amount,
        nonce: obligationParams.nonce,
        expiresAt: obligationParams.expiresAt,
        priority: obligationParams.priority,
        referenceHash: obligationParams.referenceHash,
      },
    });

    // Submit obligation to contract
    const submitTx = await env.adminClient.writeContract({
      address: obAddress,
      abi: obArtifact.abi,
      functionName: "submitObligation",
      args: [obligationParams, signature],
    });
    await env.publicClient.waitForTransactionReceipt({ hash: submitTx });

    // Verify stored obligation
    const savedOb = await env.publicClient.readContract({
      address: obAddress,
      abi: obArtifact.abi,
      functionName: "getObligation",
      args: [obId],
    });
    assert.equal(savedOb.status, 2); // ACCEPTED

    // Verify Replay Protection: submitting same nonce must revert
    await assert.rejects(
      async () => {
        await env.adminClient.writeContract({
          address: obAddress,
          abi: obArtifact.abi,
          functionName: "submitObligation",
          args: [
            {
              ...obligationParams,
              id: keccak256(stringToHex("obligation-genesis-002")),
            },
            signature,
          ],
        });
      },
      (err) => err.message.includes("NonceAlreadyUsed") || err.message.includes("revert")
    );
  });

  test("End-to-End: Commit clearing batch and execute settlement", async () => {
    const env = await setupTestEnvironment();
    const partArtifact = loadArtifact("NORNParticipantRegistry");
    const riskArtifact = loadArtifact("RiskController");
    const lmArtifact = loadArtifact("LiquidityManager");
    const obArtifact = loadArtifact("ObligationRegistry");
    const chArtifact = loadArtifact("ClearingHouse");
    const scArtifact = loadArtifact("SettlementController");
    const erc20Artifact = loadArtifact("MockERC20");

    // Deploy contracts
    const partReceipt = await env.publicClient.waitForTransactionReceipt({
      hash: await env.adminClient.deployContract({
        abi: partArtifact.abi,
        bytecode: `0x${partArtifact.bytecode}`,
        args: [env.adminAccount.address],
      }),
    });
    const riskReceipt = await env.publicClient.waitForTransactionReceipt({
      hash: await env.adminClient.deployContract({
        abi: riskArtifact.abi,
        bytecode: `0x${riskArtifact.bytecode}`,
        args: [env.adminAccount.address],
      }),
    });
    const lmReceipt = await env.publicClient.waitForTransactionReceipt({
      hash: await env.adminClient.deployContract({
        abi: lmArtifact.abi,
        bytecode: `0x${lmArtifact.bytecode}`,
        args: [env.adminAccount.address, riskReceipt.contractAddress],
      }),
    });
    const obReceipt = await env.publicClient.waitForTransactionReceipt({
      hash: await env.adminClient.deployContract({
        abi: obArtifact.abi,
        bytecode: `0x${obArtifact.bytecode}`,
        args: [env.adminAccount.address, partReceipt.contractAddress],
      }),
    });
    const chReceipt = await env.publicClient.waitForTransactionReceipt({
      hash: await env.adminClient.deployContract({
        abi: chArtifact.abi,
        bytecode: `0x${chArtifact.bytecode}`,
        args: [env.adminAccount.address],
      }),
    });
    const scReceipt = await env.publicClient.waitForTransactionReceipt({
      hash: await env.adminClient.deployContract({
        abi: scArtifact.abi,
        bytecode: `0x${scArtifact.bytecode}`,
        args: [
          env.adminAccount.address,
          chReceipt.contractAddress,
          lmReceipt.contractAddress,
          obReceipt.contractAddress,
          partReceipt.contractAddress,
        ],
      }),
    });

    const scAddress = scReceipt.contractAddress;
    const lmAddress = lmReceipt.contractAddress;
    const obAddress = obReceipt.contractAddress;
    const chAddress = chReceipt.contractAddress;
    const partAddress = partReceipt.contractAddress;

    // Grant roles to SettlementController and ClearingHouse
    const scRole = await env.publicClient.readContract({
      address: lmAddress,
      abi: lmArtifact.abi,
      functionName: "SETTLEMENT_CONTROLLER_ROLE",
    });
    await env.adminClient.writeContract({
      address: lmAddress,
      abi: lmArtifact.abi,
      functionName: "grantRole",
      args: [scRole, scAddress],
    });

    const setRoleInOb = await env.publicClient.readContract({
      address: obAddress,
      abi: obArtifact.abi,
      functionName: "SETTLEMENT_ROLE",
    });
    await env.adminClient.writeContract({
      address: obAddress,
      abi: obArtifact.abi,
      functionName: "grantRole",
      args: [setRoleInOb, scAddress],
    });

    const opRoleInCh = await env.publicClient.readContract({
      address: chAddress,
      abi: chArtifact.abi,
      functionName: "OPERATOR_ROLE",
    });
    await env.adminClient.writeContract({
      address: chAddress,
      abi: chArtifact.abi,
      functionName: "grantRole",
      args: [opRoleInCh, scAddress],
    });

    // Deploy test token & seed liquidity
    const erc20Receipt = await env.publicClient.waitForTransactionReceipt({
      hash: await env.adminClient.deployContract({
        abi: erc20Artifact.abi,
        bytecode: `0x${erc20Artifact.bytecode}`,
        args: ["Mock USDG", "USDG", 6],
      }),
    });
    const tokenAddress = erc20Receipt.contractAddress;

    // Register participants
    await env.adminClient.writeContract({
      address: partAddress,
      abi: partArtifact.abi,
      functionName: "registerParticipant",
      args: [env.payerAccount.address, 1000000n, 1000000n],
    });
    await env.adminClient.writeContract({
      address: partAddress,
      abi: partArtifact.abi,
      functionName: "registerParticipant",
      args: [env.payeeAccount.address, 1000000n, 1000000n],
    });

    // Fund payer and deposit to LiquidityManager
    await env.adminClient.writeContract({
      address: tokenAddress,
      abi: erc20Artifact.abi,
      functionName: "transfer",
      args: [env.payerAccount.address, 100_000_000n],
    });
    await env.payerClient.writeContract({
      address: tokenAddress,
      abi: erc20Artifact.abi,
      functionName: "approve",
      args: [lmAddress, 100_000_000n],
    });
    await env.payerClient.writeContract({
      address: lmAddress,
      abi: lmArtifact.abi,
      functionName: "deposit",
      args: [tokenAddress, 100_000_000n],
    });

    // Create & submit obligation
    const obId = keccak256(stringToHex("epoch-1-ob-01"));
    const obParams = {
      id: obId,
      payer: env.payerAccount.address,
      payee: env.payeeAccount.address,
      asset: tokenAddress,
      amount: 40_000_000n, // 40 USDG
      nonce: 1n,
      expiresAt: BigInt(Math.floor(Date.now() / 1000) + 86400),
      priority: 0, // CRITICAL
      referenceHash: keccak256(stringToHex("ref-1")),
    };

    const sig = await env.payerClient.signTypedData({
      domain: {
        name: "NORN Obligation Protocol",
        version: "1",
        chainId: 31337,
        verifyingContract: obAddress,
      },
      types: {
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
      },
      primaryType: "Obligation",
      message: obParams,
    });

    await env.adminClient.writeContract({
      address: obAddress,
      abi: obArtifact.abi,
      functionName: "submitObligation",
      args: [obParams, sig],
    });

    // Commit clearing batch
    const batchId = keccak256(stringToHex("batch-epoch-1"));
    const obligationRoot = keccak256(stringToHex("root-obligations"));
    const participantNetRoot = keccak256(stringToHex("root-net-positions"));
    const settlementRoot = keccak256(stringToHex("root-settlement-transfers"));
    const validUntil = BigInt(Math.floor(Date.now() / 1000) + 3600);

    await env.adminClient.writeContract({
      address: chAddress,
      abi: chArtifact.abi,
      functionName: "commitBatch",
      args: [1n, batchId, obligationRoot, participantNetRoot, settlementRoot, validUntil],
    });

    // Execute settlement transfer: 40 USDG net transfer from payer to payee
    const transfers = [
      {
        payer: env.payerAccount.address,
        payee: env.payeeAccount.address,
        asset: tokenAddress,
        amount: 40_000_000n,
        sourceObligations: [obId],
      },
    ];

    const execTx = await env.adminClient.writeContract({
      address: scAddress,
      abi: scArtifact.abi,
      functionName: "executeBatchSettlement",
      args: [batchId, transfers, [obId]],
    });
    await env.publicClient.waitForTransactionReceipt({ hash: execTx });

    // Verify payer debited, payee credited
    const [payerTotal] = await env.publicClient.readContract({
      address: lmAddress,
      abi: lmArtifact.abi,
      functionName: "getLiquidityState",
      args: [env.payerAccount.address, tokenAddress],
    });
    const [payeeTotal] = await env.publicClient.readContract({
      address: lmAddress,
      abi: lmArtifact.abi,
      functionName: "getLiquidityState",
      args: [env.payeeAccount.address, tokenAddress],
    });
    assert.equal(payerTotal, 60_000_000n);
    assert.equal(payeeTotal, 40_000_000n);

    // Verify obligation status is SETTLED (status == 4)
    const settledOb = await env.publicClient.readContract({
      address: obAddress,
      abi: obArtifact.abi,
      functionName: "getObligation",
      args: [obId],
    });
    assert.equal(settledOb.status, 4); // SETTLED

    // Verify double-settlement protection: executing same batch again reverts
    await assert.rejects(
      async () => {
        await env.adminClient.writeContract({
          address: scAddress,
          abi: scArtifact.abi,
          functionName: "executeBatchSettlement",
          args: [batchId, transfers, [obId]],
        });
      },
      (err) => err.message.includes("BatchAlreadySettled") || err.message.includes("revert")
    );
  });
});
