# RecoverOS - System Architecture & Engineering Specification

## 1. High-Level Architecture Overview

RecoverOS is architected as an Autonomous Enterprise Revenue Recovery Platform designed around four immutable architectural pillars:

1.  **Multi-Tenant Logical Isolation**: Every tenant owns a distinct data partition. Access across tenant boundaries is strictly guarded and audited.
2.  **Deterministic Mathematical Truth**: Language models (LLMs) are strictly forbidden from performing financial calculations. All math is executed by code-based decimal arithmetic with zero floating-point error.
3.  **Untrusted External Data Boundary**: Invoices, contracts, emails, and carrier bills are quarantined as untrusted data and wrapped in structural boundaries to neutralize prompt injection attacks.
4.  **Verified Settlement Lifecycle**: No recovery is counted as successful upon dispatching a notice; success is defined solely when funds are verifiably deposited or a binding credit memo is confirmed.

---

## 2. Component Diagram

```
+---------------------------------------------------------------------------------+
|                                USER INTERFACE                                   |
|   React SPA (Vite + Tailwind CSS v4) | Bilingual EN (LTR) & AR (RTL)            |
|   Public Landing Pages & Enterprise Dashboard / AI Command Center               |
+---------------------------------------------------------------------------------+
                                      |
                                  REST APIs
                                      |
+---------------------------------------------------------------------------------+
|                           API & INGESTION LAYER                                 |
|   Express.js Server (/api/v1) | RBAC Guard | Prompt Defense Sanitizer           |
+---------------------------------------------------------------------------------+
                                      |
     +--------------------------------+--------------------------------+
     |                                                                 |
+----+--------------------------------+   +----------------------------+----+
|      MULTI-AGENT ORCHESTRATION      |   |  DETERMINISTIC MATH ENGINE      |
|  - Orchestrator Agent               |   |  - DecimalMath (Scaled Cent)    |
|  - Discovery Agent (Ledger Scan)    |   |  - 3-Way & 4-Way Matcher        |
|  - Contract Agent (Clause Parser)   |   |  - Early Discount Verifier      |
|  - Invoice Agent (Line Item Match)  |   |  - Tiered Volume Rebate Engine  |
|  - Freight Agent (Tariff Audit)     |   |  - Duplicate Payment Detector   |
|  - Evidence Agent (Dossier Packager)|   |  - Multi-Currency Normalizer    |
|  - Verification Agent (Confidence)  |   +---------------------------------+
|  - Claim Agent (Notice Drafter)     |
|  - Negotiation Agent (Vendor Reply) |
|  - Recovery Agent (Deposit Verifier)|
+-------------------------------------+
                                      |
+---------------------------------------------------------------------------------+
|                         ISOLATED DATA PERSISTENCE                               |
|   Multi-Tenant Store | Tamper-Evident Audit Ledger | Document Vault             |
+---------------------------------------------------------------------------------+
```

---

## 3. Human Approval Policy Engine

RecoverOS enforces configurable human-in-the-loop gates:
*   **Tier 1 (< $500)**: Autonomous dispatch eligible if mathematical confidence $\ge 90\%$.
*   **Tier 2 ($500 – $5,000)**: Autonomous dispatch only if strict evidence completeness is met; otherwise flagged for Analyst review.
*   **Tier 3 (> $5,000)**: Mandatory Finance Manager or CFO sign-off prior to dispatch.
*   **Hard Boundaries (Never Autonomous)**: Bank disbursement transfers, binding legal dispute compromises, and contract term amendments always require explicit human authorization.
