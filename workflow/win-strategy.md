# Creance Win Strategy

**Verdict:** PIVOT-LIGHT. Keep the policy-control-plane thesis. Do not rebuild as an AI fund. Upgrade for on-chain proof, Robinhood Chain deployment, USDG consideration, and a thin Pendle yield venue under mandate.

**Date:** 2026-09-18  
**Event:** Arbitrum Open House Singapore Online Buildathon (HackQuest)  
**Time left (from live page):** ~14 days to registration/submission close  
**Primary targets:** Open Category ($70K) + Promising Products ($15K)  
**Secondary:** discretionary Grants ($30K)

---

## Confirmed tracks, prizes, judging (browser-verified)

Source: [HackQuest buildathon page](https://www.hackquest.io/hackathons/Arbitrum-Open-House-Singapore-Online-Buildathon) and [Arbitrum Foundation blog](https://blog.arbitrum.foundation/open-house-singapore-applications-are-now-open/).

### Prize pool ($115K Buildathon)

| Track | Pool | Split | Notes |
| --- | --- | --- | --- |
| Overall / Open Category | 70,000 USDC | 40k / 20k / 10k | Min 1 of 3 reserved for Robinhood Chain; min 1 of 3 reserved for Arbitrum |
| Promising Products | 15,000 USDC | 7k / 5k / 3k | Frontier products: AI agents, new financial primitives; same chain reservation notes |
| Grants | 30,000 USDC | case-by-case | Not guaranteed; Foundation discretion |

Outside Promising Products, payouts are 50% upfront / 50% milestone-tied (blog). Pitch must imply a credible post-event build path.

### Hard qualification

- Project **must be deployed on an Arbitrum chain** (Arbitrum Sepolia, Arbitrum One, Robinhood Chain, or other Arbitrum chain).
- Client-only simulation does **not** qualify.

### Judging criteria (both prize tracks)

1. Smart contract quality  
2. Product-market fit  
3. Innovation and creativity  
4. Real problem solving  

**Extra consideration:** projects integrating **Paxos USDG**.

### Partner reality (Pendle)

- Pendle Finance is listed as an ecosystem support partner for workshops/support, **not** a dedicated prize track.
- Pendle depth does not score a separate purse, but it wins partner attention, demo credibility, and differentiation if it is a real venue under policy, not a logo slide.
- Repo reference: [pendle-core-v2-public](https://github.com/pendle-finance/pendle-core-v2-public)

### Competitive context already named in product docs

Tilt (AI onchain funds), Weave (Stock Token baskets), Agama (Stock Token private credit) occupy "smart allocation" territory. Creance must stay in **enforceable mandate / control plane**, not alpha generation.

---

## Honest scorecard (current idea as of docs + codebase)

| Dimension | Score (1-10) | Why |
| --- | --- | --- |
| Novelty | **7.5** | "Decision ≠ authority" and policy-as-product is sharper than most AI vault pitches. Not unprecedented globally (agent guardrails exist), but rare as a finished treasury product story. |
| Arbitrum fit | **8.5** | Robinhood Chain + Stock Tokens + Orbit is the strongest available fit for reserved slots. USDG bonus is currently unused. |
| Pendle depth | **1.5** | Zero integration today. Partner exists; no Pendle prize track. Depth is optional leverage, not a track requirement. |
| Demoability | **8.0** | Rejection-first 3-minute script is excellent and already mirrored in `AGENTIC_LOOP_SPEC.md` / UI. |
| Technical feasibility (remaining time) | **6.0** | Loop, tests, UI, and `CreancePolicy.sol` exist. Live deploy + executor wiring + any Pendle path is the squeeze. |
| Judge clarity | **8.5** | One sentence pitch is clear. Judges can grasp "AI proposes, contract enforces" in under 15 seconds. |
| Differentiation vs typical DeFi+AI | **7.5** | Framing beats the pack. If the demo only shows a simulated reject, it collapses into "AI agent UI with mock policy." |

**Composite read:** strong Promising Products contender if deployed; competitive for Robinhood-reserved Overall slot if contracts feel real and the product does not look like a trading bot. Unlikely to win Overall #1 without live chain proof, USDG signal, and one non-toy venue integration.

---

## KEEP / PIVOT-LIGHT / PIVOT-HARD

### Recommendation: **PIVOT-LIGHT**

**Keep**

- Policy contract as the product.
- Structured intent → risk → policy → execute / reject.
- Rejection-first demo (not a flashy profitable trade).
- No agent chat theater.
- Stock Token + stablecoin treasury framing on Robinhood Chain.

**Light pivot (required upgrades)**

1. Ship a **real deployment** on Robinhood Chain preferred; Arbitrum Sepolia acceptable as fallback if RH tooling blocks, but then you forfeit the reserved-slot narrative.
2. Make the UI show **real policy check / reject / approve tx hashes**, not only local audit events.
3. Add **USDG** as a first-class liquidity / settlement asset (explicit judge signal).
4. Add **Pendle as a policy-gated yield venue** (fixed exposure cap, liquidity floor, expiry window), not as the product identity.
5. Prove **revocable delegated authority** (agent never holds owner keys).

**Do not hard-pivot to**

- An AI hedge fund / "maximize yield" vault (collides with Tilt and generic DeFi+AI).
- A Pendle-first yield farmer with a thin policy wrapper.
- A Stock Token index product (Weave territory).

---

## Ranked feature additions (maximize win odds, product-complete feel)

Never mention the hackathon, buildathon, prizes, or judges in product copy.

### 1. Live on-chain policy gate with explainable revert (must)

Deploy `CreancePolicy` (or successor) and wire Re-evaluate / Approve to chain. Rejection must surface `CAP_001` / `RISK_002` / etc. with a tx hash. This is the difference between a prototype and a product under the stated judging criteria.

### 2. USDG as mandate liquidity asset (high ROI, low novelty cost)

Treat USDG as primary operational liquidity alongside or instead of generic USDC in the demo portfolio. Mandate fields: `minUsd gLiquidity`, allowlist, depeg/heuristic labeling unchanged. Captures explicit extra consideration without changing the thesis.

### 3. Pendle yield intent under the same mandate (partner depth, still control-plane)

One venue action: `ALLOCATE_YIELD` into a Pendle market (SY/PT path on Arbitrum One if Robinhood Pendle liquidity is absent; document chain routing honestly). Policy must enforce:

- max Pendle / yield exposure  
- min liquid stable residual  
- max instrument maturity / lock  
- daily spend  

Demo beat: agent proposes oversized Pendle allocation → policy rejects → smaller compliant allocate succeeds. Product feels like a treasury OS with real venues, not a Pendle wrapper.

### 4. Owner mandate update + instant role revoke (product completeness)

Show signed/owner-gated mandate edit (equity ceiling) and revoke of a `REBALANCE` delegate mid-flow. Proves the "authority" side of the thesis in under 30 seconds.

### 5. Risk provenance badges (trust, not flash)

Every risk figure labeled `oracle` vs `heuristic`. Prevents a sharp judge from killing credibility on depeg/liquidity placeholders. Already required by `creance.md`; make it visually primary.

### Explicit non-goals for this window

- Multi-agent chat UI  
- Full Markowitz optimizer theater  
- Cross-chain messaging complexity  
- Token launch / points / leaderboard gamification  
- Building a second product for a fictional Pendle prize track  

---

## Alternative concepts

**Stay and upgrade.** No alternative clearly beats the current idea on win probability **if** the light pivot above ships.

| Alternative | Why it does not clearly beat |
| --- | --- |
| Pendle YT auto-compounder with light AI | Higher partner surface, lower novelty, worse differentiation vs DeFi+AI pack, weaker Robinhood Stock Token story. |
| Stock Token basket rebalancer | Direct Weave collision; judges see allocator, not control plane. |

Only reconsider a hard pivot if deployment on any Arbitrum chain proves impossible in time (then the current idea fails the hard qualification anyway).

---

## Ruthless MVP scope (judge must-demo path, ~3 minutes)

### In scope

1. Deployed policy contract on an Arbitrum chain (Robinhood preferred).  
2. UI that shows treasury state, mandate controls, intent card, audit timeline.  
3. Scripted live **reject** with reason + tx.  
4. Owner raises equity ceiling; same intent **passes** with approval + tx.  
5. One adverse / de-risk or Pendle-cap reject to prove continuous enforcement.  
6. USDG visible in holdings / allowlist.  
7. Risk source labels.  
8. README / creance one-liner only: product language, no event language.

### Out of scope (cut without guilt)

- Full LLM Treasurer (deterministic/heuristic propose is fine if labeled).  
- Multi-venue routing beyond one Pendle path.  
- Production oracle network for every risk factor.  
- Mobile polish beyond "usable on laptop demo."  
- Fancy agent swarm visualization.

### Success criteria for judges

After 3 minutes they can repeat:

> "Creance lets an agent act on treasury capital only inside an on-chain mandate. We watched it reject, then succeed, with transaction proofs."

If they say "cool AI trader," the pitch failed.

---

## 3-minute demo script (exact beats)

**Setup (before call):** wallet connected, contracts deployed, mandate at 30% Stock Token ceiling, portfolio ~$1M with USDG + Stock Tokens, agent delegate active.

| T | Action | What judges must see |
| --- | --- | --- |
| 0:00-0:25 | Open Creance. State one line: autonomous treasury that can act but cannot break its mandate. Show holdings + ceiling. | Calm ops UI, no chat. |
| 0:25-1:10 | Trigger rebalance / evaluate $150k AAPL buy. | Intent → Risk → Policy **REJECT** `CAP_001`, plain-language reason, **tx hash**. |
| 1:10-1:40 | Owner moves Stock Token ceiling to 50%. Re-evaluate same intent. | Mandate update event; policy now clear / human-approval if threshold crossed. |
| 1:40-2:20 | Approve. | `TradeExecuted` (or authorized execute) with **tx hash**; audit timeline ordered. |
| 2:20-2:50 | Optional win beat: propose oversized Pendle allocate **or** tighten risk floor and show second reject. | Continuous enforcement, not one-shot gate. |
| 2:50-3:00 | Close: agent is replaceable; policy contract is the product. Point at revoke / allowlist if time. | Infrastructure framing. |

---

## Track targeting plan

1. **Promising Products ($15K):** primary probability mass. AI-agent + new financial primitive (enforceable mandate) fits the stated frontier framing.  
2. **Overall + Robinhood reserved slot:** require Robinhood Chain deploy + Stock Token + USDG story.  
3. **Grants:** mention milestone roadmap only in submission/pitch materials, not in product UI: production oracles, multi-venue execution controller, org SSO / role graph.

Submit under both Overall and Promising Products if the platform allows dual tagging; otherwise prefer Promising Products packaging with Robinhood deployment called out for the reserved Overall consideration.

---

## Build order for remaining days

1. Deploy + verify `CreancePolicy` on target chain; smoke-test reject/approve from a script.  
2. Wire UI executor to chain; replace simulated hashes.  
3. Add USDG allowlist + holdings in demo state.  
4. Pendle allocate path behind the same policy checks (even if Arb One venue while treasury UI is RH-branded Stock Tokens: be honest in architecture docs).  
5. Revoke-delegate microflow.  
6. Rehearse the 3-minute script twice on a clean wallet.  
7. Submission: short loom + repo + deployed addresses + architecture diagram from `creance.md`.

---

## Risks that kill the win

- Shipping simulation-only (hard fail on deployment rule).  
- Looking like Tilt/Weave (alpha / basket language in UI).  
- Hiding heuristic risk as live oracle data.  
- Overbuilding agent swarm UX instead of contract proof.  
- Pendle logo without a policy-gated action.  
- Mentioning hackathon framing inside the product.

---

## Bottom line

Creance is already pointed at the right problem and the right demo. Winning is not a new idea; it is **on-chain enforceability + Robinhood/USDG fit + one real venue under mandate** before the clock runs out.
