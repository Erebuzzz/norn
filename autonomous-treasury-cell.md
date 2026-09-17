# Autonomous Treasury Cell

**One-liner:** An autonomous treasury that can act, but cannot break its mandate.

**Event:** Arbitrum Open House Singapore — Online Buildathon (Sept 14 – Oct 4, 2026)
**Target:** Open Category ($70K) + Promising Products / AI-agent track ($15K), built on Robinhood Chain

---

## The problem

Every hackathon "AI + treasury/RWA" pitch in this ecosystem reduces to: *an AI decides, then it trades.* That's the shape of Tilt Protocol (AI-driven onchain hedge fund vaults), Weave (automated tokenized-equity basket rebalancing), and Agama (Stock Tokens as private-credit collateral) — all live, all already occupying "smart allocation of Robinhood Chain assets" territory.

The actual unsolved problem sits one layer up: nobody has separated *the decision* from *the authority to act on it*. An AI agent holding real treasury funds is currently either fully trusted (dangerous) or fully restricted to suggestions a human manually executes (slow, defeats the point of autonomy). There's no enforceable middle layer.

## The thesis

> Human/organization defines policy → AI proposes → risk engine verifies → smart contract enforces → execution happens only if the mandate allows it.

The AI is a replaceable component. The **policy contract is the product**. The pitch is not "smarter AI trading," it's "financial control plane for autonomous agents" — infrastructure, not a fund.

This is deliberately *not* framed as an AI investment manager (too close to Tilt, invites unnecessary regulatory-adjacent framing). It's framed as a treasury operating system: maintain operational liquidity and optimize risk-adjusted capital efficiency within constraints an organization actually set, not "maximize return."

## Competitive positioning

| Project | Core thing |
|---|---|
| Tilt Protocol | Launch and run onchain investment funds |
| Agama | Leverage Stock Tokens into private-credit yield |
| Weave | Build/rebalance tokenized-equity index baskets |
| **Autonomous Treasury Cell** | **Governs the machine managing the money — enforceable mandate, not alpha generation** |

## Architecture — three layers

### Layer 1: Intelligence (off-chain agent swarm — kept deliberately small, 4 agents, invisible to the demo)
- **Treasurer** — proposes allocation changes
- **Risk Officer** — stress-tests the proposal (volatility, correlation, drawdown, concentration, depeg risk, liquidity risk)
- **Policy Officer** — checks the proposal against the mandate before it's ever submitted on-chain
- **Executor** — converts an approved intent into an on-chain action

No agent theater in the UI. Judges see the *result* of the deliberation (why / what / risk / policy / outcome), not four chat windows arguing.

### Layer 2: On-chain policy and risk enforcement (the part judges should care about most)
A policy contract independently re-verifies hard constraints regardless of what the AI submitted:

```
Exposure_asset   ≤ L_asset
Exposure_issuer  ≤ L_issuer
Exposure_chain   ≤ L_chain
RiskScore        ≥ R_min
Liquidity        ≥ L_min
DailySpend       ≤ B_daily
```

If any condition fails, the transaction reverts. The AI can hallucinate; the contract doesn't care. That distinction is the entire product.

Objective function for the risk-adjusted allocation itself:

```
max_w  E[R_p] − λ·σ_p − γ·C_liq

s.t.  Σ w_i = 1
      w_stablecoin ≥ L_min
      w_i ≤ U_i
      VaR_95 ≤ V_max
      Drawdown_stress ≤ D_max
      IssuerExposure_j ≤ E_j
```

### Layer 3: Execution and audit
```
Policy Contract → Execution Controller → Stock Token / Stablecoin → Transaction → Audit Event
```
Every step emits an event: `ProposalCreated → PolicyChecked → RiskVerified → HumanApprovalRequested → ApprovalGranted/Rejected → TradeExecuted → PolicyUpdated → EmergencyFreeze`. The full treasury decision history is auditable on-chain, not just the trades.

**Delegation model:** the treasury owner never hands the AI a private key. Each delegated role (Pay / Rebalance / Hedge) carries its own spending limit, asset whitelist, time-to-live, and max exposure — and is instantly revocable, killing the entire delegated subtree.

**Intent/execution separation (stretch):** the agent emits a structured intent (`REBALANCE`, target exposures, max slippage, validity window, risk budget) rather than a raw transaction; the execution layer decides how to satisfy it within policy. Keeps the architecture open to human operators or external treasury software using the same policy layer later.

## Asset universe (V1)

- **Stablecoins:** USDC, USDT (where available on Robinhood Chain)
- **Stock Tokens** (use this exact terminology — Robinhood's brand guidelines explicitly disallow "tokenized stocks/equities"): AAPL, MSFT, NVDA, AMZN, plus an ETF-type token if available
- **Native asset:** ETH

## Open risk-sourcing question to resolve before building

Stock Token pricing is solved — native Chainlink feeds on Robinhood Chain, no fabrication needed. Stablecoin depeg/liquidity/correlation risk inputs are **not** natively on-chain anywhere — that data has to come from real Chainlink feeds plus an explicitly-labeled heuristic layer for anything not sourced live. Decide and document this before the demo, or a sharp judge finds the placeholder.

## The demo (3 minutes, scripted around a live rejection, not a live trade)

1. Show treasury state: $1M, $700K USDC / $300K Stock Tokens, policy caps equity at 30%.
2. Ask the agent to increase equity allocation → it proposes $150K AAPL → **contract rejects** (would breach 30% cap). Judges see the reason, not just a red X.
3. Loosen the policy to 50% equity cap → same proposal resubmitted → **succeeds**, on-chain.
4. Simulate an adverse market event → agent proposes reducing exposure → **accepted**, portfolio rebalances.
5. Tighten a risk parameter so the next proposal violates the mandate → **rejected again.**

Judges should be able to click "Rebalance" and immediately see: `WHY / WHAT / RISK / POLICY / RESULT / TX HASH`. No AI chat interface — the intelligence shows up as observable, auditable decisions, not conversation.

## Compliance checklist (per hackathon rules)

- Deployed on an Arbitrum chain — Robinhood Chain (Orbit) satisfies this and targets its reserved prize slot
- Solo builder + agent swarm — no team-size minimum in the official rules
- Existing codebase/idea allowed going in — this isn't a from-scratch-only event
- Judged on: smart contract quality, product-market fit, innovation and creativity, real problem solving
- Note: Robinhood Chain and "Arbitrum" are **two separate reserved slots** in the $70K pool (min. 1 of 3 for each), not a guarantee of both — building on Robinhood Chain earns a real shot at its slot plus the open third slot, not an automatic claim on all three
- Prize payout (outside Promising Products): 50% upfront, 50% milestone-based — the pitch should signal a credible post-hackathon roadmap, not just a finished demo
