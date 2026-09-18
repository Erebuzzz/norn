# Creance completion checklist

Verification branch: `review/checklist-completion`. This file preserves the user-supplied checklist; checks below are changed only when verified on this branch.

Use this as the single source of truth for what is left. Mark items `[x]` as you finish them.

## 0. Land code

- [x] Merge PR #1 — policy + compile/deploy + chain gateway
- [x] Merge PR #2 — treasury API + services + tests
- [x] Merge PR #3 — Cold Vault UI
- [x] Merge PR #4 — agentic loop wiring
- [x] Merge PR #5 — docs / workflow (can merge anytime)
- [x] On `main`: `npm install` → `npm test` → `npm run compile`

## 1. Local demo (sanity)

- [x] `npm run api` + `npm start` (or `npm run demo:chain`)
- [x] Evaluate ~$150k AAPL → `CAP_001` + tx hash
- [x] Raise equity ceiling → re-evaluate → approve + tx hash
- [x] Pendle allocate → `YIELD_005` + tx hash
- [x] Audit timeline shows ordered events + hashes
- [x] Reset restores 0.3 ceiling and CAP_001 still fires
- [x] Theme toggle: light + AMOLED
- [x] Desktop symmetric layout + ~390px usable



## 2. Public deploy (critical)

- [x] Create deployer wallet (never commit the key)
- [x] Fund Arbitrum Sepolia gas ([https://arbitrum.faucet.dev/](https://arbitrum.faucet.dev/))
- [ ] Optional: Circle USDC faucet ([https://faucet.circle.com/](https://faucet.circle.com/))
- [ ] Fund Robinhood testnet ([https://faucet.testnet.chain.robinhood.com/](https://faucet.testnet.chain.robinhood.com/))
- [x] Set `CREANCE_RPC_URL` (local shell / gitignored `.env` only)
- [x] Set `CREANCE_PRIVATE_KEY` (encrypted GitHub Actions secret; never committed)
- [ ] `npm run compile` → `npm run deploy:policy`
- [ ] Set `CREANCE_POLICY_ADDRESS` from deploy output
- [x] Set `CREANCE_EXPLORER_BASE` (Arbscan Sepolia or RH explorer)
- [ ] Rehearse full 3-min path with clickable explorer links
- [ ] Prefer RH for Stock Token beat; Arb Sepolia as dry-run if needed

See `workflow/deploy-readiness.md`.

## 3. Product completeness

- [x] Live / labeled USDG liquidity on holdings
- [ ] Stock Token exposure tied to real RH testnet assets where possible
- [x] Mandate edit on-chain (ceiling) from UI
- [x] Instant delegate revoke with tx proof
- [x] Second enforcement beat always visible (Pendle or risk floor)
- [ ] Real Pendle router call on Arbitrum under policy caps (after RH path works)
- [ ] Optional: ZeroDev scoped executor (`CREANCE_ZERODEV_PROJECT_ID`)
- [x] Oracle vs heuristic risk badges (credible, not hand-wavy)
- [x] API hardening: env validation, no secrets in client, safe CORS



## 4. Ship surface

- [ ] Host API (or single-box host)
- [ ] Host frontend pointing at that API
- [x] Operator README: env vars, scripts, demo path (no event language in product UI)
- [ ] Smoke hosted URL: CAP_001 → approve → Pendle → audit



## 5. Done bar

- [ ] Public explorer txs for: reject, mandate change, approve, second reject
- [ ] Live demo URL
- [x] Repo on `main` with merged PRs
- [x] One-line thesis ready: agent proposes, mandate enforces
- [ ] Walkthrough recording (optional but strong)



## Explicitly out of scope / do not

- [ ] Do not pitch as “AI that trades stock tokens”
- [ ] Do not put hackathon / buildathon language in product UI or marketing copy
- [ ] Do not block RH Stock Token demo on Pendle
- [ ] Do not start Stylus / Rust contracts for V1



## You must provide


| Item                            | Status |
| ------------------------------- | ------ |
| Funded testnet private key      | [x] Stored in encrypted vault; Arbitrum Sepolia wallet funded |
| RPC URL (RH and/or Arb Sepolia) | [ ]    |
| Optional ZeroDev project id     | [ ]    |
| Hosting account                 | [ ]    |


