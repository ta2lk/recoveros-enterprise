# RecoverOS - AI Multi-Agent Architecture

## 1. Multi-Agent System Roles & Tool Scopes

Instead of relying on a single monolithic agent, RecoverOS delegates recovery operations across 12 specialized autonomous agents:

1.  **Orchestrator Agent**: Manages the end-to-end recovery pipeline, checks human approval policies, and coordinates tasks.
2.  **Discovery Agent**: Scans accounts payable transactions and vendor ledgers to identify anomaly signals.
3.  **Contract Agent**: Parses supplier agreements to identify volume rebate tiers, payment terms, and SLA penalty clauses.
4.  **Invoice Agent**: Executes 3-way line item matching across purchase orders, vendor invoices, and delivery receipts.
5.  **Freight Agent**: Audits bills of lading, fuel surcharge indexing, dimensional weight tariffs, and unauthorized accessorial fees.
6.  **Evidence Agent**: Gathers incontrovertible audit artifacts, document excerpts, and transaction IDs into an audit dossier.
7.  **Calculation Agent**: Runs deterministic code-based math to compute exact recoverable differences down to the cent.
8.  **Verification Agent**: Audits evidence completeness and assigns statistical confidence before claim packaging.
9.  **Claim Agent**: Drafts itemized recovery notices with contractual references within pre-approved financial limits ($500).
10. **Negotiation Agent**: Evaluates vendor responses, drafts clarifications, and escalates genuine disputes to human operators.
11. **Recovery Agent**: Verifies settlement proofs (formal credit memos or bank wire transactions) before logging a verified recovery.
12. **Learning Agent**: Analyzes historical settlement outcomes to refine tolerance thresholds and reduce false positive rates.

---

## 2. Hard Constitutional Invariants for AI Agents

*   **Financial Transfer Prohibition**: No agent has write access to banking rails or can initiate disbursement transfers.
*   **Contract Modification Prohibition**: Agents cannot amend, alter, or sign binding legal contracts.
*   **Audit Immutability**: Agents cannot delete or modify historical audit log records.
*   **Zero-Hallucination Policy**: If evidence is missing, the agent outputs `Insufficient Evidence` rather than extrapolating missing numbers.
