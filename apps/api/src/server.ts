import http from "node:http";
import { URL } from "node:url";
import {
  AgentGenerator,
  ObligationGenerator,
  BaselineSimulator,
  StressEngine,
  type Agent,
  type Obligation as SimObligation,
} from "@norn/simulation";
import {
  computeMultilateralNetting,
  computeObligationRoot,
  computeSettlementRoot,
  type Obligation as ClearingObligation,
} from "@norn/clearing";
import {
  RiskRegime,
} from "@norn/risk";
import { PROTOCOL_CONSTANTS } from "@norn/config";

// Custom JSON stringifier to safely serialize BigInt values
function jsonResponse(res: http.ServerResponse, statusCode: number, data: unknown) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  const serialized = JSON.stringify(data, (_, v) =>
    typeof v === "bigint" ? v.toString() : v
  );
  res.end(serialized);
}

// In-memory state for NORN API
const agentGen = new AgentGenerator();
const obGen = new ObligationGenerator();
const agents: Agent[] = agentGen.generateAgents(50);
const obligations: SimObligation[] = obGen.generateObligations(agents, 100);
let currentEpoch = 1;
let currentRegime = RiskRegime.NORMAL;
let auditEvents: Array<{ id: string; type: string; timestamp: string; details: unknown }> = [];

// Convert simulation obligation to clearing obligation
function toClearingObligations(simObs: SimObligation[]): ClearingObligation[] {
  const now = Math.floor(Date.now() / 1000);
  return simObs.map((o) => ({
    id: o.id,
    payer: o.payer,
    payee: o.payee,
    asset: o.asset,
    amount: o.amount,
    nonce: o.nonce,
    createdAt: now,
    expiresAt: o.expiresAt,
    priority: o.priority,
    reference: `ref-${o.id.slice(0, 10)}`,
    status: 1,
  }));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    res.end();
    return;
  }

  const reqUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = reqUrl.pathname;
  const method = req.method;

  try {
    // GET /network/state
    if (method === "GET" && pathname === "/network/state") {
      jsonResponse(res, 200, {
        protocol: PROTOCOL_CONSTANTS.PROTOCOL_NAME,
        version: PROTOCOL_CONSTANTS.VERSION,
        epoch: currentEpoch,
        regime: RiskRegime[currentRegime],
        activeParticipants: agents.length,
        pendingObligations: obligations.length,
      });
      return;
    }

    // GET /agents & GET /agents/:id
    if (method === "GET" && pathname === "/agents") {
      jsonResponse(res, 200, agents);
      return;
    }
    if (method === "GET" && pathname.startsWith("/agents/")) {
      const id = pathname.split("/")[2];
      const agent = agents.find(
        (a: Agent) => a.id.toLowerCase() === id.toLowerCase() || a.name.toLowerCase() === id.toLowerCase()
      );
      if (agent) jsonResponse(res, 200, agent);
      else jsonResponse(res, 404, { error: "Agent not found" });
      return;
    }

    // GET /participants
    if (method === "GET" && pathname === "/participants") {
      jsonResponse(
        res,
        200,
        agents.map((a: Agent) => ({ id: a.id, name: a.name, role: a.role }))
      );
      return;
    }

    // GET /obligations
    if (method === "GET" && pathname === "/obligations") {
      jsonResponse(res, 200, obligations);
      return;
    }

    // POST /clearing/run
    if (method === "POST" && pathname === "/clearing/run") {
      const clearingObs = toClearingObligations(obligations);
      const nettingResult = computeMultilateralNetting(clearingObs);
      const obligationRoot = computeObligationRoot(clearingObs);
      const settlementRoot = computeSettlementRoot(nettingResult.settlementTransfers);

      auditEvents.unshift({
        id: `evt-${Date.now()}`,
        type: "ClearingExecuted",
        timestamp: new Date().toISOString(),
        details: { epoch: currentEpoch, transfers: nettingResult.settlementTransfers.length },
      });

      jsonResponse(res, 200, {
        epochId: currentEpoch,
        transfers: nettingResult.settlementTransfers,
        obligationRoot,
        settlementRoot,
        grossVolume: nettingResult.grossVolume,
        netVolume: nettingResult.netVolume,
        efficiency: nettingResult.efficiency,
        clearedCount: nettingResult.clearedCount,
        transferCount: nettingResult.transferCount,
      });
      currentEpoch++;
      return;
    }

    // POST /simulation/run
    if (method === "POST" && pathname === "/simulation/run") {
      const simAgents = agentGen.generateAgents(100);
      const simObligations = obGen.generateObligations(simAgents, 500);
      const simulator = new BaselineSimulator({ agents: simAgents });
      const result = simulator.simulateAll(simObligations);
      jsonResponse(res, 200, result);
      return;
    }

    // POST /arena/shock
    if (method === "POST" && pathname === "/arena/shock") {
      const stressEngine = new StressEngine({ shockPercentage: 40, constrainedReserveRatioBps: 2500 });
      const shockResult = stressEngine.runLiquidityShockScenario(agents, obligations);
      currentRegime = RiskRegime.CONSTRAINED;
      auditEvents.unshift({
        id: `evt-${Date.now()}`,
        type: "LiquidityShockInjected",
        timestamp: new Date().toISOString(),
        details: { shockPercent: "-40%", breachingAgents: shockResult.breachingAgents.length },
      });
      jsonResponse(res, 200, shockResult);
      return;
    }

    // POST /arena/reset
    if (method === "POST" && pathname === "/arena/reset") {
      currentRegime = RiskRegime.NORMAL;
      auditEvents.unshift({
        id: `evt-${Date.now()}`,
        type: "NetworkReset",
        timestamp: new Date().toISOString(),
        details: { regime: "NORMAL" },
      });
      jsonResponse(res, 200, { status: "reset_complete", regime: "NORMAL" });
      return;
    }

    // GET /risk
    if (method === "GET" && pathname === "/risk") {
      jsonResponse(res, 200, {
        currentRegime: RiskRegime[currentRegime],
        regimeValue: currentRegime,
        thresholds: PROTOCOL_CONSTANTS.RESERVE_THRESHOLDS,
      });
      return;
    }

    // GET /audit/events
    if (method === "GET" && pathname === "/audit/events") {
      jsonResponse(res, 200, auditEvents.slice(0, 50));
      return;
    }

    // Default 404
    jsonResponse(res, 404, { error: "Route not found" });
  } catch (err: any) {
    jsonResponse(res, 500, { error: err?.message || "Internal server error" });
  }
});

export function startServer(port = 4000): Promise<http.Server> {
  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve(server);
    });
  });
}

if (process.argv[1] && (process.argv[1].endsWith("server.js") || process.argv[1].endsWith("server.ts"))) {
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4000;
  server.listen(PORT, () => {
    console.log(`NORN Telemetry and Clearing API listening on port ${PORT}`);
  });
}

export { server };

