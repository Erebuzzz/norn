/**
 * Creance treasury API
 */

import http from 'node:http';
import { getChainConfig } from '../src/config/arbitrum.js';
import { listPendleYieldSurfaces } from '../src/services/pendleYield.js';
import { getExecutorModel } from '../src/services/zeroDevExecutor.js';
import {
  getTreasuryState,
  getAuditLog,
} from '../src/services/treasuryState.js';
import {
  evaluateProposal,
  approvePendingIntent,
  syncMandateOnChain,
  resetTreasuryAndSyncChain,
  revokeExecutorDelegate,
  ensurePolicyGateway,
  getGatewayStatus,
} from '../src/services/agentService.js';

const PORT = Number(process.env.CREANCE_API_PORT || 8787);
const HOST = process.env.CREANCE_API_HOST || '127.0.0.1';

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

async function handle(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname.replace(/\/$/, '') || '/';
  const method = req.method || 'GET';

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  try {
    if (method === 'GET' && path === '/api/health') {
      return sendJson(res, 200, {
        ok: true,
        service: 'creance-api',
        ts: Date.now(),
        chain: getGatewayStatus(),
      });
    }

    if (method === 'GET' && path === '/api/treasury') {
      return sendJson(res, 200, getTreasuryState());
    }

    if (method === 'POST' && path === '/api/treasury/reset') {
      const result = await resetTreasuryAndSyncChain();
      return sendJson(res, 200, result.treasury);
    }

    if (method === 'PATCH' && path === '/api/treasury/mandate') {
      const body = await readBody(req);
      const result = await syncMandateOnChain(body);
      return sendJson(res, 200, result.treasury);
    }

    if (method === 'POST' && path === '/api/treasury/revoke-delegate') {
      const result = await revokeExecutorDelegate();
      return sendJson(res, 200, result);
    }

    if (method === 'GET' && path === '/api/market') {
      const snap = getTreasuryState();
      return sendJson(res, 200, {
        market: snap.market,
        riskBadges: snap.derived.riskBadges,
        riskDataBoundary:
          'Only fields listed in market.verifiedSources are verified. Everything else is labeled heuristic.',
      });
    }

    if (method === 'GET' && path === '/api/config/chain') {
      return sendJson(res, 200, { ...getChainConfig(), liveGateway: getGatewayStatus(), executor: getExecutorModel() });
    }

    if (method === 'GET' && path === '/api/yield/pendle') {
      const mode = url.searchParams.get('mode') === 'live_refs' ? 'live_refs' : 'mock';
      return sendJson(res, 200, listPendleYieldSurfaces({ mode }));
    }

    if (method === 'GET' && path === '/api/audit') {
      return sendJson(res, 200, { events: getAuditLog() });
    }

    if (method === 'POST' && path === '/api/agent/evaluate') {
      const body = await readBody(req);
      const result = await evaluateProposal(body);
      return sendJson(res, 200, result);
    }

    if (method === 'POST' && path === '/api/agent/approve') {
      const result = await approvePendingIntent();
      const status = result.error ? 409 : 200;
      return sendJson(res, status, result);
    }

    return sendJson(res, 404, { error: 'Not found', path });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(err);
    return sendJson(res, 400, { error: message });
  }
}

const server = http.createServer((req, res) => {
  handle(req, res);
});

ensurePolicyGateway()
  .then((g) => {
    console.log(`Creance policy gateway ready (${g.mode}) @ ${g.address}`);
    server.listen(PORT, HOST, () => {
      console.log(`Creance API listening on http://${HOST}:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to boot policy gateway', err);
    process.exit(1);
  });
