import { api } from './api/client.js';

const themeToggle = document.querySelector('#themeToggle');
const themeLabel = document.querySelector('#themeLabel');
const themeParam = new URLSearchParams(location.search).get('theme');
const savedTheme = localStorage.getItem('creance-theme');
if (themeParam === 'light' || themeParam === 'dark') {
  document.documentElement.dataset.theme = themeParam;
  localStorage.setItem('creance-theme', themeParam);
} else if (savedTheme === 'light' || savedTheme === 'dark') {
  document.documentElement.dataset.theme = savedTheme;
} else {
  document.documentElement.dataset.theme = 'light';
}

function syncThemeLabel() {
  const isDark = document.documentElement.dataset.theme === 'dark';
  if (themeToggle) themeToggle.setAttribute('aria-pressed', String(isDark));
  if (themeLabel) themeLabel.textContent = isDark ? 'Light' : 'Dark';
  if (themeToggle) {
    themeToggle.title = isDark ? 'Switch to daylight vault' : 'Switch to dark ops';
  }
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('creance-theme', next);
    syncThemeLabel();
  });
}
syncThemeLabel();

const limitInput = document.querySelector('#equityLimit');
const limitOutput = document.querySelector('#limitOutput');
const ceilingLabel = document.querySelector('#ceilingLabel');
const heroCeiling = document.querySelector('#heroCeiling');
const proposalBadge = document.querySelector('#proposalBadge');
const reasonBox = document.querySelector('#reasonBox');
const reasonMark = document.querySelector('.verdict-mark');
const reasonTitle = document.querySelector('#reasonTitle');
const reasonText = document.querySelector('#reasonText');
const reasonTx = document.querySelector('#reasonTx');
const policyCodeLabel = document.querySelector('#policyCodeLabel');
const approveButton = document.querySelector('#approveButton');
const evaluateButton = document.querySelector('#evaluateButton');
const pendleButton = document.querySelector('#pendleButton');
const pendleBadge = document.querySelector('#pendleBadge');
const pendleResult = document.querySelector('#pendleResult');
const pendleVerdict = document.querySelector('#pendleVerdict');
const pendleTx = document.querySelector('#pendleTx');
const revokeButton = document.querySelector('#revokeButton');
const revokeHint = document.querySelector('#revokeHint');
const auditList = document.querySelector('#auditList');
const auditStatus = document.querySelector('#auditStatus');
const networkLabel = document.querySelector('#networkLabel');
const statusDot = document.querySelector('#statusDot');
const managedBalance = document.querySelector('#managedBalance');
const usdgBalance = document.querySelector('#usdgBalance');
const equityExposure = document.querySelector('#equityExposure');
const equityMeter = document.querySelector('#equityMeter');
const mandateHealth = document.querySelector('#mandateHealth');
const healthNote = document.querySelector('#healthNote');
const assetCountNote = document.querySelector('#assetCountNote');
const yieldCeilingLabel = document.querySelector('#yieldCeilingLabel');
const liqFloorLabel = document.querySelector('#liqFloorLabel');
const intentFrom = document.querySelector('#intentFrom');
const intentTo = document.querySelector('#intentTo');
const intentNotional = document.querySelector('#intentNotional');

let intentExecuted = false;
let apiOnline = false;
/** @type {Awaited<ReturnType<typeof api.getTreasury>> | null} */
let treasury = null;

const eventStyles = {
  ProposalCreated: ['Proposal created', 'neutral'],
  RiskVerified: ['Risk verified', 'neutral'],
  PolicyChecked: ['Policy checked', 'neutral'],
  ApprovalRequested: ['Approval requested', 'neutral'],
  ApprovalGranted: ['Approval granted', 'pass'],
  ApprovalRejected: ['Approval rejected', 'fail'],
  TradeExecuted: ['Trade executed', 'pass'],
  EmergencyFreeze: ['Emergency freeze', 'fail'],
  MandateUpdated: ['Mandate updated', 'pass'],
  DelegateRevoked: ['Delegate revoked', 'fail'],
};

function formatTime(timestamp) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(timestamp);
}

function formatUsd(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function pct(weight) {
  return `${(weight * 100).toFixed(1)}%`;
}

function shortHash(code) {
  if (!code || code === 'LOG' || code === 'CLEAR') return code || '—';
  if (code.startsWith('0x') && code.length > 14) {
    return `${code.slice(0, 8)}…${code.slice(-4)}`;
  }
  return code;
}

function extractProof(events) {
  if (!events?.length) return null;
  const withHash = [...events]
    .reverse()
    .find(
      (e) =>
        (typeof e.txHash === 'string' && e.txHash.startsWith('0x')) ||
        (typeof e.code === 'string' && e.code.startsWith('0x') && e.code.length > 20),
    );
  const rejection = [...events]
    .reverse()
    .find((e) => e.event === 'ApprovalRejected' || (e.event === 'PolicyChecked' && e.code && e.code !== 'CLEAR'));
  const hash = withHash?.txHash || (withHash?.code?.startsWith('0x') ? withHash.code : null);
  return {
    hash,
    explorerUrl: withHash?.explorerUrl || null,
    policyCode: rejection?.code ?? null,
    detail: rejection?.detail ?? withHash?.detail ?? null,
  };
}

function setNetworkLabel(ok, detail) {
  apiOnline = ok;
  if (networkLabel) networkLabel.textContent = detail;
  if (statusDot) statusDot.classList.toggle('offline', !ok);
}

function renderTreasuryMetrics(snap) {
  treasury = snap;
  const holdings = snap.portfolio?.holdings ?? {};
  if (managedBalance) managedBalance.textContent = formatUsd(snap.portfolio.totalValue);
  if (usdgBalance) usdgBalance.textContent = formatUsd(holdings.USDG ?? 0);
  if (equityExposure) equityExposure.textContent = pct(snap.derived.equityWeight);
  if (equityMeter) {
    const ceiling = snap.mandate.equityCeiling || 0.3;
    equityMeter.style.width = `${Math.min((snap.derived.equityWeight / ceiling) * 100, 100)}%`;
  }
  const ceilingPct = Math.round(snap.mandate.equityCeiling * 100);
  limitInput.value = String(ceilingPct);
  limitOutput.textContent = `${ceilingPct}%`;
  ceilingLabel.textContent = `${ceilingPct}.0%`;
  if (heroCeiling) heroCeiling.textContent = `${ceilingPct}%`;
  if (mandateHealth) {
    mandateHealth.textContent = snap.derived.mandateHealth;
    mandateHealth.classList.toggle('health', snap.derived.mandateHealth === 'Sound');
  }
  if (healthNote) {
    healthNote.textContent =
      snap.derived.mandateHealth === 'Sound' ? 'no active policy breaches' : 'mandate override active';
  }
  if (assetCountNote) {
    assetCountNote.textContent = `across ${snap.derived.assetCount} permitted assets`;
  }
  if (yieldCeilingLabel) {
    yieldCeilingLabel.textContent = pct(snap.mandate.yieldCeiling ?? 0.15);
  }
  if (liqFloorLabel) liqFloorLabel.textContent = formatUsd(snap.mandate.liquidityFloor);

  const proposal = snap.activeProposal;
  if (proposal) {
    if (intentFrom) intentFrom.textContent = proposal.from;
    if (intentTo) {
      intentTo.textContent =
        proposal.to === 'AAPL'
          ? 'AAPL Stock Token'
          : proposal.to === 'PENDLE_PT' || proposal.to === 'PENDLE_PT_USDC'
            ? 'Pendle PT-USDC'
            : proposal.to;
    }
    if (intentNotional) intentNotional.textContent = formatUsd(proposal.amountUsd);
  }
}

function renderAudit(events) {
  auditList.replaceChildren();
  for (const entry of events) {
    const item = document.createElement('li');
    const [label, status] = eventStyles[entry.event] ?? [entry.event, 'neutral'];
    const time = document.createElement('time');
    time.textContent = formatTime(entry.timestamp);
    const dot = document.createElement('span');
    dot.className = `event-dot ${status}`;
    dot.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = label;
    const detail = document.createElement('p');
    detail.textContent = entry.detail;
    copy.append(title, detail);
    const proof = entry.txHash || entry.code || 'LOG';
    if (entry.explorerUrl && entry.txHash) {
      const link = document.createElement('a');
      link.href = entry.explorerUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = shortHash(entry.txHash);
      link.title = entry.txHash;
      link.className = 'tx-link';
      item.append(time, dot, copy, link);
    } else {
      const codeNode = document.createElement('code');
      codeNode.textContent = shortHash(proof);
      codeNode.title = proof;
      item.append(time, dot, copy, codeNode);
    }
    auditList.append(item);
  }
}

function setReasonProof(events, fallbackCode) {
  const proof = extractProof(events);
  const code =
    proof?.policyCode ||
    (fallbackCode && !String(fallbackCode).startsWith('0x') ? fallbackCode : null);
  if (policyCodeLabel) {
    policyCodeLabel.textContent = code || 'CLEAR';
  }
  if (reasonTx) {
    const hash =
      proof?.hash ||
      (fallbackCode && String(fallbackCode).startsWith('0x') ? fallbackCode : null);
    // Proof row prefers real chain hash; policy codes stay on #policyCodeLabel.
    reasonTx.textContent = hash ? shortHash(hash) : '—';
    reasonTx.title = hash || 'No chain proof attached';
  }
}

function updateDecisionCopy(result) {
  const events = result.log?.events ?? [];
  const lastPolicy = [...events].reverse().find((event) => event.event === 'PolicyChecked');
  const lastRejection = [...events]
    .reverse()
    .find((event) => event.event === 'ApprovalRejected' || event.event === 'EmergencyFreeze');
  const executed = [...events].reverse().find((event) => event.event === 'TradeExecuted');
  const awaiting = result.outcome === 'AWAITING_HUMAN';
  const permitted = result.outcome === 'EXECUTED' || awaiting;
  const failed = result.outcome === 'REJECTED' || result.outcome === 'FROZEN';
  intentExecuted = result.outcome === 'EXECUTED';

  proposalBadge.className = `badge ${awaiting ? 'review' : permitted ? 'permitted' : 'blocked'}`;
  proposalBadge.textContent = awaiting ? 'Awaiting approval' : permitted ? 'Executed' : 'Blocked';

  reasonBox.className = `verdict-shell ${awaiting ? 'review' : permitted ? 'success' : ''}`;
  if (reasonMark) reasonMark.textContent = permitted || awaiting ? (awaiting ? '·' : '✓') : '!';
  reasonTitle.textContent = awaiting
    ? 'Human approval required'
    : result.outcome === 'EXECUTED'
      ? 'Intent executed'
      : result.outcome === 'FROZEN'
        ? 'Emergency freeze active'
        : 'Mandate breach detected';
  reasonText.textContent = awaiting
    ? 'The policy gate is clear, but this $150,000 intent crosses the review threshold. Approve it to release the executor.'
    : result.outcome === 'EXECUTED'
      ? 'The policy gate and approval step passed. The execution controller received the compliant intent.'
      : (lastRejection?.detail ?? lastPolicy?.detail ?? 'The intent did not pass the policy gate.');

  setReasonProof(events, executed?.txHash ?? executed?.code ?? lastRejection?.code ?? lastPolicy?.code);
  if (policyCodeLabel && awaiting) policyCodeLabel.textContent = 'AWAITING_HUMAN';
  if (policyCodeLabel && result.outcome === 'EXECUTED') policyCodeLabel.textContent = 'CLEAR';

  approveButton.disabled = !awaiting;
  approveButton.textContent = awaiting
    ? 'Approve intent'
    : result.outcome === 'EXECUTED'
      ? 'Intent approved'
      : 'Approve intent';
  evaluateButton.textContent = failed ? 'Re-evaluate intent' : awaiting ? 'Policy checked' : 'Intent executed';
  evaluateButton.disabled = intentExecuted || !apiOnline;
  limitInput.disabled = intentExecuted;
  if (pendleButton) pendleButton.disabled = !apiOnline;
  if (revokeButton) revokeButton.disabled = !apiOnline || intentExecuted;

  auditStatus.textContent = awaiting
    ? 'Intent 024 is ready for approval.'
    : result.outcome === 'EXECUTED'
      ? 'Intent 024 approved and queued for execution.'
      : result.outcome === 'FROZEN'
        ? 'Intent 024 is frozen by the emergency override.'
        : 'Intent 024 rejected. Raise the ceiling or revise the intent.';
}

async function evaluateIntent({ approve = false, proposal } = {}) {
  if (intentExecuted || !apiOnline) return null;
  evaluateButton.disabled = true;
  approveButton.disabled = true;

  try {
    const result = approve
      ? await api.approve()
      : await api.evaluate({ maxRetries: 0, ...(proposal ? { proposal } : {}) });
    if (result.treasury) renderTreasuryMetrics(result.treasury);
    renderAudit(result.log?.events ?? []);
    updateDecisionCopy(result);
    evaluateButton.disabled = intentExecuted;
    return result;
  } catch (err) {
    setNetworkLabel(false, 'Policy engine offline');
    reasonTitle.textContent = 'Policy engine unreachable';
    reasonText.textContent =
      err instanceof Error
        ? err.message
        : 'Could not reach the Creance policy engine. Reconnect and try again.';
    if (reasonTx) reasonTx.textContent = '—';
    evaluateButton.disabled = false;
    return null;
  }
}

async function evaluatePendleBeat() {
  if (!apiOnline) return;
  pendleButton.disabled = true;
  if (pendleVerdict) pendleVerdict.hidden = false;
  if (pendleBadge) {
    pendleBadge.className = 'badge review';
    pendleBadge.textContent = 'Checking';
  }
  pendleResult.className = 'pendle-result';
  pendleResult.textContent = 'Evaluating oversized Pendle allocate against yield ceiling…';

  try {
    const result = await api.evaluate({
      maxRetries: 0,
      proposal: {
        from: 'USDG',
        to: 'PENDLE_PT_USDC',
        amountUsd: 200_000,
        reason: 'Allocate idle USDG into Pendle PT fixed-yield sleeve',
      },
    });
    if (result.treasury) renderTreasuryMetrics(result.treasury);
    renderAudit(result.log?.events ?? []);

    const events = result.log?.events ?? [];
    const rejection = [...events]
      .reverse()
      .find((e) => e.event === 'ApprovalRejected' || e.code === 'YIELD_005' || e.code === 'CAP_001');
    const proof = extractProof(events);
    const yieldCode = proof?.policyCode || rejection?.code || 'YIELD_005';

    if (pendleTx) {
      const hash = proof?.hash || null;
      pendleTx.textContent = hash ? shortHash(hash) : '—';
      pendleTx.title = hash || 'No chain proof attached';
    }

    if (result.outcome === 'REJECTED') {
      if (pendleBadge) {
        pendleBadge.className = 'badge blocked';
        pendleBadge.textContent = yieldCode;
      }
      pendleResult.className = 'pendle-result fail';
      pendleResult.textContent =
        rejection?.detail ?? 'Yield venue exposure would exceed the mandate ceiling.';
      auditStatus.textContent = 'Pendle stage: allocate rejected under mandate (continuous enforcement).';
    } else {
      if (pendleBadge) {
        pendleBadge.className = 'badge permitted';
        pendleBadge.textContent = result.outcome;
      }
      pendleResult.className = 'pendle-result pass';
      pendleResult.textContent = `Outcome ${result.outcome}. Same mandate gate cleared this yield intent.`;
      auditStatus.textContent = `Pendle stage: ${result.outcome}.`;
    }

    document.querySelector('.stage-pendle')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    if (pendleVerdict) pendleVerdict.hidden = false;
    pendleResult.className = 'pendle-result fail';
    pendleResult.textContent = err instanceof Error ? err.message : 'Pendle evaluate failed.';
  } finally {
    pendleButton.disabled = !apiOnline;
  }
}

async function syncMandateFromSlider() {
  if (!apiOnline || intentExecuted) return;
  const equityCeiling = Number(limitInput.value) / 100;
  const snap = await api.patchMandate({ equityCeiling });
  renderTreasuryMetrics(snap);
  if (snap.audit) renderAudit(snap.audit);
  proposalBadge.className = 'badge review';
  proposalBadge.textContent = 'Needs review';
  reasonBox.className = 'verdict-shell review';
  if (reasonMark) reasonMark.textContent = '·';
  reasonTitle.textContent = 'Mandate updated';
  reasonText.textContent = `Owner raised Stock Token ceiling to ${limitInput.value}%. Re-evaluate Intent 024 against the new limit.`;
  const mandateEvent = [...(snap.audit || [])].reverse().find((e) => e.event === 'MandateUpdated');
  if (policyCodeLabel) policyCodeLabel.textContent = 'MANDATE';
  if (reasonTx) {
    const hash = mandateEvent?.txHash?.startsWith?.('0x') ? mandateEvent.txHash : null;
    reasonTx.textContent = hash ? shortHash(hash) : '—';
    reasonTx.title = hash || 'No chain proof attached';
  }
  approveButton.disabled = true;
  evaluateButton.textContent = 'Re-evaluate intent';
  evaluateButton.disabled = false;
  auditStatus.textContent = 'Mandate changed. Intent 024 needs a fresh policy check.';
}

async function revokeDelegate() {
  if (!apiOnline || !revokeButton) return;
  revokeButton.disabled = true;
  try {
    const result = await api.revokeDelegate();
    if (result.treasury) {
      renderTreasuryMetrics(result.treasury);
      renderAudit(result.treasury.audit || []);
    }
    reasonBox.className = 'verdict-shell';
    if (reasonMark) reasonMark.textContent = '!';
    proposalBadge.className = 'badge blocked';
    proposalBadge.textContent = 'Authority revoked';
    reasonTitle.textContent = 'Delegate revoked';
    reasonText.textContent =
      'Owner revoked the REBALANCE delegate. Further evaluate calls fail closed until a new scoped executor is granted.';
    if (policyCodeLabel) policyCodeLabel.textContent = 'ROLE_REVOKED';
    if (reasonTx) {
      const hash = result.chainTx?.txHash?.startsWith?.('0x') ? result.chainTx.txHash : null;
      reasonTx.textContent = hash ? shortHash(hash) : '—';
      reasonTx.title = hash || 'No chain proof attached';
    }
    if (revokeHint) revokeHint.textContent = 'Delegate inactive. Reset treasury cell to restore demo executor.';
    auditStatus.textContent = 'Authority revoked on-chain. Policy is the product.';
  } catch (err) {
    if (revokeHint) {
      revokeHint.textContent = err instanceof Error ? err.message : 'Revoke failed.';
    }
  } finally {
    revokeButton.disabled = !apiOnline;
  }
}

limitInput.addEventListener('input', () => {
  limitOutput.textContent = `${limitInput.value}%`;
  ceilingLabel.textContent = `${limitInput.value}.0%`;
  if (heroCeiling) heroCeiling.textContent = `${limitInput.value}%`;
});

limitInput.addEventListener('change', () => {
  syncMandateFromSlider().catch((err) => {
    reasonText.textContent = err instanceof Error ? err.message : 'Mandate update failed.';
  });
});

evaluateButton.addEventListener('click', () =>
  evaluateIntent({
    proposal: { from: 'USDG', to: 'AAPL', amountUsd: 150_000, reason: 'Increase AAPL Stock Token exposure' },
  }),
);
approveButton.addEventListener('click', () => evaluateIntent({ approve: true }));
if (pendleButton) pendleButton.addEventListener('click', () => evaluatePendleBeat());
if (revokeButton) revokeButton.addEventListener('click', () => revokeDelegate());

async function boot() {
  try {
    const health = await api.health();
    const chain = health?.chain;
    const label =
      chain?.ready && chain?.address
        ? `Policy live · ${chain.mode === 'local_ganache' ? 'local' : 'remote'} · ${shortHash(chain.address)}`
        : 'Policy engine connected';
    setNetworkLabel(true, label);
    const snap = await api.getTreasury();
    renderTreasuryMetrics(snap);
    await evaluateIntent({
      proposal: { from: 'USDG', to: 'AAPL', amountUsd: 150_000, reason: 'Increase AAPL Stock Token exposure' },
    });
  } catch {
    setNetworkLabel(false, 'Policy engine offline');
    reasonTitle.textContent = 'Waiting for policy engine';
    reasonText.textContent =
      'Creance cannot evaluate intents until the policy engine is reachable. Holdings and mandate controls remain visible.';
    if (reasonTx) reasonTx.textContent = '—';
    evaluateButton.disabled = true;
    approveButton.disabled = true;
    if (pendleButton) pendleButton.disabled = true;
    if (revokeButton) revokeButton.disabled = true;
  }
}

limitOutput.textContent = `${limitInput.value}%`;
ceilingLabel.textContent = `${limitInput.value}.0%`;
if (heroCeiling) heroCeiling.textContent = `${limitInput.value}%`;

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function syncScrollDepth() {
  if (reduceMotion.matches) {
    document.documentElement.style.setProperty('--scroll-depth', '0');
    return;
  }
  const max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
  const depth = Math.min(Math.max(window.scrollY / max, 0), 1);
  document.documentElement.style.setProperty('--scroll-depth', depth.toFixed(4));
}

window.addEventListener('scroll', syncScrollDepth, { passive: true });
reduceMotion.addEventListener('change', syncScrollDepth);
syncScrollDepth();

boot();
