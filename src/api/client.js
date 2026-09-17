/**
 * Browser API client. Uses Vite proxy (/api -> localhost:8787) in dev,
 * or absolute CREANCE_API_BASE if injected.
 */

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CREANCE_API_BASE) || '';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  health: () => request('/api/health'),
  getTreasury: () => request('/api/treasury'),
  resetTreasury: () => request('/api/treasury/reset', { method: 'POST', body: '{}' }),
  patchMandate: (patch) =>
    request('/api/treasury/mandate', { method: 'PATCH', body: JSON.stringify(patch) }),
  getMarket: () => request('/api/market'),
  getChainConfig: () => request('/api/config/chain'),
  getPendleYield: (mode = 'mock') => request(`/api/yield/pendle?mode=${encodeURIComponent(mode)}`),
  getAudit: () => request('/api/audit'),
  revokeDelegate: () => request('/api/treasury/revoke-delegate', { method: 'POST', body: '{}' }),
  evaluate: (body = {}) =>
    request('/api/agent/evaluate', { method: 'POST', body: JSON.stringify(body) }),
  approve: () => request('/api/agent/approve', { method: 'POST', body: '{}' }),
};
