# RecoverOS - Master Data Model Specification

## 1. Core Entity Relationship Taxonomy

```
+---------------+           +---------------+           +--------------------+
|    Tenant     |1 ------- *|     User      |           |     AuditLog       |
+---------------+           +---------------+           +--------------------+
        |1                          |1                             |*
        |                           |                              |
        *                           *                              *
+---------------+           +---------------+           +--------------------+
|   Supplier    |1 ------- *|   Contract    |1 ------- *|    ContractRule    |
+---------------+           +---------------+           +--------------------+
        |1
        |
        *
+---------------+           +---------------+           +--------------------+
|    Invoice    |* ------- 1| PurchaseOrder |           |  PaymentTransaction|
+---------------+           +---------------+           +--------------------+
        |1                          |                           |
        +-------------+-------------+                           |
                      |                                         |
                      *                                         *
               +---------------+                         +---------------+
               |  Opportunity  |1 --------------------- *|   Evidence    |
               +---------------+                         +---------------+
                      |1                                        |
                      |                                         |
                      *                                         *
               +---------------+                         +---------------+
               |     Claim     |1 --------------------- 1| VerifiedRecovery|
               +---------------+                         +---------------+
```

---

## 2. Entity Specifications

*   **Tenant**: Logical root container. Contains `id`, `name`, `slug`, `mode` (`DEMO` | `PRODUCTION`), and `settings` (thresholds, currency).
*   **User**: Team member. Contains `id`, `tenantId`, `email`, `role` (`Owner`, `Admin`, `Finance Manager`, `Analyst`, `Viewer`, `Auditor`, `AI Agent`), and `status`.
*   **Supplier**: Vendor profile with `taxId`, `paymentTerms` (e.g. `2/10 Net 30`), `totalSpend`, `totalRecovered`.
*   **Contract & ContractRule**: Master procurement framework with structured rules (`VOLUME_REBATE`, `EARLY_PAYMENT_DISCOUNT`, `SLA_PENALTY`).
*   **Invoice & PurchaseOrder**: Line item data models with unit prices, quantities, and match status.
*   **Opportunity**: Discovered recoverable variance with `expectedAmount`, `actualAmount`, `recoverableAmount`, `confidence`, and `evidenceList`.
*   **Claim**: Formal recovery demand with workflow status, human approval metadata, draft notice, and negotiation trail.
*   **VerifiedRecovery**: Cash settlement record referencing certified credit memo or bank deposit reference.
*   **AuditLog**: Tamper-evident record of actor, role, action, target, previous state, new state, reason, agent, tool, and outcome.
