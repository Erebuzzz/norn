# Arbitrum Open House Singapore — Project Gallery Intel

**Source:** [Hackathon page](https://arbitrum-singapore.hackquest.io/buildathons/Arbitrum-Open-House-Singapore-Online-Buildathon) → **Project Gallery** (also mirrored at `hackquest.io/hackathons/...`)  
**Scraped:** 2026-09-18 via browser (gallery cards + individual project pages)  
**Prize pool context:** Overall $70K USDC · Promising Products $15K · Grants $30K · Top 3 → Founder House Singapore  
**Participants shown:** 799+ registered; **~12 projects** visible in gallery at scrape time (pagination UI showed 1–3 but Next did not change the set)

---

## Executive summary

The live gallery is still early and **heavily skewed to Robinhood Chain / tokenized-stock (RWA) surfaces**: lending against stock tokens, RWA safety checks, stock-token intelligence, meme-backed-by-RWA launchpads, and Web2→onchain distribution of tokenized assets. **AI** shows up as agent marketplaces or “launch intelligence,” not as enforceable treasury control. **Gaming** has one unusually polished mainnet product (ETour). **Pendle / structured yield / treasury policy planes are effectively absent.**

**Strongest judge-facing pattern:** live deploy (Arb One or Robinhood mainnet/testnet) + verified contracts + honest limitations + a crisp “why Arbitrum / Robinhood Chain” sentence.  
**Weak pattern:** multi-buzzword pitches (DeFi+RWA+AI+escrow+auction) without a single undeniable onchain demo moment.

**Creance white space is real:** nobody in the gallery is shipping *policy-bound autonomous capital movement* (mandate → propose → risk → enforce → audit). Closest adjacency is **RWA Guard** (read-only safety oracle) and **BotHire** (agents that pay each other), not a treasury control plane.

---

## Catalog (gallery submissions)

| Project | Short description | Sectors (as tagged / clear) | Stack signals | Demo / repo |
|---|---|---|---|---|
| **Gage.cash** | Fixed-cost P2P lending vs stocks/memes/ETH; no liquidation before expiry; Earn pools in USDG. **Live Robinhood Chain mainnet.** | RWA, DeFi | Solidity, Next/React, Foundry, TS | [github.com/DebenLabs/gage-protocol](https://github.com/DebenLabs/gage-protocol) · gage.cash |
| **INSTANT WIN** | Distribution rail for tokenized assets: email/phone in, invisible wallets, Chainlink VRF draws, verified Arb One contracts. | SocialFi, Infra, RWA | Solidity/Foundry, Chainlink VRF/CRE, React/viem, Supabase | [GitHub](https://github.com/AndersonTeodoro-hub/INSTANT-WIN-Raffle-v2.1) · Arb addresses in writeup |
| **ETour** | Game-agnostic 100% onchain tournament protocol (lobbies→brackets→payouts); TicTacToe/Connect4/Chess live. | Gaming | Solidity, React | [etour.games](https://etour.games/) · [GitHub](https://github.com/KarimChukfeh/e-tour) |
| **BotHire** | AI agents hire each other; gasless USDT/USDC settlement (BotPay); Arb One deploy + traction stats. | AI | Solidity | [bothire.io](https://www.bothire.io/) · [GitHub org](https://github.com/BotHireAgent) · demo video link broken on page |
| **RWA Guard** | Stateless deny-by-default `isSafeToTrade` view for tokenized RWAs (pause, blocklist, feed staleness, impl drift…). | Infra, RWA, DeFi | Solidity | [demo web](https://franciseliang99-dot.github.io/rwa-guard/web/) · [GitHub](https://github.com/franciseliang99-dot/rwa-guard) · RH testnet + Arb Sepolia |
| **JUJING** | Market intel + verification / “Stock Token Passports” for tokenized equities; evidence registry on Arb Sepolia. | RWA, Infra | Node, Ethers, Solidity, Chainlink | [jujingwhale.xyz](https://jujingwhale.xyz/) · [GitHub](https://github.com/shadehook/jujing) |
| **LaunchLens** | Explainable launch risk scoring for Robinhood Chain; Signal Registry with evidence hash. | AI, Infra | Solidity, Web3 | [GitHub](https://github.com/BigLateef/LaunchLens) · RH testnet |
| **Meme-World Assets (MWA)** | Launchpad: lock stock tokens → mint MEME → timed buyback/burn; hybrid EVM + Stylus. | RWA | Solidity, Rust/Stylus, Python | [mafsc.github.io/mwa](https://mafsc.github.io/mwa/) · [GitHub](https://github.com/MAFSC/mwa) |
| **CommitCircle** | Group commitment vaults: lock USDC, unlock by quorum nomination or deadline; 1:1 accounting. | (social savings / DeFi-ish) | Solidity, Hardhat, React, USDC | [git.sr.ht/~circleforge/…](https://git.sr.ht/~circleforge/hackathon-arbitrum) · Arb Sepolia |
| **sakartvelo exchange** | Onchain “privatization” primary-market simulation (closed-loop INVEST → auction → governance → unlock). | DeFi, DAO, RWA | React, Solidity, Ethers | [GitHub](https://github.com/amiran11/sakartvelo-exchange) · Arb One verified |
| **Trestle-DeFi** | Gig marketplace + escrow + Dutch auction + fractional RWA + AI matching/dispute nodes. | DeFi, RWA, AI | React/Next, Solidity, AI/Llama | [GitHub](https://github.com/Trestle-DeFi/trestle-testnet) · Arb/Base/Polygon Sepolia |
| **Latheon** | Selective-disclosure privacy (prove tx to one auditor without spend power); ported cycle to Arb Sepolia. | Infra, DeFi | Solidity, circom, zk | [GitHub](https://github.com/latheon-network/Latheon) |
| **SudoStake** *(edge / thin)* | “Use staked L1 tokens as collateral to borrow USDC.” Sparse page; earlier link pointed at NEAR contracts. Treat as incomplete / low competitive signal for this gallery. | DeFi? | unclear | thin listing |

Card numbers (e.g. 8827, 8063) appear to be **engagement counters**, not judge scores.

---

## Theme clusters

| Cluster | Projects | Saturation |
|---|---|---|
| **Robinhood / stock-token RWA** | Gage, RWA Guard, JUJING, LaunchLens, MWA, INSTANT WIN (distribution), Trestle (claims) | **Very high** |
| **DeFi primitives (lend / vault / escrow)** | Gage, CommitCircle, Trestle, MWA | High |
| **AI agents / AI signals** | BotHire, LaunchLens, Trestle | Medium (surface-level vs deep autonomy) |
| **Infra / safety / privacy** | RWA Guard, Latheon, JUJING | Medium |
| **Gaming** | ETour | Low count, high polish |
| **Social / distribution** | INSTANT WIN, CommitCircle | Medium |
| **DAO / novel mechanism design** | sakartvelo | Low |
| **Pendle / PT-YT / structured yield** | — | **Empty** |
| **Treasury OS / policy-enforced agent execution** | — | **Empty (Creance lane)** |
| **Stylus-first** | MWA (hybrid only) | Underused |

---

## Strong vs weak for judges

### Looks strong
- **Gage.cash** — mainnet on Robinhood Chain, clear product, immutable-engine narrative, progress log since Buildathon start.
- **INSTANT WIN** — production-grade writeup, verified Arb One addresses, audits/tests claimed, solves a real distribution problem for tokenized assets.
- **ETour** — live site, multiple games, 500+ tests, Arbitrum-gas thesis is crisp.
- **RWA Guard** — narrow, composable, deny-by-default, honest AI-disclosure + limitations; easy for judges to understand in 60s.
- **JUJING** — real product URL + instrument-verification depth (complementary to trading apps).
- **sakartvelo** — novelty + verified contracts + unusually honest “this is a simulation / gaps” section (trust signal).

### Looks weaker / risky
- **Trestle-DeFi** — kitchen-sink pitch; hard to verify one killer demo; AI claims feel bolted on.
- **BotHire** — interesting traction, but **demo video broken** on the project page; multi-chain dilution vs Arb-native story.
- **LaunchLens / MWA** — solid direction, still MVP/testnet; need clearer live “aha” for judges.
- **SudoStake** — incomplete listing signal.
- Anything that only **ports an existing L1 app** without Arb/RH-specific value (Latheon is honest about gas findings; still more “port” than “native”).

### Pendle integration depth
**None observed** in gallery copy, tags, or repos surfaced. Yield tokenization / PT-YT strategies are white space, not a contested track yet.

### Arbitrum-native fit (what judges will reward)
1. Robinhood Chain stock-token mechanics (Gage, Guard, JUJING, MWA).  
2. High-frequency onchain UX that needs cheap gas (ETour).  
3. Verified Arb One production (INSTANT WIN, BotHire, ETour, sakartvelo).  
4. Stylus novelty (only MWA shows hybrid Rust/WASM clearly).

---

## Saturation vs white space

**Overdone (expect more by deadline):**
- “Something with Robinhood Stock Tokens”
- Generic RWA launchpad / collateral narratives
- AI agent marketplace / AI scoring without custody of a mandate
- Multi-chain “we also deployed on Arb Sepolia” migrations

**White space (high leverage for Creance):**
1. **Enforceable treasury mandate / control plane** for autonomous agents (policy contract as product).  
2. **Intent → policy → execution separation** with onchain audit trail (not chat-theater).  
3. **Pendle / structured yield** under policy constraints (if pursued, be first with depth).  
4. **Composable safety**: consume RWA Guard-like signals inside a spend/rebalance authority layer.  
5. **Stylus** for policy/risk math if it improves demo credibility.  
6. Avoid framing as “AI hedge fund / smart allocator” (already crowded conceptually by BotHire + Trestle + LaunchLens energy).

---

## Competitive map vs Creance (Autonomous Treasury Cell)

| Competitor type | Example | Overlap with Creance | Differentiation |
|---|---|---|---|
| Safety oracle | RWA Guard | Shared “don’t trust the token blindly” | They are **read-only**; Creance **gates execution** |
| AI agent economy | BotHire | Agents + money | They optimize **agent labor markets**; Creance governs **treasury authority** |
| Stock-token DeFi | Gage, MWA | Same asset universe | They are **products using capital**; Creance is **how capital is allowed to move** |
| Intel layer | JUJING, LaunchLens | Risk context | They inform; Creance **enforces** |

---

## 5 concrete implications for Creance winning

1. **Never pitch as “AI that trades stock tokens.”** Judges will file you next to BotHire/Trestle/LaunchLens. Pitch **policy contract + decision trail**: “capital moves only when the mandate agrees.”
2. **Match the live-deploy bar set by Gage / INSTANT WIN / ETour.** A blocked intent and an approved intent on Robinhood Chain (or Arb) with explorer links beats a perfect architecture diagram.
3. **Treat RWA Guard as ally narrative, not rival.** Show Creance calling (or mirroring) deny-by-default checks inside policy before spend/rebalance.
4. **Leave Pendle empty or own it deliberately.** If you touch yield, make it **policy-capped PT/YT exposure**, not another yield farm UI. Depth > name-drop.
5. **Demo polish = one composition, one failure, one success.** Mandate health → Intent 024 BLOCKED (ceiling) → corrected intent PASS → audit events. Hide multi-agent chat; show enforcement. Submission copy should be as concrete as INSTANT WIN / sakartvelo (addresses, tests, known limits).

---

## Method notes / caveats

- Gallery set can grow quickly before Oct 4 deadline; re-scrape weekly.  
- Pagination controls (1/2/3, Next) did not yield additional distinct cards during this pass; treat **~12** as the observed live set, not a hard total.  
- SudoStake appeared intermittently in card href lists; page content was thin.  
- Raw scrape dump: `workflow/_gallery_raw.json` (optional; for agent continuity).

---

## Next agent actions

- [ ] Re-open Project Gallery closer to submission and diff new entrants.  
- [ ] Watch for any Pendle / treasury / Stylus-policy clones.  
- [ ] Align Creance README + HackQuest listing tone with INSTANT WIN / Gage concreteness.  
- [ ] Decide whether to explicitly cite composability with RWA Guard-style checks in the pitch.
