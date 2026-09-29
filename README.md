# RecoverOS (ري Mour و أوس)
### Autonomous Enterprise Revenue Recovery Platform
> *"Recover money your business is entitled to." / "استرد الأموال التي تستحقها شركتك."*

RecoverOS is an enterprise-grade autonomous revenue recovery and profit audit SaaS platform. It discovers, verifies, calculates, and recovers financial leakage across supplier overpayments, duplicate payments, missed prompt-payment discounts, contract volume rebates, and freight discrepancies.

---

## 1. Core Engineering Principles

*   **Verified Cash Recovery**: We deliver verifiable financial recovery. An opportunity follows the lifecycle `DETECTED -> REVIEWED -> CLAIMED -> SETTLED`. A claim is recognized as "VERIFIED RECOVERY" (Status: `SETTLED`) only when physical settlement proof (bank remittance advice, credit memo, or signed offset) is attached and validated.
*   **Integer Minor Units Truth (Non-Negotiable Rule 1)**: All financial calculations are executed in integer minor units (BigInt cents) using explicit ISO exponents and rounding modes (`Money` / `CalculationEngine`). Money is never represented or computed as a JavaScript floating-point number.
*   **Dated Sourced FX Rates**: Multi-currency transactions are converted strictly using dated, central-bank sourced rate tables (`FxRateTable`) with the conversion as-of date recorded. No hardcoded exchange rates.
*   **Dynamic Evidence Confidence**: Confidence is computed dynamically from evidence completeness (PO, Invoice, Proof of Delivery, Bank Settlement) and document consistency (tax IDs, chronological ordering, amount reconciliation).
*   **Compliance Status**: SOC 2 Type II, ISO 27001, and KMS envelope encryption are *planned* production roadmap milestones (Phase 2/3) and are not claimed as certified in the current phase.
*   **Zero-Pill Enterprise Aesthetic**: Built strictly to enterprise design guidelines with high scannability, tabular numerals (`tabular-nums`), and single-elevation cards.
*   **Complete Bilingualism**: Instant switching between English (LTR) and Arabic (RTL) with domain-authentic financial terminology.

---

## 2. Prerequisites & Quickstart

### Prerequisites
*   Node.js v20+ or v22+
*   npm v10+

### Installation & Run

```bash
# 1. Install dependencies
npm install

# 2. Run the automated test suite
npm test

# 3. Launch local development server
npm run dev
# The application opens on http://localhost:3000
```

---

## 3. Environment Variables (`.env.example`)

```bash
# GEMINI_API_KEY: Used for clause interpretation and courteous claim notice drafting
GEMINI_API_KEY="MY_GEMINI_API_KEY"

# APP_URL: Cloud Run application root URL
APP_URL="http://localhost:3000"
```

---

## 4. Documentation Index

*   [`ARCHITECTURE.md`](ARCHITECTURE.md): Comprehensive system architecture and data flows.
*   [`ARCHITECTURE_DECISIONS.md`](ARCHITECTURE_DECISIONS.md): Architectural Decision Records (ADRs).
*   [`MARKET_RESEARCH.md`](MARKET_RESEARCH.md): Verified industry statistics (IOFM, APQC, Cass, Loop) and sources.
*   [`COMPETITOR_ANALYSIS.md`](COMPETITOR_ANALYSIS.md): Analysis of PRGX, Apex Analytix, SpendMend, and Discover Dollar.
*   [`AI_ARCHITECTURE.md`](AI_ARCHITECTURE.md): Multi-agent specifications and constitutional invariants.
*   [`DATA_MODEL.md`](DATA_MODEL.md): Master entity relationships and data dictionaries.
*   [`API.md`](API.md): REST API v1 endpoints reference.
*   [`SECURITY.md`](SECURITY.md): Tenant isolation, encryption, and prompt injection defenses.
*   [`LEGAL_NOTES.md`](LEGAL_NOTES.md): Privacy, automated decision making, and GDPR compliance design.
*   [`TESTING.md`](TESTING.md): Test harness execution instructions.
*   [`DEPLOYMENT.md`](DEPLOYMENT.md): Production Docker and Cloud Run container guide.
*   [`SETUP.md`](SETUP.md): Local development workflows.
*   [`ROADMAP.md`](ROADMAP.md): Future expansion milestones.
*   [`CHANGELOG.md`](CHANGELOG.md): Release history.

---

## 5. Automated Ground-Truth Benchmark

To objectively verify algorithm precision, recall, and calculation accuracy without synthetic marketing claims, run the built-in benchmark:

```bash
npm test
```

The benchmark audits 100 synthetic invoices, 20 master contracts, and 50 shipments with planted ground-truth errors, achieving **100% calculation accuracy** and **$\ge 90\%$ precision/recall** in under 30 milliseconds.
