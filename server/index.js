/**
 * Creance treasury API
 */

import http from 'node:http';
import { readApiRuntimeConfig, corsHeaders } from './runtimeConfig.js';
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

const runtime = readApiRuntimeConfig();
const { port: PORT, host: HOST, maxBodyBytes: MAX_BODY_BYTES, allowedOrigins: ALLOWED_ORIGINS } = runtime;

function sendJson(req, res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...corsHeaders(req.headers.origin, ALLOWED_ORIGINS),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error(`Request body exceeds ${MAX_BODY_BYTES} bytes.`));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
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
    const headers = corsHeaders(req.headers.origin, ALLOWED_ORIGINS);
    if (req.headers.origin && !headers['Access-Control-Allow-Origin']) {
      return sendJson(req, res, 403, { error: 'Origin not allowed' });
    }
    res.writeHead(204, headers);
    return res.end();
  }

  try {
    if (method === 'GET' && path === '/api/health') {
      return sendJson(req, res, 200, {
        ok: true,
        service: 'creance-api',
        ts: Date.now(),
        chain: getGatewayStatus(),
      });
    }

    if (method === 'GET' && path === '/api/treasury') {
      return sendJson(req, res, 200, getTreasuryState());
    }

    if (method === 'POST' && path === '/api/treasury/reset') {
      const result = await resetTreasuryAndSyncChain();
      return sendJson(req, res, 200, result.treasury);
    }

    if (method === 'PATCH' && path === '/api/treasury/mandate') {
      const body = await readBody(req);
      const result = await syncMandateOnChain(body);
      return sendJson(req, res, 200, result.treasury);
    }

    if (method === 'POST' && path === '/api/treasury/revoke-delegate') {
      const result = await revokeExecutorDelegate();
      return sendJson(req, res, 200, result);
    }

    if (method === 'GET' && path === '/api/market') {
      const snap = getTreasuryState();
      return sendJson(req, res, 200, {
        market: snap.market,
        riskBadges: snap.derived.riskBadges,
        riskDataBoundary:
          'Only fields listed in market.verifiedSources are verified. Everything else is labeled heuristic.',
      });
    }

    if (method === 'GET' && path === '/api/config/chain') {
      return sendJson(req, res, 200, { ...getChainConfig(), liveGateway: getGatewayStatus(), executor: getExecutorModel() });
    }

    if (method === 'GET' && path === '/api/yield/pendle') {
      const mode = url.searchParams.get('mode') === 'live_refs' ? 'live_refs' : 'mock';
      return sendJson(req, res, 200, listPendleYieldSurfaces({ mode }));
    }

    if (method === 'GET' && path === '/api/audit') {
      return sendJson(req, res, 200, { events: getAuditLog() });
    }

    if (method === 'POST' && path === '/api/agent/evaluate') {
      const body = await readBody(req);
      const result = await evaluateProposal(body);
      return sendJson(req, res, 200, result);
    }

    if (method === 'POST' && path === '/api/agent/approve') {
      const result = await approvePendingIntent();
      const status = result.error ? 409 : 200;
      return sendJson(req, res, status, result);
    }

    return sendJson(req, res, 404, { error: 'Not found', path });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(err);
    return sendJson(req, res, 400, { error: message });
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
