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
- [x] `npm run compile` → `npm run deploy:policy`
- [x] Set `CREANCE_POLICY_ADDRESS` from deploy output
- [x] Set `CREANCE_EXPLORER_BASE` (Arbscan Sepolia or RH explorer)
- [x] Rehearse full 3-min path with clickable explorer links
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

- [x] Host API (or single-box host)
- [x] Host frontend pointing at that API
- [x] Operator README: env vars, scripts, demo path (no event language in product UI)
- [x] Smoke hosted URL: CAP_001 → approve → Pendle → audit



## 5. Done bar

- [x] Public explorer txs for: reject, mandate change, approve, second reject
- [x] Live demo URL
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
| RPC URL (RH and/or Arb Sepolia) | [x] Arbitrum Sepolia public RPC used |
| Optional ZeroDev project id     | [ ]    |
| Hosting account                 | [x] Render Free API + Vercel Hobby frontend |




## Arbitrum Sepolia proof (2026-09-18)

- Workflow: https://github.com/Erebuzzz/creance/actions/runs/35359937943
- Policy: https://sepolia.arbiscan.io/address/0x75B5eac2737B9fb1b49e7CEB2D3423e3758b8c60
- Deploy: https://sepolia.arbiscan.io/tx/0xc0975106fba2b4214211c33fd1fe421e94c373868a5d91a742a220ebb8f9a785
- `CAP_001` reject: https://sepolia.arbiscan.io/tx/0x178e0ce70211a5c0b004699f14d1bfa3292600897fbf1dfcce6d9a857269c215
- Mandate ceiling change: https://sepolia.arbiscan.io/tx/0xb0bd87debc4f8089bfdc64334f34645608cff59ed9c7a038da6d815d9fd485f6
- Compliant evaluation: https://sepolia.arbiscan.io/tx/0xcd65df24286ec7c0922fab6893d1c52d9130e5fb28d11769759e014f23ff3159
- Owner approval: https://sepolia.arbiscan.io/tx/0x45a108a35107a591df81ba62be9e593ab4bf6e4853bb654ef8da1099cc829c1e
- Execution proof: https://sepolia.arbiscan.io/tx/0xc6d4dc0bb5c3b1a5a49bb51bff43c09b3ced4538f2d54702d2a12a0bc38d06bc
- `YIELD_005` reject: https://sepolia.arbiscan.io/tx/0xe1ef1789485df5343733bf799068ff24f80612ac01ac635487f4de8dd238e59a


## Hosted demo proof (2026-09-18)

- Frontend: https://creance-app.vercel.app/
- API health: https://creance-api.onrender.com/api/health
- API host: Render Free web service (spins down after 15 minutes idle; cold starts can take 50 seconds or more)
- Hosted smoke: `CAP_001` reject → ceiling 50% → `AWAITING_HUMAN` → owner approval / execution → Pendle `YIELD_005` reject
- Hosted smoke hashes are local Ganache demonstration proofs and are not public explorer links. The public Arbitrum Sepolia proof links above remain the durable chain evidence.
