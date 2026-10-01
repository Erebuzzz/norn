import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { encodeEventTopics, encodeAbiParameters, parseAbiItem } from "viem";

import {
  QuickNodeClient,
  EventNormalizer,
  StreamConsumer,
  InMemoryCheckpointStorage,
  NORN_EVENT_ABIS
} from "../../packages/quicknode/dist/index.js";

describe("NORN QuickNode Integration Suite", () => {
  const CHAIN_ID = 1337;
  const CONTRACT_ADDR = "0x1111111111111111111111111111111111111111";

  describe("EventNormalizer", () => {
    let normalizer;

    beforeEach(() => {
      normalizer = new EventNormalizer();
    });

    test("Decodes SettlementExecuted event correctly", () => {
      const batchId = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      const payer = "0x2222222222222222222222222222222222222222";
      const payee = "0x3333333333333333333333333333333333333333";
      const asset = "0x4444444444444444444444444444444444444444";
      const amount = 5000000n;

      const topics = encodeEventTopics({
        abi: [
          parseAbiItem(
            "event SettlementExecuted(bytes32 indexed batchId, address indexed payer, address indexed payee, address asset, uint256 amount)"
          )
        ],
        eventName: "SettlementExecuted",
        args: { batchId, payer, payee }
      });

      const data = encodeAbiParameters(
        [
          { type: "address", name: "asset" },
          { type: "uint256", name: "amount" }
        ],
        [asset, amount]
      );

      const rawLog = {
        address: CONTRACT_ADDR,
        topics,
        data,
        blockNumber: "0x64", // 100 in hex
        transactionHash: "0xaaaa1111222233334444555566667777888899990000aaaabbbbccccddddeeee",
        logIndex: "0x2"
      };

      const event = normalizer.normalizeLog(rawLog, CHAIN_ID);
      assert.ok(event, "Event should not be null");
      assert.equal(event.chainId, CHAIN_ID);
      assert.equal(event.blockNumber, 100n);
      assert.equal(event.logIndex, 2);
      assert.equal(event.eventName, "SettlementExecuted");
      assert.equal(event.contract, CONTRACT_ADDR.toLowerCase());
      assert.equal(event.args.batchId, batchId);
      assert.equal(event.args.payer?.toLowerCase(), payer.toLowerCase());
      assert.equal(event.args.payee?.toLowerCase(), payee.toLowerCase());
      assert.equal(event.args.asset?.toLowerCase(), asset.toLowerCase());
      assert.equal(event.args.amount, amount);
      assert.ok(event.observedAt);
    });

    test("Decodes RiskRegimeChanged event correctly", () => {
      const topics = encodeEventTopics({
        abi: [
          parseAbiItem(
            "event RiskRegimeChanged(uint8 indexed previousRegime, uint8 indexed newRegime, string reason)"
          )
        ],
        eventName: "RiskRegimeChanged",
        args: { previousRegime: 0, newRegime: 1 }
      });

      const data = encodeAbiParameters(
        [{ type: "string", name: "reason" }],
        ["High volatility detected"]
      );

      const rawLog = {
        address: CONTRACT_ADDR,
        topics,
        data,
        blockNumber: 105n,
        transactionHash: "0xbbbb1111222233334444555566667777888899990000aaaabbbbccccddddeeee",
        logIndex: 0
      };

      const event = normalizer.normalizeLog(rawLog, CHAIN_ID);
      assert.ok(event);
      assert.equal(event.eventName, "RiskRegimeChanged");
      assert.equal(event.args.previousRegime, 0);
      assert.equal(event.args.newRegime, 1);
      assert.equal(event.args.reason, "High volatility detected");
    });

    test("Decodes ObligationRegistered event correctly", () => {
      const obligationId = "0x9876543210abcdef9876543210abcdef9876543210abcdef9876543210abcdef";
      const payer = "0x2222222222222222222222222222222222222222";
      const payee = "0x3333333333333333333333333333333333333333";
      const asset = "0x4444444444444444444444444444444444444444";
      const amount = 125000n;
      const dueDate = 1800000000n;

      const topics = encodeEventTopics({
        abi: [
          parseAbiItem(
            "event ObligationRegistered(bytes32 indexed obligationId, address indexed payer, address indexed payee, address asset, uint256 amount, uint256 dueDate)"
          )
        ],
        eventName: "ObligationRegistered",
        args: { obligationId, payer, payee }
      });

      const data = encodeAbiParameters(
        [
          { type: "address", name: "asset" },
          { type: "uint256", name: "amount" },
          { type: "uint256", name: "dueDate" }
        ],
        [asset, amount, dueDate]
      );

      const rawLog = {
        address: CONTRACT_ADDR,
        topics,
        data,
        blockNumber: 110n,
        transactionHash: "0xcccc1111222233334444555566667777888899990000aaaabbbbccccddddeeee",
        logIndex: 1
      };

      const event = normalizer.normalizeLog(rawLog, CHAIN_ID);
      assert.ok(event);
      assert.equal(event.eventName, "ObligationRegistered");
      assert.equal(event.args.obligationId, obligationId);
      assert.equal(event.args.amount, amount);
      assert.equal(event.args.dueDate, dueDate);
    });

    test("Decodes LiquidityDeposited event correctly", () => {
      const participant = "0x2222222222222222222222222222222222222222";
      const asset = "0x4444444444444444444444444444444444444444";
      const amount = 999999n;

      const topics = encodeEventTopics({
        abi: [
          parseAbiItem(
            "event LiquidityDeposited(address indexed participant, address indexed asset, uint256 amount)"
          )
        ],
        eventName: "LiquidityDeposited",
        args: { participant, asset }
      });

      const data = encodeAbiParameters([{ type: "uint256", name: "amount" }], [amount]);

      const rawLog = {
        address: CONTRACT_ADDR,
        topics,
        data,
        blockNumber: 115n,
        transactionHash: "0xdddd1111222233334444555566667777888899990000aaaabbbbccccddddeeee",
        logIndex: 3
      };

      const event = normalizer.normalizeLog(rawLog, CHAIN_ID);
      assert.ok(event);
      assert.equal(event.eventName, "LiquidityDeposited");
      assert.equal(event.args.amount, amount);
    });

    test("Decodes EmergencyFreezeToggled event correctly", () => {
      const triggeredBy = "0x5555555555555555555555555555555555555555";
      const reason = "Severe liquidity shock detected";

      const topics = encodeEventTopics({
        abi: [
          parseAbiItem(
            "event EmergencyFreezeToggled(bool indexed frozen, address indexed triggeredBy, string reason)"
          )
        ],
        eventName: "EmergencyFreezeToggled",
        args: { frozen: true, triggeredBy }
      });

      const data = encodeAbiParameters([{ type: "string", name: "reason" }], [reason]);

      const rawLog = {
        address: CONTRACT_ADDR,
        topics,
        data,
        blockNumber: 120n,
        transactionHash: "0xeeee1111222233334444555566667777888899990000aaaabbbbccccddddeeee",
        logIndex: 4
      };

      const event = normalizer.normalizeLog(rawLog, CHAIN_ID);
      assert.ok(event);
      assert.equal(event.eventName, "EmergencyFreezeToggled");
      assert.equal(event.args.frozen, true);
      assert.equal(event.args.triggeredBy?.toLowerCase(), triggeredBy.toLowerCase());
      assert.equal(event.args.reason, reason);
    });

    test("Generates deterministic unique event IDs", () => {
      const txHash = "0xAbCdEf1234567890AbCdEf1234567890AbCdEf1234567890AbCdEf1234567890";
      const logIndex = 7;
      const expectedId = `1337-${txHash.toLowerCase()}-7`;

      const id1 = EventNormalizer.getEventId(CHAIN_ID, txHash, logIndex);
      assert.equal(id1, expectedId);

      const event = {
        chainId: CHAIN_ID,
        blockNumber: 100n,
        txHash,
        logIndex,
        contract: CONTRACT_ADDR,
        eventName: "SettlementExecuted",
        args: {},
        observedAt: new Date().toISOString()
      };

      const id2 = EventNormalizer.getEventIdFromEvent(event);
      assert.equal(id2, expectedId);
    });

    test("Returns null for unrecognized or empty logs", () => {
      const unknownLog = {
        address: CONTRACT_ADDR,
        topics: ["0x0000000000000000000000000000000000000000000000000000000000000000"],
        data: "0x",
        blockNumber: 10n,
        transactionHash: "0x123",
        logIndex: 0
      };

      const result = normalizer.normalizeLog(unknownLog, CHAIN_ID);
      assert.equal(result, null);

      const emptyLog = {
        address: CONTRACT_ADDR,
        topics: [],
        data: "0x"
      };
      assert.equal(normalizer.normalizeLog(emptyLog, CHAIN_ID), null);
    });

    test("normalizeBatch processes batches and skips invalid logs", () => {
      const validTopics = encodeEventTopics({
        abi: [
          parseAbiItem(
            "event RiskRegimeChanged(uint8 indexed previousRegime, uint8 indexed newRegime, string reason)"
          )
        ],
        eventName: "RiskRegimeChanged",
        args: { previousRegime: 0, newRegime: 1 }
      });
      const validData = encodeAbiParameters([{ type: "string", name: "reason" }], ["Batch test"]);

      const logs = [
        {
          address: CONTRACT_ADDR,
          topics: validTopics,
          data: validData,
          blockNumber: 1n,
          transactionHash: "0x1",
          logIndex: 0
        },
        {
          address: CONTRACT_ADDR,
          topics: ["0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"],
          data: "0x",
          blockNumber: 1n,
          transactionHash: "0x2",
          logIndex: 1
        },
        {
          address: CONTRACT_ADDR,
          topics: validTopics,
          data: validData,
          blockNumber: 2n,
          transactionHash: "0x3",
          logIndex: 0
        }
      ];

      const events = normalizer.normalizeBatch(logs, CHAIN_ID);
      assert.equal(events.length, 2);
      assert.equal(events[0].blockNumber, 1n);
      assert.equal(events[1].blockNumber, 2n);
    });
  });

  describe("QuickNodeClient", () => {
    test("Initializes with config parameters and defaults", () => {
      const client = new QuickNodeClient({
        endpointUrl: "https://example.quicknode.pro/mock-key",
        chainId: CHAIN_ID,
        timeoutMs: 5000,
        maxRetries: 2,
        backoffBaseMs: 50
      });

      assert.equal(client.endpointUrl, "https://example.quicknode.pro/mock-key");
      assert.equal(client.chainId, CHAIN_ID);
      assert.equal(client.timeoutMs, 5000);
      assert.equal(client.maxRetries, 2);
      assert.equal(client.backoffBaseMs, 50);
    });

    test("Throws error if endpointUrl is missing", () => {
      assert.throws(
        () => new QuickNodeClient({ endpointUrl: "", chainId: 1 }),
        /requires a valid endpointUrl/
      );
    });

    test("Executes RPC call with simulated transient retries and succeeds", async () => {
      let callCount = 0;
      const mockFetch = async () => {
        callCount++;
        if (callCount < 3) {
          // Simulate transient 503 service unavailable
          return {
            ok: false,
            status: 503,
            statusText: "Service Unavailable"
          };
        }
        // Succeed on 3rd attempt
        return {
          ok: true,
          json: async () => ({
            jsonrpc: "2.0",
            id: 1,
            result: "0x42"
          })
        };
      };

      const client = new QuickNodeClient(
        {
          endpointUrl: "https://mock-node.internal",
          chainId: CHAIN_ID,
          maxRetries: 4,
          backoffBaseMs: 10 // Fast backoff for tests
        },
        mockFetch
      );

      const blockNumber = await client.getBlockNumber();
      assert.equal(blockNumber, 66n); // 0x42 = 66
      assert.equal(callCount, 3, "Should have retried twice and succeeded on 3rd call");
    });

    test("Exhausts retries and throws error on persistent failure", async () => {
      let callCount = 0;
      const mockFetch = async () => {
        callCount++;
        return {
          ok: false,
          status: 500,
          statusText: "Internal Server Error"
        };
      };

      const client = new QuickNodeClient(
        {
          endpointUrl: "https://mock-node.internal",
          chainId: CHAIN_ID,
          maxRetries: 2,
          backoffBaseMs: 10
        },
        mockFetch
      );

      await assert.rejects(
        async () => await client.getBlockNumber(),
        /failed after 3 attempts/
      );
      assert.equal(callCount, 3);
    });

    test("Health check succeeds when node is responsive and chainId matches", async () => {
      const mockFetch = async (url, opts) => {
        const body = JSON.parse(opts.body);
        let result = "0x0";
        if (body.method === "eth_blockNumber") result = "0x64"; // 100
        if (body.method === "eth_chainId") result = `0x${CHAIN_ID.toString(16)}`;

        return {
          ok: true,
          json: async () => ({
            jsonrpc: "2.0",
            id: body.id,
            result
          })
        };
      };

      const client = new QuickNodeClient(
        {
          endpointUrl: "https://mock-node.internal",
          chainId: CHAIN_ID,
          maxRetries: 1,
          backoffBaseMs: 10
        },
        mockFetch
      );

      const health = await client.checkHealth();
      assert.equal(health.healthy, true);
      assert.equal(health.chainId, CHAIN_ID);
      assert.equal(health.blockNumber, 100n);
      assert.ok(health.latencyMs >= 0);
      assert.equal(health.error, undefined);
    });

    test("Health check fails when chainId does not match configuration", async () => {
      const mockFetch = async (url, opts) => {
        const body = JSON.parse(opts.body);
        let result = "0x0";
        if (body.method === "eth_blockNumber") result = "0x64";
        if (body.method === "eth_chainId") result = "0x1"; // Mainnet 1 instead of 1337

        return {
          ok: true,
          json: async () => ({
            jsonrpc: "2.0",
            id: body.id,
            result
          })
        };
      };

      const client = new QuickNodeClient(
        {
          endpointUrl: "https://mock-node.internal",
          chainId: CHAIN_ID,
          maxRetries: 1,
          backoffBaseMs: 10
        },
        mockFetch
      );

      const health = await client.checkHealth();
      assert.equal(health.healthy, false);
      assert.equal(health.chainId, 1);
      assert.match(health.error, /Chain ID mismatch/);
    });

    test("Health check reports failure on network connection error", async () => {
      const mockFetch = async () => {
        throw new Error("Connection reset by peer");
      };

      const client = new QuickNodeClient(
        {
          endpointUrl: "https://mock-node.internal",
          chainId: CHAIN_ID,
          maxRetries: 0,
          backoffBaseMs: 5
        },
        mockFetch
      );

      const health = await client.checkHealth();
      assert.equal(health.healthy, false);
      assert.match(health.error, /Connection reset by peer/);
    });
  });

  describe("StreamConsumer & Deduplication", () => {
    let consumer;
    let normalizer;

    beforeEach(() => {
      normalizer = new EventNormalizer();
      consumer = new StreamConsumer(CHAIN_ID, { dedupeLimit: 50 }, normalizer);
    });

    test("Deduplicates identical events correctly", async () => {
      const dispatched = [];
      consumer.on("SettlementExecuted", (ev) => {
        dispatched.push(ev);
      });

      const event = {
        chainId: CHAIN_ID,
        blockNumber: 100n,
        txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
        logIndex: 0,
        contract: CONTRACT_ADDR,
        eventName: "SettlementExecuted",
        args: { batchId: "0x1" },
        observedAt: new Date().toISOString()
      };

      const firstBatch = await consumer.ingestEvents([event]);
      assert.equal(firstBatch.length, 1);
      assert.equal(dispatched.length, 1);

      // Ingest the exact same event again
      const secondBatch = await consumer.ingestEvents([event]);
      assert.equal(secondBatch.length, 0, "Duplicate event must be dropped");
      assert.equal(dispatched.length, 1, "Listener should not receive duplicate");
    });

    test("Maintains bounded deduplication cache limit with eviction", () => {
      const smallConsumer = new StreamConsumer(CHAIN_ID, { dedupeLimit: 10 });

      for (let i = 0; i < 15; i++) {
        smallConsumer.markSeen(`event-${i}`);
      }

      // Should not grow unbounded
      assert.ok(smallConsumer.getCacheSize() <= 12);
      // Latest entries should be present
      assert.equal(smallConsumer.isDuplicate("event-14"), true);
    });

    test("Dispatches events to specific and wildcard listeners", async () => {
      let specificCount = 0;
      let wildcardCount = 0;

      const unsubSpecific = consumer.on("RiskRegimeChanged", () => {
        specificCount++;
      });
      const unsubWildcard = consumer.onAny(() => {
        wildcardCount++;
      });

      const event1 = {
        chainId: CHAIN_ID,
        blockNumber: 200n,
        txHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
        logIndex: 0,
        contract: CONTRACT_ADDR,
        eventName: "RiskRegimeChanged",
        args: { previousRegime: 0, newRegime: 1 },
        observedAt: new Date().toISOString()
      };

      const event2 = {
        chainId: CHAIN_ID,
        blockNumber: 201n,
        txHash: "0x3333333333333333333333333333333333333333333333333333333333333333",
        logIndex: 0,
        contract: CONTRACT_ADDR,
        eventName: "SettlementExecuted",
        args: {},
        observedAt: new Date().toISOString()
      };

      await consumer.ingestEvents([event1, event2]);

      assert.equal(specificCount, 1, "Only RiskRegimeChanged triggers specific listener");
      assert.equal(wildcardCount, 2, "Both events trigger wildcard listener");

      // Unsubscribe and verify no further triggers
      unsubSpecific();
      unsubWildcard();

      const event3 = {
        chainId: CHAIN_ID,
        blockNumber: 202n,
        txHash: "0x4444444444444444444444444444444444444444444444444444444444444444",
        logIndex: 0,
        contract: CONTRACT_ADDR,
        eventName: "RiskRegimeChanged",
        args: {},
        observedAt: new Date().toISOString()
      };

      await consumer.ingestEvents([event3]);
      assert.equal(specificCount, 1);
      assert.equal(wildcardCount, 2);
    });

    test("Sorts ingested events in ascending order by blockNumber and logIndex", async () => {
      const order = [];
      consumer.onAny((ev) => {
        order.push(`${ev.blockNumber}:${ev.logIndex}`);
      });

      const events = [
        {
          chainId: CHAIN_ID,
          blockNumber: 105n,
          txHash: "0xa1",
          logIndex: 2,
          contract: CONTRACT_ADDR,
          eventName: "SettlementExecuted",
          args: {},
          observedAt: new Date().toISOString()
        },
        {
          chainId: CHAIN_ID,
          blockNumber: 100n,
          txHash: "0xa2",
          logIndex: 5,
          contract: CONTRACT_ADDR,
          eventName: "SettlementExecuted",
          args: {},
          observedAt: new Date().toISOString()
        },
        {
          chainId: CHAIN_ID,
          blockNumber: 105n,
          txHash: "0xa3",
          logIndex: 0,
          contract: CONTRACT_ADDR,
          eventName: "SettlementExecuted",
          args: {},
          observedAt: new Date().toISOString()
        }
      ];

      await consumer.ingestEvents(events);
      assert.deepEqual(order, ["100:5", "105:0", "105:2"]);
    });

    test("Extracts and processes QuickNode stream payloads (blocks and data arrays)", async () => {
      const topics = encodeEventTopics({
        abi: [
          parseAbiItem(
            "event RiskRegimeChanged(uint8 indexed previousRegime, uint8 indexed newRegime, string reason)"
          )
        ],
        eventName: "RiskRegimeChanged",
        args: { previousRegime: 0, newRegime: 2 }
      });
      const data = encodeAbiParameters([{ type: "string", name: "reason" }], ["Defensive mode"]);

      const payload = {
        data: [
          {
            address: CONTRACT_ADDR,
            topics,
            data,
            blockNumber: "0x12c", // 300
            transactionHash: "0x55551111222233334444555566667777888899990000aaaabbbbccccddddeeee",
            logIndex: "0x1"
          }
        ]
      };

      const accepted = await consumer.ingestStreamPayload(payload);
      assert.equal(accepted.length, 1);
      assert.equal(accepted[0].eventName, "RiskRegimeChanged");
      assert.equal(accepted[0].blockNumber, 300n);
      assert.equal(accepted[0].logIndex, 1);
    });
  });

  describe("Checkpoint State Management & Replay", () => {
    test("Saves and loads checkpoint through storage", async () => {
      const storage = new InMemoryCheckpointStorage();
      const consumer = new StreamConsumer(CHAIN_ID, { storage });

      const checkpoint = {
        chainId: CHAIN_ID,
        lastBlockNumber: 500n,
        lastTxHash: "0x66661111222233334444555566667777888899990000aaaabbbbccccddddeeee",
        lastLogIndex: 3,
        updatedAt: new Date().toISOString()
      };

      await consumer.saveCheckpoint(checkpoint);
      const loaded = await consumer.loadCheckpoint();

      assert.ok(loaded);
      assert.equal(loaded.chainId, CHAIN_ID);
      assert.equal(loaded.lastBlockNumber, 500n);
      assert.equal(loaded.lastTxHash, checkpoint.lastTxHash);
      assert.equal(loaded.lastLogIndex, 3);
    });

    test("Replay skips already processed logs and ingests newer events", async () => {
      const storage = new InMemoryCheckpointStorage();
      const consumer = new StreamConsumer(CHAIN_ID, { storage });

      // Establish initial checkpoint at block 100, logIndex 2
      await consumer.saveCheckpoint({
        chainId: CHAIN_ID,
        lastBlockNumber: 100n,
        lastTxHash: "0x1111",
        lastLogIndex: 2,
        updatedAt: new Date().toISOString()
      });

      const replayedDispatches = [];
      consumer.onAny((ev) => replayedDispatches.push(ev));

      // Simulated query returning logs spanning before, at, and after the checkpoint
      const mockQueryLogs = async (fromBlock) => {
        assert.equal(fromBlock, 100n);
        return [
          {
            chainId: CHAIN_ID,
            blockNumber: 99n, // Before checkpoint -> skip
            txHash: "0xold",
            logIndex: 0,
            contract: CONTRACT_ADDR,
            eventName: "SettlementExecuted",
            args: {},
            observedAt: new Date().toISOString()
          },
          {
            chainId: CHAIN_ID,
            blockNumber: 100n, // Same block, lower logIndex -> skip
            txHash: "0xsame_prior",
            logIndex: 1,
            contract: CONTRACT_ADDR,
            eventName: "SettlementExecuted",
            args: {},
            observedAt: new Date().toISOString()
          },
          {
            chainId: CHAIN_ID,
            blockNumber: 100n, // Same block, exact logIndex -> skip
            txHash: "0xsame_exact",
            logIndex: 2,
            contract: CONTRACT_ADDR,
            eventName: "SettlementExecuted",
            args: {},
            observedAt: new Date().toISOString()
          },
          {
            chainId: CHAIN_ID,
            blockNumber: 100n, // Same block, higher logIndex -> accept
            txHash: "0xsame_next",
            logIndex: 3,
            contract: CONTRACT_ADDR,
            eventName: "SettlementExecuted",
            args: {},
            observedAt: new Date().toISOString()
          },
          {
            chainId: CHAIN_ID,
            blockNumber: 101n, // Higher block -> accept
            txHash: "0xnew_block",
            logIndex: 0,
            contract: CONTRACT_ADDR,
            eventName: "SettlementExecuted",
            args: {},
            observedAt: new Date().toISOString()
          }
        ];
      };

      const replayedCount = await consumer.replayFromCheckpoint(undefined, mockQueryLogs);
      assert.equal(replayedCount, 2, "Only logs after checkpoint should be replayed");
      assert.equal(replayedDispatches.length, 2);
      assert.equal(replayedDispatches[0].logIndex, 3);
      assert.equal(replayedDispatches[1].blockNumber, 101n);

      // Verify checkpoint advanced to latest replayed event
      const updatedCp = consumer.getCheckpoint();
      assert.ok(updatedCp);
      assert.equal(updatedCp.lastBlockNumber, 101n);
      assert.equal(updatedCp.lastLogIndex, 0);
    });

    test("Reorg/Recovery scenario: resumes from safe checkpoint without duplicating data", async () => {
      const storage = new InMemoryCheckpointStorage();
      const consumer = new StreamConsumer(CHAIN_ID, { storage });

      // Initial stream ingestion: Blocks 50 to 52
      const batch1 = [
        {
          chainId: CHAIN_ID,
          blockNumber: 50n,
          txHash: "0x50",
          logIndex: 0,
          contract: CONTRACT_ADDR,
          eventName: "SettlementExecuted",
          args: {},
          observedAt: new Date().toISOString()
        },
        {
          chainId: CHAIN_ID,
          blockNumber: 51n,
          txHash: "0x51",
          logIndex: 0,
          contract: CONTRACT_ADDR,
          eventName: "SettlementExecuted",
          args: {},
          observedAt: new Date().toISOString()
        }
      ];

      await consumer.ingestEvents(batch1);
      await consumer.saveCheckpoint();

      // Safe checkpoint saved at block 51, log 0
      const safeCheckpoint = consumer.getCheckpoint();
      assert.equal(safeCheckpoint?.lastBlockNumber, 51n);

      // Provider restart: recreate consumer using persisted storage
      const recoveredConsumer = new StreamConsumer(CHAIN_ID, { storage });
      await recoveredConsumer.loadCheckpoint();
      assert.equal(recoveredConsumer.getCheckpoint()?.lastBlockNumber, 51n);

      const recoveredEvents = [];
      recoveredConsumer.onAny((ev) => recoveredEvents.push(ev));

      // Provider reconnects and streams from block 51 forward
      const postRecoveryLogs = async () => [
        {
          chainId: CHAIN_ID,
          blockNumber: 51n, // At checkpoint -> should be skipped
          txHash: "0x51",
          logIndex: 0,
          contract: CONTRACT_ADDR,
          eventName: "SettlementExecuted",
          args: {},
          observedAt: new Date().toISOString()
        },
        {
          chainId: CHAIN_ID,
          blockNumber: 52n, // New block -> should be processed
          txHash: "0x52",
          logIndex: 0,
          contract: CONTRACT_ADDR,
          eventName: "SettlementExecuted",
          args: {},
          observedAt: new Date().toISOString()
        }
      ];

      const replayed = await recoveredConsumer.replayFromCheckpoint(undefined, postRecoveryLogs);
      assert.equal(replayed, 1);
      assert.equal(recoveredEvents.length, 1);
      assert.equal(recoveredEvents[0].blockNumber, 52n);
      assert.equal(recoveredConsumer.getCheckpoint()?.lastBlockNumber, 52n);
    });
  });
});
