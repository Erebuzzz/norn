/**
 * Smoke: live CAP_001 reject → raise ceiling → approve → tx hashes.
 * Run: npm run demo:chain
 */
import {
  evaluateProposal,
  approvePendingIntent,
  ensurePolicyGateway,
  resetTreasuryAndSyncChain,
  syncMandateOnChain,
} from '../src/services/agentService.js';

function show(label, result) {
  console.log(`\n=== ${label} → ${result.outcome} ===`);
  for (const e of result.log?.events ?? []) {
    const proof = e.txHash ? ` tx=${e.txHash.slice(0, 12)}…` : '';
    console.log(`  [${e.code || '----'}] ${e.event}: ${e.detail}${proof}`);
  }
  if (result.chain) console.log(`  chain: ${result.chain.mode} @ ${result.chain.address}`);
}

async function main() {
  await ensurePolicyGateway();
  await resetTreasuryAndSyncChain();

  const beat1 = await evaluateProposal({ maxRetries: 0 });
  show('Beat 1: $150k AAPL vs 30% ceiling', beat1);
  if (beat1.outcome !== 'REJECTED') throw new Error(`expected REJECTED, got ${beat1.outcome}`);
  const hasTx = (beat1.log.events || []).some((e) => e.txHash?.startsWith('0x'));
  if (!hasTx) throw new Error('expected on-chain txHash on reject');
  const cap = (beat1.log.events || []).some((e) => e.code === 'CAP_001');
  if (!cap) throw new Error('expected CAP_001');

  const raised = await syncMandateOnChain({ equityCeiling: 0.5 });
  console.log(`\nMandate raise tx: ${raised.chainTx.txHash}`);

  const beat2 = await evaluateProposal({ maxRetries: 0 });
  show('Beat 2: same intent after 50% ceiling', beat2);
  if (beat2.outcome !== 'AWAITING_HUMAN') throw new Error(`expected AWAITING_HUMAN, got ${beat2.outcome}`);

  const beat3 = await approvePendingIntent();
  show('Beat 3: owner approve + execute', beat3);
  if (beat3.outcome !== 'EXECUTED') throw new Error(`expected EXECUTED, got ${beat3.outcome}`);

  await resetTreasuryAndSyncChain();

  const pendle = await evaluateProposal({
    maxRetries: 0,
    proposal: {
      from: 'USDG',
      to: 'PENDLE_PT_USDC',
      amountUsd: 200_000,
      reason: 'Oversized Pendle allocate',
    },
  });
  show('Beat 4: oversized Pendle allocate', pendle);
  if (pendle.outcome !== 'REJECTED') throw new Error(`expected Pendle REJECTED, got ${pendle.outcome}`);

  console.log('\nOK — live reject/approve path with tx hashes.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
