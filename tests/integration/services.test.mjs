import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  handleSearch,
  handleData,
  handleInference,
  handleWeather,
  handleCompute,
  dispatchServiceRequest,
  SEARCH_PROVIDER_ADDRESS,
  DATA_PROVIDER_ADDRESS,
  INFERENCE_PROVIDER_ADDRESS,
  WEATHER_PROVIDER_ADDRESS,
  COMPUTE_PROVIDER_ADDRESS,
  SEARCH_PRICE_UNITS,
  DATA_PRICE_UNITS,
  INFERENCE_PRICE_UNITS,
  WEATHER_PRICE_UNITS,
  COMPUTE_PRICE_UNITS,
} from "../../services/dist/index.js";
import {
  MachinePaymentAdapter,
  ObligationPriority,
} from "../../packages/machine-payments/dist/index.js";
import { CreanceAgent } from "../../packages/agents/dist/index.js";

const TEST_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const COUNTERPARTY_PRIVATE_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

describe("NORN Machine Micro-Services & Payment Integration Suite", () => {
  test("Machine Services: all 5 micro-services return correct payloads, prices, and payment metadata", async () => {
    // 1. /search ($0.01)
    const searchRes = await handleSearch({ query: "multilateral clearing" });
    assert.equal(searchRes.success, true);
    assert.equal(searchRes.service, "search");
    assert.equal(searchRes.payment.price, "0.01");
    assert.equal(searchRes.payment.priceUnits, SEARCH_PRICE_UNITS);
    assert.equal(searchRes.payment.provider, SEARCH_PROVIDER_ADDRESS);
    assert.equal(searchRes.payment.paymentRequired, true);
    assert.match(searchRes.payment.referenceHash, /^0x[0-9a-fA-F]{64}$/);
    assert.ok(searchRes.data.results.length > 0);

    // 2. /data ($0.02)
    const dataRes = await handleData({ ticker: "BTC/USD" });
    assert.equal(dataRes.success, true);
    assert.equal(dataRes.service, "data");
    assert.equal(dataRes.payment.price, "0.02");
    assert.equal(dataRes.payment.priceUnits, DATA_PRICE_UNITS);
    assert.equal(dataRes.payment.provider, DATA_PROVIDER_ADDRESS);
    assert.equal(dataRes.data.ticker, "BTC/USD");
    assert.ok(dataRes.data.price > 0);

    // 3. /inference ($0.05)
    const inferenceRes = await handleInference({ prompt: "audit system reserves" });
    assert.equal(inferenceRes.success, true);
    assert.equal(inferenceRes.service, "inference");
    assert.equal(inferenceRes.payment.price, "0.05");
    assert.equal(inferenceRes.payment.priceUnits, INFERENCE_PRICE_UNITS);
    assert.equal(inferenceRes.payment.provider, INFERENCE_PROVIDER_ADDRESS);
    assert.ok(inferenceRes.data.completion.length > 0);
    assert.ok(inferenceRes.data.usage.totalTokens > 0);

    // 4. /weather ($0.005)
    const weatherRes = await handleWeather({ stationId: "SENSOR-WEST-01" });
    assert.equal(weatherRes.success, true);
    assert.equal(weatherRes.service, "weather");
    assert.equal(weatherRes.payment.price, "0.005");
    assert.equal(weatherRes.payment.priceUnits, WEATHER_PRICE_UNITS);
    assert.equal(weatherRes.payment.provider, WEATHER_PROVIDER_ADDRESS);
    assert.equal(weatherRes.data.stationId, "SENSOR-WEST-01");
    assert.ok(weatherRes.data.temperatureCelsius !== undefined);

    // 5. /compute ($0.10)
    const computeRes = await handleCompute({ jobType: "proof_generation" });
    assert.equal(computeRes.success, true);
    assert.equal(computeRes.service, "compute");
    assert.equal(computeRes.payment.price, "0.10");
    assert.equal(computeRes.payment.priceUnits, COMPUTE_PRICE_UNITS);
    assert.equal(computeRes.payment.provider, COMPUTE_PROVIDER_ADDRESS);
    assert.equal(computeRes.data.jobType, "proof_generation");
    assert.match(computeRes.data.outputDigest, /^0x[0-9a-fA-F]{64}$/);

    // Verify unified dispatcher handles all endpoints
    const dispatched = await dispatchServiceRequest("/data", { ticker: "ETH/USD" });
    assert.equal(dispatched.service, "data");
    assert.equal(dispatched.data.ticker, "ETH/USD");
  });

  test("MachinePaymentAdapter: consumes service responses and signs valid EIP-712 typed obligations", async () => {
    const adapter = new MachinePaymentAdapter();
    const serviceRes = await handleInference({ prompt: "generate state transition graph" });

    const signed = await adapter.createSignedObligation(
      TEST_PRIVATE_KEY,
      {
        service: serviceRes.payment.service,
        provider: serviceRes.payment.provider,
        priceUnits: serviceRes.payment.priceUnits,
        asset: serviceRes.payment.asset,
        referenceHash: serviceRes.payment.referenceHash,
      },
      {
        priority: ObligationPriority.HIGH,
      }
    );

    assert.equal(signed.serviceName, "inference");
    assert.equal(signed.obligation.payee, INFERENCE_PROVIDER_ADDRESS);
    assert.equal(signed.obligation.amount, INFERENCE_PRICE_UNITS);
    assert.equal(signed.obligation.priority, ObligationPriority.HIGH);
    assert.equal(signed.obligation.referenceHash, serviceRes.payment.referenceHash);
    assert.match(signed.obligation.id, /^0x[0-9a-fA-F]{64}$/);
    assert.match(signed.signature, /^0x[0-9a-fA-F]{130}$/);

    // Verify valid signature with viem
    const isValid = await adapter.verifySignedObligation(signed);
    assert.equal(isValid, true);

    // Tampered obligation amount must fail verification
    const tampered = {
      ...signed,
      obligation: {
        ...signed.obligation,
        amount: signed.obligation.amount + 1000000n,
      },
    };
    const isTamperedValid = await adapter.verifySignedObligation(tampered);
    assert.equal(isTamperedValid, false);
  });

  test("CreanceAgent: calls micro-services, accumulates obligations, requests NORN clearing, and settles", async () => {
    const agent = new CreanceAgent({
      privateKey: TEST_PRIVATE_KEY,
      initialCash: 100000000n, // $100.00 USDC
      creditCapacity: 50000000n, // $50.00 credit
    });

    const initialCash = agent.getState().cash;
    assert.equal(initialCash, 100000000n);

    // 1. Creance calls 5 machine micro-services
    const call1 = await agent.callService("/search", { query: "liquidity route" });
    const call2 = await agent.callService("/data", { ticker: "HOOD/USD" });
    const call3 = await agent.callService("/inference", { prompt: "netting plan" });
    const call4 = await agent.callService("/weather", { stationId: "S-1" });
    const call5 = await agent.callService("/compute", { jobType: "matrix_mul" });

    assert.equal(call1.response.service, "search");
    assert.equal(call2.response.service, "data");
    assert.equal(call3.response.service, "inference");
    assert.equal(call4.response.service, "weather");
    assert.equal(call5.response.service, "compute");

    const stateAfterCalls = agent.getState();
    assert.equal(stateAfterCalls.outgoingObligations.length, 5);

    const expectedOwed =
      SEARCH_PRICE_UNITS +
      DATA_PRICE_UNITS +
      INFERENCE_PRICE_UNITS +
      WEATHER_PRICE_UNITS +
      COMPUTE_PRICE_UNITS; // 10k + 20k + 50k + 5k + 100k = 185k ($0.185)

    // 2. Creance receives an incoming obligation from a counterparty for providing data
    const adapter = new MachinePaymentAdapter();
    const incomingSigned = await adapter.createSignedObligation(
      COUNTERPARTY_PRIVATE_KEY,
      {
        service: "market_maker_flow",
        provider: agent.address, // Creance is the payee
        priceUnits: 500000n, // $0.50 receivable
        asset: "0x1111111111111111111111111111111111111111",
        referenceHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
      }
    );

    const received = await agent.receiveObligation(incomingSigned);
    assert.equal(received, true);
    assert.equal(agent.getState().incomingObligations.length, 1);

    // 3. Request NORN clearing
    const clearing = agent.requestClearing();
    assert.equal(clearing.grossOwed, expectedOwed); // 185,000n
    assert.equal(clearing.grossReceivable, 500000n);
    assert.equal(clearing.netPosition, 500000n - expectedOwed); // +315,000n
    assert.equal(clearing.isNetCreditor, true);
    assert.equal(clearing.isNetDebtor, false);

    // 4. Settle net cleared position
    const settleResult = agent.settle(clearing);
    assert.equal(settleResult.previousCash, 100000000n);
    assert.equal(settleResult.newCash, 100000000n + 315000n);
    assert.equal(settleResult.settledCount, 6);

    const stateAfterSettlement = agent.getState();
    assert.equal(stateAfterSettlement.outgoingObligations.length, 0);
    assert.equal(stateAfterSettlement.incomingObligations.length, 0);
    assert.equal(stateAfterSettlement.settledObligationIds.size, 6);
  });
});
