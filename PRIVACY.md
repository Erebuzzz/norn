# Privacy Policy

**Effective Date:** October 2, 2026  
**Protocol:** NORN (Network for Obligation Routing & Netting)

---

## 1. Overview & Core Philosophy

NORN is a decentralized clearing and multilateral netting protocol engineered for autonomous machine agents, micro-services, and smart contract accounts. 

Our fundamental privacy design principle is simple: **We do not collect, process, or store Personally Identifiable Information (PII).**

NORN operates exclusively on public cryptographic keys, signed structured messages, and blockchain transactions. Autonomous software agents interact programmatically without human identity credentials.

---

## 2. Information Handled by the Protocol

### 2.1 Cryptographic Identifiers & Obligations
When participating in NORN clearing batches, the network processes:
- **Public Ethereum Addresses:** Public cryptographic addresses identifying participating agents and service providers.
- **EIP-712 Signed Obligations:** Off-chain cryptographic commitments containing payment parameters (payer, payee, asset address, amount, nonce, expiration deadline, and priority flag).
- **Batch State Roots:** Cryptographic Merkle roots committed to public smart contracts for verification and dispute resolution.

### 2.2 Client-Side Application State
The visual applications (`apps/arena` and `apps/web`) run locally in your browser:
- **Local Storage:** Used solely to persist client preferences (such as audio telemetry toggle state).
- **Ephemeral Session Data:** In-memory simulation state, zoom/pan coordinates, and timeline scrubber positions. This data remains on your local device and is never transmitted to external telemetry servers.

---

## 3. Information We Never Collect

NORN does not collect:
- Real names, physical addresses, or phone numbers.
- Email addresses or personal credentials.
- Financial banking accounts, credit card numbers, or government identifiers.
- Behavioral tracking cookies, third-party analytics pixels, or advertising identifiers.

---

## 4. Blockchain Transparency & Public Ledgers

When multilateral netting batches are finalized, settlement transactions are submitted to public distributed ledgers (including Arbitrum Sepolia and Robinhood Chain).

Transactions on public blockchains are inherently transparent, immutable, and globally accessible. Anyone can inspect transaction hashes, block numbers, transferred token quantities, and participating contract addresses on public blockchain explorers.

---

## 5. Security & Machine Integrity

All communication between autonomous agents and NORN service providers uses secure cryptographic signatures and transport encryption (HTTPS / WSS). Because no private keys are ever shared with or held by NORN, users and agent operators retain exclusive control over their funds.

---

## 6. Open Source Code & Inquiries

NORN is open-source software provided under the MIT License. For inquiries regarding this policy or protocol operation, consult the official repository:
- Repository: [https://github.com/Erebuzzz/creance](https://github.com/Erebuzzz/creance)
- Documentation: [docs/](file:///D:/Creance/docs/)
