# Creance - Agentic Loop: Task Specification

Reference implementation exists: `src/agenticLoop.js` + `src/demo.js`, verified working (`node src/demo.js`). Use this spec to extend it, port it to another language/runtime, or check the swarm's own implementation against expected behavior.

## Objective

Given a treasury state, a mandate, and market data, decide whether a proposed reallocation executes, gets revised and retried, gets rejected, or freezes the whole system - deterministically, auditably, and matching what the on-chain policy contract will separately enforce.

## Workflow (control flow, not just role list)

```
propose (Treasurer)
    │
    ▼
compute risk (Risk Officer) ──► critical depeg? ──yes──► FREEZE, stop
    │ no
    ▼
check policy (Policy Officer)
    │
    ├─ permitted, no human needed ──► execute (Executor) ──► EXECUTED, stop
    │
    ├─ permitted, human needed ──► await approval
    │                                  ├─ approved ──► execute ──► EXECUTED, stop
    │                                  └─ declined ──► REJECTED, stop
    │
    └─ rejected ──► retries left? 
                        ├─ yes ──► Treasurer revises intent ──► loop back to compute risk
                        └─ no  ──► REJECTED, stop
```

Four outcomes only: `EXECUTED`, `REJECTED`, `FROZEN`, or (mid-flight) `AWAITING_HUMAN`. Nothing else is a valid terminal state.

## Step-by-step: inputs, outputs, expected behavior

### 1. Treasurer - propose

**Input:** current portfolio (holdings, total value, spend-so-far), market snapshot, mandate.
**Output:** an Intent - `{ from, to, amountUsd, reason }`.
**Expected behavior:** produces one concrete, sizeable proposal, not a menu of options. On a retry after rejection, it must produce a **smaller, more conservative** version of the same intent, informed by exactly why the prior attempt failed - not a random new idea. This is the one place a real LLM call plugs in; the deterministic heuristic in the reference code is a stand-in.

### 2. Risk Officer - score

**Input:** the Intent, portfolio, market snapshot, mandate (needed for which tickers count as equity).
**Output:** a safety score 0-100 (**higher = safer**, this is inverted from a raw "risk score") plus its components (depeg, illiquidity, concentration, volatility).
**Expected behavior:**
- Depeg risk is read from whichever side of the trade is a stablecoin, not from a hardcoded side.
- Concentration is measured against **total combined equity exposure after the trade**, not just the destination asset - a sell into a stablecoin must never score as increasing risk.
- Unknown liquidity depth for a non-stablecoin asset is scored as fully illiquid (1.0), not as free (0.0) - missing data must never be optimistic.
- This step never blocks anything by itself. It hands a number to the Policy Officer.

### 3. Policy Officer - the deterministic gate

**Input:** Intent, safety score, mandate, portfolio.
**Output:** `{ permitted, code, reason, requiresHumanApproval }`.
**Expected behavior - checks run in this order, first failure wins:**
1. Per-asset ceiling (only if the destination has an explicit entry - never applied to a stablecoin destination)
2. Aggregate equity ceiling (only if the destination is itself an equity ticker)
3. Safety score vs. mandate floor
4. Post-trade liquidity vs. mandate floor (must correctly add USDC when USDC is the destination, subtract when it's the source - not just subtract)
5. Daily spend cap
6. If all pass: does the amount cross the human-approval threshold?

Every rejection code must be specific enough that the Treasurer's revision step can act on it without re-deriving what went wrong (`CAP_001`, `RISK_002`, `LIQ_003`, `SPEND_004`).

### 4. Executor - act

**Input:** an approved Intent.
**Output:** a transaction reference (`txHash` or equivalent).
**Expected behavior:** this step must be swappable - a no-op simulator during development, a real chain call once the contract exists. It should never contain policy logic itself; if the Executor has to decide whether something is allowed, that logic leaked out of the Policy Officer and needs to move back.

### Emergency override

Runs **before** the normal policy check, every attempt, not just the first: if depeg risk on either side of the trade exceeds the mandate's critical threshold, the loop freezes immediately regardless of everything else and does not retry. This is the one path that skips the retry loop entirely - a frozen system doesn't get a second attempt in the same run.

## Audit log - exact event sequence

Every run emits a subset of, in this order:

```
ProposalCreated → RiskVerified → PolicyChecked → [ApprovalRequested] →
ApprovalGranted | ApprovalRejected → TradeExecuted
```

with `EmergencyFreeze` short-circuiting everything, and `ProposalCreated` recurring on each retry. This exact sequence is what the frontend's audit timeline renders and what the Solidity contract's events must eventually match - treat it as a shared contract between the three layers, not an implementation detail either one owns alone.

## Expected output per scripted demo beat

| Beat | Setup | Expected outcome |
|---|---|---|
| 1 | $150K AAPL proposal, portfolio already at the 30% equity ceiling | `REJECTED`, code `CAP_001`, no retry - a human decides whether to loosen the mandate |
| Bonus | Same proposal, portfolio starts under the ceiling | `EXECUTED` after one auto-revision - proves the retry loop does real work, not just a single check |
| 2 (loosen) | Mandate ceiling raised to 50%, same $150K proposal | `EXECUTED`, with an `ApprovalRequested` step since $150K crosses the human-approval threshold |
| 3 (adverse event) | Market stress, agent proposes reducing AAPL exposure | `EXECUTED` - de-risking trades must never get blocked by the equity ceiling they're helping satisfy |
| 4 (tighten) | Same de-risking proposal, risk floor raised to 90 | `REJECTED`, code `RISK_002` - proves enforcement is live and continuous, not a one-time gate |

If the swarm's implementation produces different outcomes for these five setups, something in the workflow above has drifted - check the order of checks in the Policy Officer first, that's where both original bugs lived.

## Definition of done

- [x] All four agent functions exist as separably testable units, not one monolithic function
- [x] Every Policy Officer check has a name-matched counterpart planned or built into the Solidity contract
- [x] The five expected outcomes above reproduce exactly when run
- [x] Executor is swappable without touching Treasurer/Risk Officer/Policy Officer code
- [x] Audit log sequence matches what the frontend timeline expects, with no missing or reordered events
- [x] No placeholder risk signal is presented as live data without the label `creance.md`'s risk-data-boundary section requires

## Current implementation evidence

- `src/agenticLoop.js` contains four separable functions: Treasurer, Risk Officer, Policy Officer, and Executor.
- `src/demo.js` runs the five scripted beats and prints the ordered audit events.
- `test/agenticLoop.test.js` covers the five scripted outcomes and the hard safety edge cases.
- `contracts/CreancePolicy.sol` implements the ordered on-chain counterparts and was compile-checked locally with Solidity `0.8.24`; deployment and chain integration remain a release gate.
- `src/main.js` renders the same ordered events in the browser, including `AWAITING_HUMAN` before approval and `TradeExecuted` after approval.
