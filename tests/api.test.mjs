import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { startServer } from "../apps/api/dist/server.js";

const TEST_PORT = 4999;

test("NORN HTTP API Server Suite", async (t) => {
  const srv = await startServer(TEST_PORT);

  const fetchApi = async (path, options = {}) => {
    return new Promise((resolve, reject) => {
      const req = http.request(
        `http://localhost:${TEST_PORT}${path}`,
        {
          method: options.method || "GET",
          headers: { "Content-Type": "application/json" },
        },
        (res) => {
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => {
            try {
              resolve({ status: res.statusCode, data: JSON.parse(body) });
            } catch {
              resolve({ status: res.statusCode, raw: body });
            }
          });
        }
      );
      req.on("error", reject);
      if (options.body) req.write(JSON.stringify(options.body));
      req.end();
    });
  };

  await t.test("GET /network/state returns valid protocol info", async () => {
    const res = await fetchApi("/network/state");
    assert.equal(res.status, 200);
    assert.equal(res.data.protocol, "NORN Obligation Protocol");
    assert.equal(res.data.version, "2.0.0");
    assert.ok(res.data.epoch >= 1);
    assert.equal(res.data.regime, "NORMAL");
  });

  await t.test("GET /agents returns populated list of agents", async () => {
    const res = await fetchApi("/agents");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data));
    assert.ok(res.data.length > 0);
  });

  await t.test("GET /participants returns participants", async () => {
    const res = await fetchApi("/participants");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data));
  });

  await t.test("GET /obligations returns obligations", async () => {
    const res = await fetchApi("/obligations");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data));
  });

  await t.test("POST /clearing/run executes netting and commits roots", async () => {
    const res = await fetchApi("/clearing/run", { method: "POST" });
    assert.equal(res.status, 200);
    assert.ok(res.data.epochId >= 1);
    assert.ok(res.data.obligationRoot.startsWith("0x"));
    assert.ok(res.data.settlementRoot.startsWith("0x"));
    assert.ok(Array.isArray(res.data.transfers));
  });

  await t.test("POST /simulation/run executes baseline simulation", async () => {
    const res = await fetchApi("/simulation/run", { method: "POST" });
    assert.equal(res.status, 200);
    assert.ok(res.data.modeA);
    assert.ok(res.data.modeB);
    assert.ok(res.data.modeC);
  });

  await t.test("POST /arena/shock injects crisis and updates regime", async () => {
    const res = await fetchApi("/arena/shock", { method: "POST" });
    assert.equal(res.status, 200);
    assert.ok(res.data.breachingAgents);
    assert.ok(res.data.recoveredPlan);

    const state = await fetchApi("/network/state");
    assert.equal(state.data.regime, "CONSTRAINED");
  });

  await t.test("POST /arena/reset restores normal regime", async () => {
    const res = await fetchApi("/arena/reset", { method: "POST" });
    assert.equal(res.status, 200);
    assert.equal(res.data.regime, "NORMAL");

    const state = await fetchApi("/network/state");
    assert.equal(state.data.regime, "NORMAL");
  });

  await t.test("GET /audit/events returns chronological log", async () => {
    const res = await fetchApi("/audit/events");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data));
    assert.ok(res.data.length >= 3);
  });

  srv.close();
});
