# Security Policy

**Protocol:** NORN (Network for Obligation Routing & Netting)  
**Status:** Mainnet-Ready Candidate  

---

## 1. Security Architecture & Invariants

NORN is built with mathematical and cryptographic invariants enforced at the smart contract, off-chain solver, and client library levels:

### 1.1 Invariant Guarantees
1. **Multilateral Conservation:** In every cleared batch, the net sum across all participants must balance to zero: `SUM(net_i) == 0`. The contract rejects any batch failing this check.
2. **Replay & Malleability Protection:** Every obligation is signed using EIP-712 typed structured data incorporating a unique domain separator (`name`, `version`, `chainId`, `verifyingContract`), an incrementing participant nonce, and an explicit expiration timestamp.
3. **Liquidity Reservation Floor:** SettlementController enforces that participants maintain adequate reserves before locking transfers, preventing overdrafts and cascading insolvencies.
4. **Zero-Haircut Guarantee:** Nominal obligations are settled at full par value. In stressed regimes, lower-priority obligations are deferred rather than taking involuntary haircuts.
5. **Emergency Circuit-Breaker:** The `EmergencyController` contract permits authorized multisig guardians or autonomous risk sentinels to freeze individual compromised nodes or halt global settlement during market anomalies.

---

## 2. In-Scope Components

The following codebase components are covered under this security policy:

- **EVM Core Contracts (`contracts/`):**
  - `ClearingHouse.sol`
  - `ObligationRegistry.sol`
  - `LiquidityManager.sol`
  - `SettlementController.sol`
  - `RiskController.sol`
  - `EmergencyController.sol`
  - `NORNParticipantRegistry.sol`
- **Stylus Rust Acceleration Modules (`stylus/`):**
  - `risk-functions` (WAD math, reserve ratio bounds, shortfall detection)
  - `stress-engine` (shock simulation, priority cascade pruning)
- **Clearing & Netting Engine (`packages/clearing`):**
  - Bilateral netting, cycle cancellation, and Merkle tree generation

---

## 3. Reporting a Vulnerability

We welcome coordinated vulnerability disclosures from security researchers, auditors, and community developers.

### Reporting Guidelines
- **Contact:** Open a private security advisory through the GitHub repository security tab, or email `security@norn.network`.
- **Information to Include:**
  - Clear description of the vulnerability and its potential impact.
  - Proof of concept (PoC) code or steps to reproduce the issue.
  - Affected smart contracts, packages, or services.
  - Any proposed remediations.

### Scope & Expectations
- Please allow up to 48 hours for an initial confirmation response.
- We ask researchers to practice responsible disclosure and refrain from exploiting vulnerabilities on live networks, public testnets, or against user accounts.
- Public disclosure should occur only after a fix has been prepared and deployed across supported networks.

---

## 4. Best Practices for Machine Agent Operators

1. **Private Key Isolation:** Always use isolated signer keys for automated machine agents. Never reuse primary treasury keys for autonomous micro-payment loops.
2. **Reserve Limits:** Set conservative deposit caps on `LiquidityManager` to bound maximum counterparty exposure during unexpected network shocks.
3. **Expiry Deadlines:** Ensure signed EIP-712 obligations specify reasonable expiration timestamps to avoid lingering commitments in volatile markets.
4. **Oracle Staleness Guards:** If utilizing tokenized equity collateral on Robinhood Chain, ensure price feeds are monitored with staleness thresholds (default: 300 seconds).
