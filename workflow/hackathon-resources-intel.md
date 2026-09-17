# Arbitrum Open House Singapore — Resources Intel

**Source priority:** User-pasted Resources section = ground truth. Cross-checked against live HackQuest Resource tab on `https://www.hackquest.io/hackathons/Arbitrum-Open-House-Singapore-Online-Buildathon` (alias on `arbitrum-singapore.hackquest.io/.../Arbitrum-Open-House-Singapore-Online-Buildathon` 404s).

**Product:** Creance / Autonomous Treasury Cell — policy-enforced treasury control plane (AI proposes, contracts enforce). Asset thesis: stablecoins + Stock Tokens; optional Pendle yield leg on Arbitrum where markets exist.

**Event snapshot (page, not Resources paste):** ~$115K total (Overall 70K USDC / Promising Products 15K USDC / Grants 30K USDC). Tech: Solidity + Rust. Online. Submission countdown ~16 days at scrape time. Registration ~14 days left. Discord `#open-house`. Code of conduct PDF: `https://openhouse.arbitrum.io/singapore_version_open_house_buildathon_terms___conditions.pdf`.

---

## 1. Full Resources catalog

### A. Developer Documentation

| Title | URL (verified from Resource tab) | Enables | Creance tag |
|---|---|---|---|
| Developer Docs - Get started with Arbitrum | https://docs.arbitrum.io/welcome/get-started | Chain model, tooling entry | **MUST-USE** |
| Developer Docs - Get started with Robinhood Chain | https://docs.robinhood.com/chain/ | Orbit chain setup, Stock Tokens context | **MUST-USE** (product chain) |
| A gentle introduction to Arbitrum | https://docs.arbitrum.io/welcome/arbitrum-gentle-introduction | L2 mental model for pitch/docs | OPTIONAL |
| Quickstart: Build a decentralized app (Solidity) | https://docs.arbitrum.io/build-decentralized-apps/quickstart-solidity-remix | Fast Solidity deploy path | **MUST-USE** |
| Quickstart: write a smart contract in Rust using Stylus | https://docs.arbitrum.io/stylus/quickstart | Stylus/Rust contracts | SKIP for V1 |
| A gentle introduction: Stylus | https://docs.arbitrum.io/stylus/gentle-introduction | Stylus overview | SKIP for V1 |
| How to run a local Nitro dev node | https://docs.arbitrum.io/run-arbitrum-node/run-nitro-dev-node | Local Nitro | OPTIONAL (only if public RPCs fail) |
| Quickstart: Arbitrum bridge | *(title in Resources; HackQuest href was broken at scrape)* | Bridging L1↔L2 | OPTIONAL; use bridge UI if needed |
| Third party docs: RPCs, Indexers, Oracles, etc. | https://docs.arbitrum.io/for-devs/oracles/oracles-content-map | Oracles/indexers map (Chainlink etc.) | **MUST-USE** for risk/pricing honesty |
| Arbitrum FAQ | https://docs.arbitrum.io/learn-more/faq | Edge-case Q&A | OPTIONAL |
| Get started with ZeroDev | https://docs.zerodev.app/ | AA / smart accounts / session keys | **MUST-USE** (agent execution model) |

Related page link (not in paste titles, verified on Resource tab): bridge UI https://bridge.arbitrum.io/

### B. Faucets

**Ethereum Sepolia (claim ETH, then bridge to Arbitrum Sepolia)**

| URL | Role | Creance tag |
|---|---|---|
| https://sepoliafaucet.com/ | L1 Sepolia ETH | OPTIONAL backup |
| https://arbitrum.faucet.dev/ | Listed under L1 path in paste; also Arb Sepolia direct | Prefer direct Arb path first |
| https://www.infura.io/faucet/sepolia | L1 Sepolia ETH | OPTIONAL backup |
| https://sepolia-faucet.pk910.de/ | L1 Sepolia ETH | OPTIONAL backup |

**Arbitrum Sepolia (claim ETH directly)**

| URL | Role | Creance tag |
|---|---|---|
| https://arbitrum.faucet.dev/ | Arb Sepolia ETH | **MUST-USE** primary |
| https://faucet.quicknode.com/arbitrum/sepolia | Arb Sepolia ETH | Backup |
| https://www.l2faucet.com/arbitrum | Arb Sepolia ETH | Backup |

**Stablecoin / partner faucets**

| URL | Role | Creance tag |
|---|---|---|
| https://faucet.circle.com/ | Arbitrum Sepolia USDC | **MUST-USE** for USDC demo |
| https://faucet.testnet.chain.robinhood.com/ | Robinhood Chain testnet faucet | **MUST-USE** if Stock Token demo on RH testnet |

### C. RPC Endpoints (paste lists Arbitrum One mainnet)

| URL | Network | Creance tag |
|---|---|---|
| https://arb1.arbitrum.io/rpc | Arbitrum One | OPTIONAL (mainnet reads / late deploy) |
| https://rpc.ankr.com/arbitrum | Arbitrum One | OPTIONAL backup |
| https://arbitrum.llamarpc.com | Arbitrum One | OPTIONAL backup |

**Gap:** Resources paste does **not** list Arbitrum Sepolia or Robinhood Chain RPC URLs. Demo env must pull Sepolia/RH RPCs from Arbitrum / Robinhood docs (Get started pages above), not invent them here.

### D. Useful Tools

| Title | URL | Enables | Creance tag |
|---|---|---|---|
| Arbitrum Docs | https://docs.arbitrum.io/ | Hub | **MUST-USE** |
| Arbitrum SDK | https://github.com/OffchainLabs/arbitrum-sdk | Bridging / L2 helpers | OPTIONAL |
| Stylus Docs | https://docs.arbitrum.io/stylus | Rust contracts | SKIP V1 |
| Stylus By Example | https://stylus-by-example.org | Stylus samples | SKIP V1 |
| Stylus CLI | https://github.com/OffchainLabs/cargo-stylus | Deploy Stylus | SKIP V1 |
| Stylus Rust SDK | https://github.com/OffchainLabs/stylus-sdk-rs | Stylus SDK | SKIP V1 |
| OpenZeppelin Rust Contracts | https://github.com/OpenZeppelin/rust-contracts-stylus | Stylus OZ | SKIP V1 |
| OpenZeppelin Solidity Contracts | https://github.com/OpenZeppelin/openzeppelin-contracts | AccessControl, Ownable, Pausable, etc. | **MUST-USE** |

---

## 2. Solidity vs Stylus (explicit recommendation)

**Ship policy + execution in Solidity. Do not build V1 policy contracts in Stylus.**

| Factor | Solidity | Stylus |
|---|---|---|
| Win signal | Strong: OZ patterns judges recognize; matches gallery peers | Novelty only; judges reward working mandate demos more than Rust |
| Time risk | Low if Foundry/Hardhat already in use | High: new toolchain (cargo-stylus), audit surface unfamiliar |
| Pendle | `@pendle/core-v2` interfaces are Solidity | No first-class Pendle Stylus SDK |
| Creance core | Policy caps, allowlists, spend limits map cleanly to Solidity | Unnecessary rewrite |
| When Stylus helps | Never for V1 critical path | Post-hackathon experiment (e.g. exotic risk math) only |

**Judge-facing line (product voice, not hackathon voice):** the enforcement layer is auditable Solidity with OpenZeppelin access control; the agent never holds discretionary keys beyond a scoped smart account.

---

## 3. ZeroDev relevance

**Yes — high relevance to the treasury cell, not a side quest.**

Maps to product architecture:

- Owner never hands the agent an EOA private key.
- Smart account + session keys / permissions ≈ Pay / Rebalance / Hedge roles with spend limits, whitelist, TTL, revoke.
- Gas sponsorship optional for demo UX (intent → policy → tx without faucet friction mid-demo).

**Use for:** executor wallet shape, permission scoping, revoke story in the decision trail.

**Do not use for:** replacing the on-chain policy contract. ZeroDev is the *key/permissions plane*; Creance policy is the *mandate plane*. Both should appear in the demo trail.

Primary doc: https://docs.zerodev.app/

---

## 4. Robinhood Chain: distraction or must-touch?

**Must-touch for Creance’s product thesis; not optional “partner tourism.”**

Reasons:

1. V1 asset universe is Stock Tokens + stablecoins; RH Chain docs/faucet are the official path in Resources.
2. Gallery is crowded with RH / RWA projects — differentiation must be *mandate enforcement*, not “another Stock Token app.”
3. Prior product notes: Overall prize has separate reserved pressure for Robinhood vs Arbitrum slots; deploying only on Arb Sepolia under-sells Stock Token realism.

**Pendle conflict:** Pendle core public deployments include Arbitrum One (`42161-core.json`, router `0x888888888889758F76e7103c6CbF23ABbF58F946`). No RH Chain deployment file in `pendle-core-v2-public/deployments`. So:

| Track | Chain | What to show |
|---|---|---|
| Core demo (policy reject → approve → rebalance Stock Token) | Robinhood Chain testnet | Primary judge path |
| USDC / gas dry-run / Pendle stretch | Arbitrum Sepolia / One | Secondary leg: yield sleeve or mocked Pendle PT within policy caps |

Do not block the 3-minute rejection demo on Pendle liquidity.

---

## 5. Demo env checklist — Arbitrum Sepolia (+ USDC)

Use this for the **policy contract + USDC + agent executor** dry-run. Parallel RH faucet/docs for Stock Token path.

### Wallet / AA

- [ ] Owner wallet (EOA or ZeroDev owner)
- [ ] Executor smart account via ZeroDev (session key: rebalance only, USDC allowlist, daily cap, short TTL)
- [ ] Confirm revoke kills session mid-demo script

### Gas (Arb Sepolia ETH)

1. Try https://arbitrum.faucet.dev/
2. Backup: https://faucet.quicknode.com/arbitrum/sepolia or https://www.l2faucet.com/arbitrum
3. Only if needed: L1 Sepolia faucets → bridge via https://bridge.arbitrum.io/

### USDC

- [ ] https://faucet.circle.com/ → select Arbitrum Sepolia → fund treasury vault + executor as needed

### RPC / chain config

- [ ] Chain: Arbitrum Sepolia (421614) — RPC from Arbitrum docs Get Started (not in Resources paste RPC list)
- [ ] Mainnet RPCs from paste only if doing One reads/deploys later
- [ ] Explorer bookmark for tx hashes in `WHY / WHAT / RISK / POLICY / RESULT / TX`

### Contracts / tooling

- [ ] Solidity quickstart path: https://docs.arbitrum.io/build-decentralized-apps/quickstart-solidity-remix
- [ ] OZ: AccessControl / Ownable2Step / Pausable / ReentrancyGuard as needed
- [ ] Oracle map: https://docs.arbitrum.io/for-devs/oracles/oracles-content-map — label any non-live risk input as heuristic

### Robinhood parallel (Stock Token demo)

- [ ] https://docs.robinhood.com/chain/
- [ ] https://faucet.testnet.chain.robinhood.com/
- [ ] Deploy same policy bytecode pattern; asset allowlist = Stock Tokens + stables

### Pre-demo smoke

- [ ] Intent that **breaches** equity/Stock Token ceiling → on-chain reject + reason code
- [ ] Owner updates mandate → same intent succeeds
- [ ] Adverse rebalance → accept
- [ ] Tighten policy → reject again
- [ ] UI shows decision trail, not chat theater

---

## 6. Docs that matter for Pendle + Arbitrum + agent treasury

| Concern | What to read / use | Realistic short-build integration |
|---|---|---|
| Policy enforcement | Solidity quickstart + OZ Solidity | Custom policy + execution controller |
| Agent keys | ZeroDev docs | Session-keyed executor under policy |
| Pricing honesty | Third-party oracles map | Chainlink where live; no fake feeds |
| Yield sleeve (Pendle) | `pendle-core-v2-public`: `contracts/interfaces` (`IPMarket`, `IPAllActionV3`, `IStandardizedYield`, `IPPrincipalToken`, `IPYieldToken`), npm `@pendle/core-v2`, `deployments/42161-*.json` | Call Router / Market on Arb One or fork; **do not fork Pendle core into the repo**. Cap PT/YT exposure in policy. Skip SY factory / vePENDLE / pt-looping. |
| RH Stock Tokens | Robinhood Chain get-started + faucet | Primary demo assets |
| Stylus | Stylus docs / OZ Rust | Out of scope for V1 |

**Pendle feasibility (short build):** Integrable as a **policy-bounded router call** to existing Arb deployments using published interfaces. Not integrable as a full Pendle fork or RH-native Pendle market. Feasibility: **medium for Arb Sepolia/One stretch; low for RH-native Pendle.**

---

## 7. Max judge-signal resource map (Creance)

| Signal judges feel | Resource to exercise |
|---|---|
| Real Arbitrum deploy | Solidity quickstart + Arb Sepolia faucet + Circle USDC |
| Institutional / Stock Token realism | Robinhood Chain docs + RH faucet |
| Agent safety (not “AI with a key”) | ZeroDev scoped account + on-chain policy reject |
| Contract quality | OpenZeppelin Solidity + clear events |
| Honest risk | Oracles content map; labeled heuristics |
| Optional yield sophistication | Pendle `@pendle/core-v2` on Arb, under same policy caps |
| Avoid time sinks | All Stylus links; local Nitro unless blocked; mainnet RPC until ready |

---

## 8. MUST-USE list (max 8) — for build + strategy agents

1. **Solidity on Arbitrum** — https://docs.arbitrum.io/build-decentralized-apps/quickstart-solidity-remix (+ hub https://docs.arbitrum.io/)
2. **OpenZeppelin Solidity** — https://github.com/OpenZeppelin/openzeppelin-contracts
3. **Robinhood Chain get-started** — https://docs.robinhood.com/chain/ (Stock Token / Orbit path)
4. **ZeroDev** — https://docs.zerodev.app/ (executor smart account, not a substitute for policy)
5. **Arb Sepolia ETH faucet** — https://arbitrum.faucet.dev/ (backups: QuickNode / L2Faucet)
6. **Circle USDC faucet** — https://faucet.circle.com/
7. **Robinhood Chain testnet faucet** — https://faucet.testnet.chain.robinhood.com/
8. **Oracles / third-party map** — https://docs.arbitrum.io/for-devs/oracles/oracles-content-map

**Stretch (not in the 8):** Pendle `@pendle/core-v2` + `deployments/42161-core.json` router on Arbitrum for a yield sleeve inside policy caps.

---

## 9. Win-relevant requirements checklist (condensed)

- [ ] Deploy on an Arbitrum family chain (RH Orbit counts; Arb Sepolia for USDC dry-run)
- [ ] Live on-chain rejection + acceptance under mandate (demo spine)
- [ ] Auditable events / decision trail with tx hashes
- [ ] No agent EOA custody; ZeroDev (or equivalent AA) for scoped execution
- [ ] Solidity + OZ for policy quality signal
- [ ] Stock Token terminology and RH path if claiming RWA/Stock Token realism
- [ ] Submit before countdown; Discord `#open-house` for workshop signal
- [ ] Pitch roadmap for milestone-based prize structure (per prior product notes)
- [ ] Pendle only as optional Arb yield sleeve — never block core demo

---

*Generated for agent handoff. Product-facing copy should stay mandate/control-plane framed; avoid hackathon jargon in UI or public pitch.*
