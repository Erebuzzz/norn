/**
 * Deploy CreancePolicy to a remote EVM chain (Arb Sepolia / Robinhood testnet).
 *
 * Required env (placeholders only — never commit real secrets):
 *   CREANCE_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
 *   CREANCE_PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY_HERE
 *
 * Optional:
 *   CREANCE_EXECUTOR_ADDRESS=0x...   (defaults to deployer address)
 *   CREANCE_EXPLORER_BASE=https://sepolia.arbiscan.io
 *
 * Usage:
 *   npm run compile
 *   npm run deploy:policy
 *
 * On success, prints CREANCE_POLICY_ADDRESS and the env block for `npm run api`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ContractFactory, JsonRpcProvider, Wallet, id } from 'ethers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const artifactPath = path.join(__dirname, '../artifacts/CreancePolicy.json');

/** Keep in sync with src/chain/policyGateway.js ASSET_ADDR (demo placeholders). */
const ASSET_ADDR = {
  USDG: '0x0000000000000000000000000000000000005551',
  USDC: '0x0000000000000000000000000000000000005552',
  AAPL: '0x000000000000000000000000000000000000a001',
  MSFT: '0x000000000000000000000000000000000000a002',
  NVDA: '0x000000000000000000000000000000000000a003',
  AMZN: '0x000000000000000000000000000000000000a004',
  PENDLE_PT_USDC: '0x000000000000000000000000000000000000b001',
};

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing required env: ${name}`);
    console.error('');
    console.error('Set placeholders (do not commit real keys):');
    console.error('  CREANCE_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc');
    console.error('  CREANCE_PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY_HERE');
    console.error('');
    console.error('Optional:');
    console.error('  CREANCE_EXECUTOR_ADDRESS=0xYOUR_EXECUTOR_ADDRESS_HERE');
    console.error('  CREANCE_EXPLORER_BASE=https://sepolia.arbiscan.io');
    console.error('');
    console.error('See workflow/deploy-readiness.md');
    process.exit(1);
  }
  if (name === 'CREANCE_PRIVATE_KEY') {
    if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
      console.error('CREANCE_PRIVATE_KEY must be 0x + 64 hex chars (placeholder or real key).');
      process.exit(1);
    }
    if (/YOUR_|PLACEHOLDER|changeme|xxx/i.test(value)) {
      console.error('CREANCE_PRIVATE_KEY still looks like a placeholder. Replace with a funded testnet key.');
      process.exit(1);
    }
  }
  return value;
}

function initialMandate() {
  return {
    equityCeilingBps: 3000,
    yieldCeilingBps: 1500,
    riskFloor: 40,
    liquidityFloorUsd: 200_000,
    dailySpendCapUsd: 500_000,
    humanApprovalThresholdUsd: 100_000,
    depegCriticalThresholdBps: 5000,
  };
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

async function main() {
  const rpc = requireEnv('CREANCE_RPC_URL');
  const key = requireEnv('CREANCE_PRIVATE_KEY');
  const explorerBase = process.env.CREANCE_EXPLORER_BASE?.trim() || null;

  if (!fs.existsSync(artifactPath)) {
    console.error('Missing artifacts/CreancePolicy.json — run: npm run compile');
    process.exit(1);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const provider = new JsonRpcProvider(rpc);
  const deployer = new Wallet(key, provider);
  const network = await provider.getNetwork();
  const balance = await provider.getBalance(deployer.address);

  console.log(`Network chainId=${network.chainId}`);
  console.log(`Deployer ${deployer.address}`);
  console.log(`Balance  ${balance.toString()} wei`);

  if (balance === 0n) {
    console.error('Deployer has zero native balance. Fund via faucet first (see workflow/deploy-readiness.md).');
    process.exit(1);
  }

  const executorAddress =
    process.env.CREANCE_EXECUTOR_ADDRESS?.trim() || deployer.address;

  const factory = new ContractFactory(artifact.abi, artifact.bytecode, deployer);
  console.log('Deploying CreancePolicy…');
  const contract = await factory.deploy(deployer.address, executorAddress, initialMandate());
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  const deployTx = contract.deploymentTransaction();

  console.log('Classifying demo assets…');
  await classifyAll(contract);

  console.log('Granting REBALANCE delegate to executor…');
  const grantTx = await contract.grantDelegate(executorAddress, id('REBALANCE'), 500_000, 7 * 24 * 3600);
  await grantTx.wait();

  const explorerTx = explorerBase && deployTx?.hash ? `${explorerBase}/tx/${deployTx.hash}` : null;
  const explorerAddr = explorerBase ? `${explorerBase}/address/${address}` : null;

  console.log('');
  console.log('=== Deploy OK ===');
  console.log(`CREANCE_POLICY_ADDRESS=${address}`);
  if (deployTx?.hash) console.log(`deployTx=${deployTx.hash}`);
  if (explorerTx) console.log(`explorerTx=${explorerTx}`);
  if (explorerAddr) console.log(`explorerContract=${explorerAddr}`);
  console.log('');
  console.log('Wire the API to this deployment (PowerShell):');
  console.log(`  $env:CREANCE_RPC_URL="${rpc}"`);
  console.log(`  $env:CREANCE_PRIVATE_KEY="0xYOUR_DEPLOYER_PRIVATE_KEY_HERE"`);
  console.log(`  $env:CREANCE_POLICY_ADDRESS="${address}"`);
  if (explorerBase) {
    console.log(`  $env:CREANCE_EXPLORER_BASE="${explorerBase}"`);
  }
  console.log('  npm run api');
  console.log('  npm run demo:chain');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
