# Creance build progress

Date: 2026-09-18 (agentic tick)

## Architecture verdict

Vite SPA + Node API `:8787` + in-process Ganache `CreancePolicy` gateway. **Local policy demo SHIPPED.** Highest remaining gap: **public Arb/RH explorer deploy** (blocked on user key + faucet). Runbook: `workflow/deploy-readiness.md`.

## Implemented

### Prior
- API layer, treasury state, agent service, Pendle mock surfaces
- `CreancePolicy.sol` + solc artifact
- `src/chain/policyGateway.js` (local Ganache / remote env)
- On-chain evaluate / approve / mandate / revoke wired through agentService

### This tick
- **Cold Vault UI** rip-replace (`index.html`, `styles.css`, `main.js`)
- Mandate → Evaluate → Verdict → Audit IA
- Revoke REBALANCE delegate control in Mandate stage
- `workflow/CONTEXT.md` rewritten as SSoT
- Design handoff YAML; product copy free of event language
- `arbitrum.js` note scrubbed of "judge path" wording
- `workflow/deploy-readiness.md` + `scripts/deploy-policy.mjs` (`npm run deploy:policy`)

## Verified

- Run `npm test` after this tick
- Policy boots with `npm run api` (Ganache) when artifact present

## Remains blocked / TODO

- [ ] Deploy + verify CreancePolicy on Robinhood testnet (or Arb Sepolia fallback); set `CREANCE_*` env — **next critical**
- [ ] Real Stock Token / USDG venue addresses
- [ ] Pendle `routerStatic` live quotes
- [x] Browser QA sign-off for Cold Vault (desktop + 390px) — PASSED 2026-09-18
- [x] Reset re-syncs on-chain mandate (agent 918ba267)
- [ ] ZeroDev session-key executor beyond model stub
- [ ] Persistent treasury storage

## Next exact commands

```bash
cd D:\Creance
npm run compile
npm run api
# other terminal:
npm start
npm test
npm run demo
# optional chain smoke:
npm run demo:chain
```
