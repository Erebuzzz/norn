# Creance public deploy readiness

**Goal:** Move from local Ganache policy txs to explorer-linked rejects/approves on **Arbitrum Sepolia** (dry-run) then **Robinhood Chain testnet** (primary Stock Token demo).

**Local status:** DONE (`npm run compile` → `npm run api` / `npm run demo:chain`).

**Public status:** BLOCKED on user-provided secrets + faucet funds. No real private keys belong in the repo.

### Go / no-go (RH vs Sepolia)

| Checkpoint | Arb Sepolia (dry-run) | Robinhood Chain testnet (primary) |
| --- | --- | --- |
| Funded `CREANCE_PRIVATE_KEY` | Required | Required (same or separate throwaway) |
| `CREANCE_RPC_URL` | `https://sepolia-rollup.arbitrum.io/rpc` | `https://rpc.testnet.chain.robinhood.com` (or Alchemy RH URL from docs) |
| Gas faucet | https://arbitrum.faucet.dev/ | https://faucet.testnet.chain.robinhood.com/ |
| `CREANCE_EXPLORER_BASE` | `https://sepolia.arbiscan.io` | `https://explorer.testnet.chain.robinhood.com` |
| After `npm run deploy:policy` | Set `CREANCE_POLICY_ADDRESS` | Set `CREANCE_POLICY_ADDRESS` (RH address ≠ Sepolia) |
| Smoke | `npm run api` + `npm run demo:chain` → Arbiscan tx links | Same → RH explorer tx links |
| Optional | Circle USDC faucet | Real Stock Token / USDG addresses when known |

Order: prove Sepolia first if helpful, then redeploy/env-switch for RH. Missing key or zero faucet balance = stay on local Ganache.

---

## How the repo wires chain today

| Piece | Role |
| --- | --- |
| `scripts/compile-policy.mjs` | Builds `artifacts/CreancePolicy.json` |
| `scripts/deploy-policy.mjs` | Remote deploy (fails clearly if RPC/key unset) |
| `src/chain/policyGateway.js` | If `CREANCE_RPC_URL` + `CREANCE_PRIVATE_KEY` + `CREANCE_POLICY_ADDRESS` are set → remote; else in-process Ganache |
| `src/config/arbitrum.js` | Chain IDs, default Arb Sepolia RPC, RH env slots, explorer notes |
| `src/services/zeroDevExecutor.js` | Stand-in until `CREANCE_ZERODEV_PROJECT_ID` is set |

Remote gateway uses the owner key for owner + executor calls in the current stub (`executor: owner`). That is enough for the 3-minute reject → mandate → approve path. ZeroDev session keys are the next hardening step, not a deploy blocker.

---

## Exact env vars (placeholders only)

### Required for remote gateway / deploy

| Var | Placeholder | Notes |
| --- | --- | --- |
| `CREANCE_RPC_URL` | `https://sepolia-rollup.arbitrum.io/rpc` or RH RPC below | Active JSON-RPC for the chain you are using |
| `CREANCE_PRIVATE_KEY` | `0xYOUR_DEPLOYER_PRIVATE_KEY_HERE` | Funded **testnet** deployer; never commit |
| `CREANCE_POLICY_ADDRESS` | `0xYOUR_DEPLOYED_POLICY_ADDRESS_HERE` | Set after `npm run deploy:policy` |

### Required for explorer-linked demo hashes

| Var | Placeholder / example |
| --- | --- |
| `CREANCE_EXPLORER_BASE` | Arb Sepolia: `https://sepolia.arbiscan.io` · RH testnet: `https://explorer.testnet.chain.robinhood.com` |

Gateway builds `explorerUrl` as `{CREANCE_EXPLORER_BASE}/tx/{hash}`.

### Optional / recommended

| Var | Placeholder | Notes |
| --- | --- | --- |
| `CREANCE_EXECUTOR_ADDRESS` | `0xYOUR_EXECUTOR_ADDRESS_HERE` | Defaults to deployer if unset |
| `CREANCE_ARB_SEPOLIA_RPC` | same as public Sepolia RPC | Used by `arbitrum.js` config surface |
| `CREANCE_RH_RPC` | `https://rpc.testnet.chain.robinhood.com` | From [Robinhood Chain docs](https://docs.robinhood.com/chain/connecting/) |
| `CREANCE_RH_CHAIN_ID` | `46630` | Robinhood Chain **testnet** |
| `CREANCE_RH_EXPLORER` | `https://explorer.testnet.chain.robinhood.com` | Same base as `CREANCE_EXPLORER_BASE` on RH |
| `CREANCE_ZERODEV_PROJECT_ID` | `YOUR_ZERODEV_PROJECT_ID_HERE` | Dashboard: https://docs.zerodev.app/ — not required for first public policy txs |
| `CREANCE_USDG_ADDRESS` | `0xYOUR_USDG_VENUE_ADDRESS_HERE` | When Paxos/RH listing address is known |
| `CREANCE_API_PORT` | `8787` | Default API port |
| `VITE_CREANCE_API_BASE` | (empty = same-origin proxy) | Only if UI talks to a remote API |

### PowerShell example (Arb Sepolia dry-run)

```powershell
$env:CREANCE_RPC_URL="https://sepolia-rollup.arbitrum.io/rpc"
$env:CREANCE_PRIVATE_KEY="0xYOUR_DEPLOYER_PRIVATE_KEY_HERE"
$env:CREANCE_EXPLORER_BASE="https://sepolia.arbiscan.io"
# after deploy:
$env:CREANCE_POLICY_ADDRESS="0xYOUR_DEPLOYED_POLICY_ADDRESS_HERE"
```

### PowerShell example (Robinhood Chain testnet)

```powershell
$env:CREANCE_RPC_URL="https://rpc.testnet.chain.robinhood.com"
$env:CREANCE_RH_RPC="https://rpc.testnet.chain.robinhood.com"
$env:CREANCE_RH_CHAIN_ID="46630"
$env:CREANCE_RH_EXPLORER="https://explorer.testnet.chain.robinhood.com"
$env:CREANCE_EXPLORER_BASE="https://explorer.testnet.chain.robinhood.com"
$env:CREANCE_PRIVATE_KEY="0xYOUR_DEPLOYER_PRIVATE_KEY_HERE"
# after deploy:
$env:CREANCE_POLICY_ADDRESS="0xYOUR_DEPLOYED_POLICY_ADDRESS_HERE"
```

If Alchemy-hosted RH RPC is preferred, use the key-gated URL from Robinhood docs (`https://robinhood-testnet.g.alchemy.com/v2/{API_KEY}`) instead of inventing endpoints.

---

## Faucets

| Need | URL |
| --- | --- |
| Arb Sepolia ETH (primary) | https://arbitrum.faucet.dev/ |
| Arb Sepolia ETH (backup) | https://faucet.quicknode.com/arbitrum/sepolia · https://www.l2faucet.com/arbitrum |
| Arb Sepolia USDC | https://faucet.circle.com/ (select Arbitrum Sepolia) |
| Robinhood Chain testnet ETH | https://faucet.testnet.chain.robinhood.com/ |
| L1 Sepolia → bridge only if needed | https://sepoliafaucet.com/ → https://bridge.arbitrum.io/ |

---

## Chain reference (public, non-secret)

| Network | Chain ID | Default RPC | Explorer |
| --- | --- | --- | --- |
| Arbitrum Sepolia | `421614` | `https://sepolia-rollup.arbitrum.io/rpc` | https://sepolia.arbiscan.io |
| Robinhood Chain testnet | `46630` | `https://rpc.testnet.chain.robinhood.com` | https://explorer.testnet.chain.robinhood.com |
| Arbitrum One (Pendle stretch later) | `42161` | `https://arb1.arbitrum.io/rpc` | https://arbiscan.io |

Docs: [Arbitrum get started](https://docs.arbitrum.io/welcome/get-started) · [Robinhood Chain](https://docs.robinhood.com/chain/) · [ZeroDev](https://docs.zerodev.app/)

---

## Step-by-step: Arbitrum Sepolia (first public proof)

1. Create / use a **throwaway testnet** wallet. Export private key locally only.
2. Fund gas: https://arbitrum.faucet.dev/ (backup faucets above).
3. Optional USDC: https://faucet.circle.com/ → Arbitrum Sepolia.
4. Compile:
   ```powershell
   cd D:\Creance
   npm run compile
   ```
5. Set env (placeholders until you paste the real key in your shell, not in git):
   ```powershell
   $env:CREANCE_RPC_URL="https://sepolia-rollup.arbitrum.io/rpc"
   $env:CREANCE_PRIVATE_KEY="0xYOUR_DEPLOYER_PRIVATE_KEY_HERE"
   $env:CREANCE_EXPLORER_BASE="https://sepolia.arbiscan.io"
   ```
6. Deploy:
   ```powershell
   npm run deploy:policy
   ```
   Script fails with a clear message if RPC/key unset, key looks like a placeholder, or balance is zero.
7. Copy printed `CREANCE_POLICY_ADDRESS` into the same shell session.
8. Boot API on remote mode + smoke:
   ```powershell
   npm run api
   # other terminal, same env vars:
   npm run demo:chain
   ```
9. Confirm hashes open on Arbiscan via `{CREANCE_EXPLORER_BASE}/tx/{hash}`.
10. UI path: `npm start` with API already running; run CAP_001 reject → raise ceiling → approve.

---

## Step-by-step: Robinhood Chain testnet (primary win bar)

1. Read https://docs.robinhood.com/chain/ and https://docs.robinhood.com/chain/deploy-smart-contracts/
2. Fund RH testnet ETH: https://faucet.testnet.chain.robinhood.com/
3. Set RH env (see PowerShell block above). Prefer public RH RPC unless you have an Alchemy key.
4. `npm run compile` (if not already).
5. `npm run deploy:policy` with RH `CREANCE_RPC_URL` + funded key + `CREANCE_EXPLORER_BASE` pointing at RH explorer.
6. Set `CREANCE_POLICY_ADDRESS` from script output.
7. `npm run api` + `npm run demo:chain` (or UI demo).
8. Open reject + approve txs on https://explorer.testnet.chain.robinhood.com
9. Keep Arb Sepolia address noted as dry-run fallback; RH is the Stock Token narrative chain.

Asset allowlist in the deploy script still uses **demo placeholder addresses** from `policyGateway.js` (`ASSET_ADDR`). Swap to real Stock Token / USDG venue addresses when confirmed (`CREANCE_USDG_ADDRESS` + code update). Policy codes and demo spine still work with placeholders.

---

## Verification checklist (matches 3-minute demo)

Setup before the call: remote gateway booted, explorer base set, mandate ~30% Stock Token ceiling, portfolio story with USDG + equity, REBALANCE delegate active.

| Beat | Must see | Pass? |
| --- | --- | --- |
| 0:00–0:25 | Calm ops UI; holdings + equity ceiling; no chat theater | [ ] |
| 0:25–1:10 | Evaluate ~$150k AAPL → **REJECT** `CAP_001` + **tx hash** + explorer link | [ ] |
| 1:10–1:40 | Owner raises equity ceiling to 50% → mandate tx + explorer link | [ ] |
| 1:40–2:20 | Re-evaluate → `AWAITING_HUMAN` → Approve → `TradeExecuted` + tx/explorer | [ ] |
| 2:20–2:50 | Optional: oversized Pendle → `YIELD_005` reject + tx (policy gate; not live Pendle router) | [ ] |
| 2:50–3:00 | Close on policy-as-product; revoke delegate if time | [ ] |

Headless equivalent:

```powershell
npm run demo:chain
```

Expect: `REJECTED` + CAP_001 + tx → mandate raise tx → `AWAITING_HUMAN` → `EXECUTED` + tx → optional Pendle `REJECTED` + YIELD_005.

Also confirm:

- [ ] `GET /api/config/chain` shows remote policy address (not only local note)
- [ ] Audit timeline entries include `txHash` and clickable `explorerUrl`
- [ ] `CREANCE_PRIVATE_KEY` never committed; `.env` stays local / gitignored if you create one
- [ ] ZeroDev Project ID optional for this bar; stand-in is OK until session keys ship

---

## Commands cheat sheet

```powershell
cd D:\Creance
npm run compile
npm run deploy:policy    # needs CREANCE_RPC_URL + CREANCE_PRIVATE_KEY
npm run api              # remote if all three CREANCE_* set; else Ganache
npm run demo:chain
npm start
npm test
```

---

## What the user must provide to unblock

1. **Funded testnet private key** (Arb Sepolia and/or RH) — paste only into local shell / local `.env`, never into chat commits.
2. **Confirm RPC choice** (public defaults above vs Alchemy key-gated RH URL).
3. **Optional:** ZeroDev Project ID for real session-key executor.
4. **Optional:** Real USDG / Stock Token contract addresses when available.

Until (1) is set in the environment, keep using local Ganache; public explorer deploy cannot proceed without it.
