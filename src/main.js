import { runAgenticLoop } from './agenticLoop.js';

const themeToggle = document.querySelector('#themeToggle');
const themeLabel = document.querySelector('#themeLabel');
const savedTheme = localStorage.getItem('creance-theme');
if (savedTheme === 'light' || savedTheme === 'dark') document.documentElement.dataset.theme = savedTheme;

function syncThemeLabel() {
  const isDark = document.documentElement.dataset.theme === 'dark';
  themeToggle.setAttribute('aria-pressed', String(isDark));
  themeLabel.textContent = isDark ? 'AMOLED' : 'LIGHT';
  themeToggle.title = isDark ? 'Switch to light mode' : 'Switch to AMOLED dark mode';
}

themeToggle.addEventListener('click', () => {
  const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem('creance-theme', nextTheme);
  syncThemeLabel();
});
syncThemeLabel();

const limitInput = document.querySelector('#equityLimit');
const limitOutput = document.querySelector('#limitOutput');
const ceilingLabel = document.querySelector('#ceilingLabel');
const proposalBadge = document.querySelector('#proposalBadge');
const reasonBox = document.querySelector('#reasonBox');
const reasonMark = document.querySelector('.reason-mark');
const reasonTitle = document.querySelector('#reasonTitle');
const reasonText = document.querySelector('#reasonText');
const approveButton = document.querySelector('#approveButton');
const evaluateButton = document.querySelector('#evaluateButton');
const auditList = document.querySelector('#auditList');
const auditStatus = document.querySelector('#auditStatus');
let intentExecuted = false;

const portfolio = {
  totalValue: 1_000_000,
  holdings: { USDC: 700_000, AAPL: 300_000 },
  spentToday: 0,
};

const market = {
  volatility30d: { AAPL: 0.28 },
  depegRisk: { USDC: 0.01 },
  liquidityDepthUsd: { AAPL: 5_000_000 },
  verifiedSources: ['AAPL_PRICE:chainlink'],
};

const proposalOverride = {
  from: 'USDC',
  to: 'AAPL',
  amountUsd: 150_000,
  reason: 'Reduce idle USDC exposure',
};

const eventStyles = {
  ProposalCreated: ['Proposal created', 'neutral'],
  RiskVerified: ['Risk verified', 'neutral'],
  PolicyChecked: ['Policy checked', 'neutral'],
  ApprovalRequested: ['Approval requested', 'neutral'],
  ApprovalGranted: ['Approval granted', 'pass'],
  ApprovalRejected: ['Approval rejected', 'fail'],
  TradeExecuted: ['Trade executed', 'pass'],
  EmergencyFreeze: ['Emergency freeze', 'fail'],
};

function formatTime(timestamp) {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(timestamp);
}

function mandateForCurrentLimit() {
  return {
    assetCeilings: {},
    issuerCeilings: {},
    chainCeilings: {},
    equityCeiling: Number(limitInput.value) / 100,
    equityTickers: ['AAPL', 'MSFT', 'NVDA', 'AMZN'],
    riskFloor: 40,
    liquidityFloor: 200_000,
    dailySpendCap: 500_000,
    approvalThresholds: { auto: 10_000, review: 100_000 },
    depegCriticalThreshold: 0.5,
  };
}

function renderAudit(log) {
  auditList.replaceChildren();
  for (const entry of log.events) {
    const item = document.createElement('li');
    const [label, status] = eventStyles[entry.event] ?? [entry.event, 'neutral'];
    const code = entry.code || 'LOG';
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
    const codeNode = document.createElement('code');
    codeNode.textContent = code;
    item.append(time, dot, copy, codeNode);
    auditList.append(item);
  }
}

function updateDecisionCopy(result) {
  const lastPolicy = [...result.log.events].reverse().find((event) => event.event === 'PolicyChecked');
  const lastRejection = [...result.log.events].reverse().find((event) => event.event === 'ApprovalRejected' || event.event === 'EmergencyFreeze');
  const awaiting = result.outcome === 'AWAITING_HUMAN';
  const permitted = result.outcome === 'EXECUTED' || awaiting;
  const failed = result.outcome === 'REJECTED' || result.outcome === 'FROZEN';
  intentExecuted = result.outcome === 'EXECUTED';

  proposalBadge.className = `badge ${permitted ? 'permitted' : 'blocked'}`;
  proposalBadge.textContent = awaiting ? 'Awaiting approval' : permitted ? 'Executed' : 'Blocked';
  reasonBox.className = `reason-box ${permitted ? 'success' : ''}`;
  reasonMark.textContent = permitted ? '✓' : '!';
  reasonTitle.textContent = awaiting ? 'Human approval required' : result.outcome === 'EXECUTED' ? 'Intent executed' : result.outcome === 'FROZEN' ? 'Emergency freeze active' : 'Mandate breach detected';
  reasonText.textContent = awaiting
    ? 'The policy gate is clear, but this $150,000 intent crosses the review threshold. Approve it to release the executor.'
    : result.outcome === 'EXECUTED'
      ? 'The policy gate and approval step passed. The execution controller received the compliant intent.'
      : lastRejection?.detail ?? lastPolicy?.detail ?? 'The intent did not pass the policy gate.';
  approveButton.disabled = !awaiting;
  approveButton.textContent = awaiting ? 'Approve intent' : result.outcome === 'EXECUTED' ? 'Intent approved' : 'Approve intent';
  evaluateButton.textContent = failed ? 'Re-evaluate intent' : awaiting ? 'Policy checked' : 'Intent executed';
  evaluateButton.disabled = intentExecuted;
  limitInput.disabled = intentExecuted;
  auditStatus.textContent = awaiting ? 'Intent 024 is ready for approval.' : result.outcome === 'EXECUTED' ? 'Intent 024 approved and queued for execution.' : result.outcome === 'FROZEN' ? 'Intent 024 is frozen by the emergency override.' : 'Intent 024 is pending correction.';
}

async function evaluateIntent(humanApprovalFn) {
  if (intentExecuted) return null;
  evaluateButton.disabled = true;
  approveButton.disabled = true;
  const result = await runAgenticLoop({
    portfolio,
    market,
    mandate: mandateForCurrentLimit(),
    proposalOverride,
    maxRetries: 0,
    humanApprovalFn,
  });
  renderAudit(result.log);
  updateDecisionCopy(result);
  evaluateButton.disabled = intentExecuted;
  return result;
}

limitInput.addEventListener('input', () => {
  limitOutput.textContent = `${limitInput.value}%`;
  ceilingLabel.textContent = `${limitInput.value}.0%`;
  proposalBadge.className = 'badge blocked';
  proposalBadge.textContent = 'Needs review';
  reasonBox.className = 'reason-box';
  reasonMark.textContent = '!';
  reasonTitle.textContent = 'Mandate changed';
  reasonText.textContent = `Re-evaluate Intent 024 against the new ${limitInput.value}% Stock Token ceiling.`;
  approveButton.disabled = true;
  evaluateButton.textContent = 'Re-evaluate intent';
  auditStatus.textContent = 'Mandate changed. Intent 024 needs a fresh policy check.';
});

evaluateButton.addEventListener('click', () => evaluateIntent());
approveButton.addEventListener('click', () => evaluateIntent(async () => true));

limitOutput.textContent = `${limitInput.value}%`;
ceilingLabel.textContent = `${limitInput.value}.0%`;
evaluateIntent();
