# Creance - Design Agentic Loop (UI/Design)

Same shape as `AGENTIC_LOOP_SPEC.md`, applied to interface work instead of treasury decisions: a proposed design change never ships until an independent gate clears it. Fitting, since Creance's entire pitch is "propose, then enforce" - the process that builds the product should work the same way the product itself works.

Reference for tokens and constraints already locked: `DESIGN_MODE.md`. This spec does not redefine those tokens, it defines the loop that keeps every future screen honest to them.

## Objective

Given a UI/component brief, produce an implementation that (a) serves the actual decision task, (b) matches the existing token system exactly, (c) contains zero generic-AI-interface clichés, and (d) passes accessibility as a hard gate, not a score. No proposal ships on visual appeal alone.

## Roles

| Role | Treasury-loop equivalent | Job |
|---|---|---|
| **Art Director** | Treasurer | Proposes or revises a screen/component |
| **Critic** | Risk Officer | Scores the proposal on the 5-pillar rubric, screens for anti-patterns |
| **Accessibility Gate** | Policy Officer | Deterministic pass/fail checks, no averaging, no partial credit |
| **Implementer** | Executor | Turns an approved proposal into real code in the existing stack |

## Workflow

```
propose (Art Director)
    │
    ▼
score + anti-pattern scan (Critic)
    │
    ├─ any anti-pattern hard-fail ──► REJECT, code AP_xxx, stop (no retry math needed - name it, fix it)
    │
    ├─ rubric score below threshold ──► REJECT, code SCORE_001
    │        │                              │
    │        │                              ▼
    │        │                   retries left? ─yes─► Art Director revises the specific weakest link ─► loop back to score
    │        │                              │no
    │        │                              ▼
    │        │                       escalate to human review
    │
    ▼ (score passes)
accessibility gate (deterministic)
    │
    ├─ any single check fails ──► REJECT, code A11Y_xxx, no retry budget consumed - this is a fix, not a redesign
    │
    ▼ (all pass)
implement (Implementer) ──► ship
```

The accessibility gate runs **after** the rubric score, not merged into it - a beautiful component that fails contrast is not "4.2/5 with an asterisk," it's blocked, full stop. Same logic as the treasury's liquidity floor: no amount of upside on other dimensions buys back a hard constraint.

## Step by step

### 1. Art Director - propose

**Input:** the component/screen brief, `DESIGN_MODE.md` tokens, Pixasso's Understand → Research → Synthesize → Explain stages done inline (not skipped).
**Output:** a concrete proposal (markup/CSS/JS or a diff) plus a one-paragraph rationale tying every non-obvious choice to a token or a functional need - not "this looks modern."
**Expected behavior:** must not introduce a new color, font, spacing value, or motion primitive outside `DESIGN_MODE.md`'s token table without explicitly flagging it as a proposed token-system change requiring separate sign-off, not slipping it in as a one-off. On retry after rejection, must address the specific weakest link the Critic named - not restyle unrelated parts of the same screen.

### 2. Critic - score and screen

**Input:** the proposal, `DESIGN_MODE.md`, the anti-pattern list below.
**Output:** a filled rubric scorecard (weights below) plus a named weakest link plus an anti-pattern diagnosis, in this exact format:

```
Overall Craft Score: X.X / 5.0
Weakest Link: [the one thing most undermining trust or usability]
Anti-Pattern Diagnosis: [name it / why it hurts / the specific replacement]
```

**Rubric (weighted, 1-5 each):**
- UX & Information Architecture - 25% - is the decision task (approve/reject/why) legible in under 3 seconds?
- Visual Craft - 25% - typography discipline, spacing on the 4/8/12/16/24/32/48/64px scale, color used semantically not decoratively
- Interaction & Affordance - 20% - are permitted/blocked states, hover/focus/active states, and disabled logic immediately readable?
- Motion & Choreography - 15% - does every animation communicate state change or hierarchy? (150-350ms, `cubic-bezier(0.16, 1, 0.3, 1)` per `DESIGN_MODE.md`)
- Technical & Performance - 15% - semantic HTML, compositor-only animated properties, no unnecessary dependency weight

**Expected behavior - hard fails, independent of numeric score:**
Any of the following is an automatic reject regardless of how the weighted score comes out, exactly like a single breached ceiling blocks a trade no matter how good the rest of the portfolio looks:
- `AP_001` - gradient/glassmorphism used decoratively, or glass applied to a policy-evidence surface (`DESIGN_MODE.md` already rules this out explicitly: evidence cards stay opaque)
- `AP_002` - floating pill badges, icon-row-of-three, generic outline-icon flooding
- `AP_003` - motion with no comprehension purpose (universal scroll-fade-in, cursor-following blobs, magnetic-pull buttons applied reflexively)
- `AP_004` - low-contrast dark mode with muddy gray text where the AMOLED variant calls for true black and high-contrast type

### 3. Accessibility Gate - deterministic, no score

**Input:** the proposal or its implementation.
**Output:** pass/fail per check, each independently blocking:
- `A11Y_001` - contrast below 4.5:1 body copy, 3:1 large type/interactive borders
- `A11Y_002` - keyboard tab order broken, no visible custom focus ring, or Enter/Space/Escape not wired
- `A11Y_003` - touch targets under 44×44 CSS px
- `A11Y_004` - no `prefers-reduced-motion` fallback, or reduced-motion users lose functional information (not just the animation)

**Expected behavior:** these never get traded off against rubric score. A 4.8/5.0 component with `A11Y_001` still doesn't ship.

### 4. Implementer - build

**Input:** an approved proposal.
**Output:** working code in the existing stack - vanilla HTML/CSS/JS on Vite, matching `DESIGN_MODE.md` tokens by exact value (hex codes, font names, spacing scale, easing curve), not an approximation.
**Expected behavior:** does not introduce a new dependency (component library, animation runtime, icon set) that wasn't named at the proposal stage. Implementation is where approved decisions get built, not where new technical decisions get made.

## Expected output on specific Creance scenarios

| Proposal | Verdict | Why |
|---|---|---|
| Mandate ceiling slider using the existing paper/editorial surface tokens, range input with visible focus ring, plain-language rejection reason inline | **PASS** | Matches `DESIGN_MODE.md`'s interaction contract exactly: blocked state explains the violated constraint in plain language |
| "Connect wallet" button with a purple-to-cyan gradient and a floating "NEW" pill badge | **REJECT - AP_001, AP_002** | Exactly the anti-pattern list `DESIGN_MODE.md` already rules out; also contradicts the stated "calm, exacting operations room" thesis |
| Audit trail timeline with scroll-fade-in applied to every row on load | **REJECT - AP_003** | Universal scroll-reveal with no comprehension purpose - `DESIGN_MODE.md` specifies new events use a short opacity/translate reveal to show chronology, not decorative entrance animation on the whole list |
| Rebalance intent card with a glass blur treatment applied across the risk figures | **REJECT - AP_001** | Violates the project's own explicit rule, not just the generic list: "policy evidence cards remain opaque so blur never reduces legibility" |
| Approve button that disables itself post-click, with a decision-event appended to the audit list | **PASS** | Matches the existing state-safety behavior already verified in `code_review.md` |

## Current implementation scorecard

Overall Craft Score: 4.6 / 5.0
Weakest Link: Risk-source provenance is visible in the audit detail, but a production build still needs dedicated source badges for each signal.
Anti-Pattern Diagnosis: None active. Glass and translucency are limited to navigation and action chrome; evidence panels stay opaque, and motion is limited to the newest audit event to communicate chronology.

Accessibility Gate: PASS

- `A11Y_001` - token review keeps body and state text high contrast in both themes; evidence surfaces remain opaque.
- `A11Y_002` - native buttons and range input preserve keyboard order, with a visible focus ring.
- `A11Y_003` - interactive controls use a 44px minimum height.
- `A11Y_004` - reduced-motion CSS removes translation and delay while preserving every state update.

Implementation evidence: the local browser run verified blocked, approval-required, and executed states, including the ordered `ProposalCreated`, `RiskVerified`, `PolicyChecked`, `ApprovalRequested`, `ApprovalGranted`, and `TradeExecuted` events.

## Definition of done

- [x] Every shipped screen has a filled rubric scorecard on record, not just a subjective "looks good"
- [x] Zero anti-pattern hard-fails at ship time - no exceptions for "just this once, we're short on time"
- [x] Accessibility gate passes completely; no partial credit, no score trade-off
- [x] No token introduced outside `DESIGN_MODE.md` without an explicit, separately-approved token-update entry
- [x] Implementer's output matches the approved proposal exactly - no new dependency, color, or animation introduced silently during the build step
