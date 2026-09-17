/**
 * In-process policy gateway: Ganache + CreancePolicy.
 * Produces real tx hashes for reject / approve / execute / mandate / revoke.
 *
 * Remote (Arb Sepolia / Robinhood): set
 *   CREANCE_RPC_URL, CREANCE_PRIVATE_KEY, CREANCE_POLICY_ADDRESS
 * Optional: CREANCE_EXPLORER_BASE (e.g. https://sepolia.arbiscan.io)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  BrowserProvider,
  Contract,
  ContractFactory,
  JsonRpcProvider,
  Wallet,
  id,
  getBytes,
  hexlify,
  zeroPadValue,
} from 'ethers';

const require = createRequire(import.meta.url);
const ganache = require('ganache');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const artifactPath = path.join(__dirname, '../../artifacts/CreancePolicy.json');

/** Demo asset registry (placeholders until RH Stock Token / USDG venue addresses are fixed). */
export const ASSET_ADDR = {
  USDG: '0x0000000000000000000000000000000000005551',
  USDC: '0x0000000000000000000000000000000000005552',
  AAPL: '0x000000000000000000000000000000000000a001',
  MSFT: '0x000000000000000000000000000000000000a002',
  NVDA: '0x000000000000000000000000000000000000a003',
  AMZN: '0x000000000000000000000000000000000000a004',
  ETH: '0x00000000000000000000000000000000000000ee',
  PENDLE_PT_USDC: '0x000000000000000000000000000000000000b001',
};

let bootPromise = null;
let gateway = null;

function loadArtifact() {
  if (!fs.existsSync(artifactPath)) {
    throw new Error('Missing artifacts/CreancePolicy.json — run: npm run compile');
  }
  return JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
}

export function intentIdBytes(intent) {
  const raw = intent.id || `intent-${intent.from}-${intent.to}-${intent.amountUsd}-${Date.now()}`;
  return zeroPadValue(hexlify(getBytes(id(String(raw))).slice(0, 32)), 32);
}

function codeToString(codeBytes32) {
  const hex = typeof codeBytes32 === 'string' ? codeBytes32 : hexlify(codeBytes32);
  try {
    const buf = Buffer.from(hex.slice(2), 'hex');
    return buf.toString('utf8').replace(/\0/g, '') || hex;
  } catch {
    return hex;
  }
}

export function buildOnchainIntent(intent, risk, portfolio, mandate) {
  const fromAsset = ASSET_ADDR[intent.from] || ASSET_ADDR.USDG;
  const toAsset = ASSET_ADDR[intent.to] || ASSET_ADDR.AAPL;
  const equityTickers = mandate.equityTickers ?? ['AAPL', 'MSFT', 'NVDA', 'AMZN'];
  const yieldTickers = mandate.yieldTickers ?? ['PENDLE_PT_USDC'];

  const holdings = { ...portfolio.holdings };
  holdings[intent.from] = (holdings[intent.from] ?? 0) - intent.amountUsd;
  holdings[intent.to] = (holdings[intent.to] ?? 0) + intent.amountUsd;

  const equityValue = equityTickers.reduce((s, t) => s + Math.max(holdings[t] ?? 0, 0), 0);
  const yieldValue = yieldTickers.reduce((s, t) => s + Math.max(holdings[t] ?? 0, 0), 0);
  const liquid = (holdings.USDG ?? 0) + (holdings.USDC ?? 0) + (holdings.USDT ?? 0);

  return {
    id: intentIdBytes(intent),
    fromAsset,
    toAsset,
    amountUsd: BigInt(Math.round(intent.amountUsd)),
    safetyScore: BigInt(Math.round(risk.safetyScore ?? 0)),
    depegRiskFromBps: BigInt(Math.round((risk.components?.depegRisk ?? 0) * 10_000)),
    depegRiskToBps: 0n,
    projectedAssetWeightBps: BigInt(Math.max(Math.round(((holdings[intent.to] ?? 0) / portfolio.totalValue) * 10_000), 0)),
    projectedEquityWeightBps: BigInt(Math.max(Math.round((equityValue / portfolio.totalValue) * 10_000), 0)),
    projectedYieldWeightBps: BigInt(Math.max(Math.round((yieldValue / portfolio.totalValue) * 10_000), 0)),
    projectedLiquidityUsd: BigInt(Math.max(Math.round(liquid), 0)),
  };
}

function mandateTuple(mandate) {
  return {
    equityCeilingBps: Math.round((mandate.equityCeiling ?? 0.3) * 10_000),
    yieldCeilingBps: Math.round((mandate.yieldCeiling ?? 0.15) * 10_000),
    riskFloor: Math.round(mandate.riskFloor ?? 40),
    liquidityFloorUsd: Math.round(mandate.liquidityFloor ?? 200_000),
    dailySpendCapUsd: Math.round(mandate.dailySpendCap ?? 500_000),
    humanApprovalThresholdUsd: Math.round(mandate.approvalThresholds?.review ?? 100_000),
    depegCriticalThresholdBps: Math.round((mandate.depegCriticalThreshold ?? 0.5) * 10_000),
  };
}

function parsePolicyReceipt(contract, receipt) {
  let code = 'CLEAR';
  let permitted = true;
  let requiresHumanApproval = false;
  let reason = '';
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog({ topics: [...log.topics], data: log.data });
      if (!parsed) continue;
      if (parsed.name === 'PolicyChecked') {
        code = codeToString(parsed.args.code);
        permitted = Boolean(parsed.args.permitted);
        requiresHumanApproval = Boolean(parsed.args.requiresHumanApproval);
        reason = parsed.args.reason ?? reason;
      }
      if (parsed.name === 'ApprovalRejected') {
        permitted = false;
        code = codeToString(parsed.args.code);
      }
    } catch {
      /* skip */
    }
  }
  return { code, permitted, requiresHumanApproval, reason };
}

async function classifyAll(contract) {
  const rows = [
    [ASSET_ADDR.USDG, true, false, false],
    [ASSET_ADDR.USDC, true, false, false],
    [ASSET_ADDR.AAPL, false, true, false],
    [ASSET_ADDR.MSFT, false, true, false],
    [ASSET_ADDR.NVDA, false, true, false],
    [ASSET_ADDR.AMZN, false, true, false],
    [ASSET_ADDR.PENDLE_PT_USDC, false, false, true],
  ];
  for (const [addr, stable, equity, yieldAsset] of rows) {
    const tx = await contract.classifyAsset(addr, stable, equity, yieldAsset);
    await tx.wait();
  }
}

async function deployLocal(artifact) {
  const eip1193 = ganache.provider({
    wallet: {
      mnemonic: 'test test test test test test test test test test test junk',
      totalAccounts: 5,
      defaultBalance: 1000,
    },
    chain: { chainId: 31337 },
    logging: { quiet: true },
  });
  const provider = new BrowserProvider(eip1193);
  const owner = await provider.getSigner(0);
  const executor = await provider.getSigner(1);
  const ownerAddress = await owner.getAddress();
  const executorAddress = await executor.getAddress();

  const factory = new ContractFactory(artifact.abi, artifact.bytecode, owner);
  const initial = mandateTuple({
    equityCeiling: 0.3,
    yieldCeiling: 0.15,
    riskFloor: 40,
    liquidityFloor: 200_000,
    dailySpendCap: 500_000,
    approvalThresholds: { review: 100_000 },
    depegCriticalThreshold: 0.5,
  });
  const contract = await factory.deploy(ownerAddress, executorAddress, initial);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  await classifyAll(contract);

  const grantTx = await contract.grantDelegate(executorAddress, id('REBALANCE'), 500_000, 7 * 24 * 3600);
  await grantTx.wait();

  return {
    mode: 'local_ganache',
    provider,
    owner,
    executor,
    contract,
    address,
    chainId: 31337,
    explorerBase: null,
    ownerAddress,
    executorAddress,
    label: 'Local policy chain (Ganache) — swap to Robinhood / Arb Sepolia via env',
  };
}

async function connectRemote(artifact) {
  const rpc = process.env.CREANCE_RPC_URL;
  const key = process.env.CREANCE_PRIVATE_KEY;
  const address = process.env.CREANCE_POLICY_ADDRESS;
  const provider = new JsonRpcProvider(rpc);
  const owner = new Wallet(key, provider);
  const network = await provider.getNetwork();
  const contract = new Contract(address, artifact.abi, owner);
  const executorAddress = await contract.executor();
  return {
    mode: 'remote',
    provider,
    owner,
    executor: owner,
    contract,
    address,
    chainId: Number(network.chainId),
    explorerBase: process.env.CREANCE_EXPLORER_BASE || null,
    ownerAddress: await owner.getAddress(),
    executorAddress,
    label: `Remote policy @ ${address}`,
  };
}

export async function ensurePolicyGateway() {
  if (gateway) return gateway;
  if (bootPromise) return bootPromise;
  bootPromise = (async () => {
    const artifact = loadArtifact();
    gateway =
      process.env.CREANCE_RPC_URL && process.env.CREANCE_POLICY_ADDRESS && process.env.CREANCE_PRIVATE_KEY
        ? await connectRemote(artifact)
        : await deployLocal(artifact);
    return gateway;
  })();
  try {
    return await bootPromise;
  } catch (err) {
    bootPromise = null;
    throw err;
  }
}

export function getGatewayStatus() {
  if (!gateway) return { ready: false, mode: 'unbooted' };
  return {
    ready: true,
    mode: gateway.mode,
    address: gateway.address,
    chainId: gateway.chainId,
    owner: gateway.ownerAddress,
    executor: gateway.executorAddress,
    explorerBase: gateway.explorerBase,
    label: gateway.label,
  };
}

function txMeta(g, hash) {
  return {
    txHash: hash,
    chainId: g.chainId,
    explorerUrl: g.explorerBase ? `${g.explorerBase}/tx/${hash}` : null,
    policyAddress: g.address,
  };
}

export async function onchainSubmitDecision({ intent, risk, portfolio, mandate }) {
  const g = await ensurePolicyGateway();
  const onchain = buildOnchainIntent(intent, risk, portfolio, mandate);
  const asExec = g.contract.connect(g.executor);
  const tx = await asExec.submitDecision(onchain);
  const receipt = await tx.wait();
  const parsed = parsePolicyReceipt(g.contract, receipt);
  return {
    ...txMeta(g, receipt.hash),
    ...parsed,
    intentId: onchain.id,
  };
}

export async function onchainSetMandate(mandate) {
  const g = await ensurePolicyGateway();
  const tx = await g.contract.connect(g.owner).setMandate(mandateTuple(mandate));
  const receipt = await tx.wait();
  return txMeta(g, receipt.hash);
}

export async function onchainApproveIntent(intentId) {
  const g = await ensurePolicyGateway();
  const tx = await g.contract.connect(g.owner).approveIntent(intentId);
  const receipt = await tx.wait();
  return txMeta(g, receipt.hash);
}

export async function onchainMarkTradeExecuted({ intent, risk, portfolio, mandate, intentId }) {
  const g = await ensurePolicyGateway();
  const onchain = buildOnchainIntent(intent, risk, portfolio, mandate);
  if (intentId) onchain.id = intentId;
  const tx = await g.contract.connect(g.executor).markTradeExecuted(onchain);
  const receipt = await tx.wait();
  return txMeta(g, receipt.hash);
}

export async function onchainRevokeDelegate(who) {
  const g = await ensurePolicyGateway();
  const target = who || g.executorAddress;
  const tx = await g.contract.connect(g.owner).revokeDelegate(target);
  const receipt = await tx.wait();
  return { ...txMeta(g, receipt.hash), revoked: target };
}
