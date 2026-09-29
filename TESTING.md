# RecoverOS - Automated Testing & Verification Guide

## 1. Test Architecture Overview

RecoverOS implements automated testing across five mission-critical layers:

1.  **Deterministic Calculation Engine Tests**: Verifies scaled decimal math, prompt discounts, volume rebate tiers, and duplicate payment detection without IEEE 754 floating point drift.
2.  **Tenant Isolation Verification**: Confirms that cross-tenant data requests trigger fatal security exceptions.
3.  **Role-Based Access Control (RBAC)**: Validates permission grants and restrictions for all seven defined roles.
4.  **Prompt Injection & Sanitization**: Validates that adversarial prompt injections in untrusted file data are neutralized.
5.  **Ground-Truth Synthetic Benchmark**: Audits 100 synthetic invoices, 20 contracts, and 50 shipments with pre-planted ground-truth discrepancies to measure precision, recall, and calculation accuracy.

---

## 2. Running Automated Tests

```bash
# Run the automated test suite
npm test

# Expected output:
# --- RECOVEROS TEST SUITE STARTING ---
# [1] Testing Deterministic Financial Calculation Engine:
#   [PASS] DecimalMath.add(0.1, 0.2) equals exactly 0.3
#   ...
# [5] Testing Ground-Truth Benchmark Evaluation:
#   Total Records Audited: 300
#   Planted Ground-Truth Errors: 6
#   Detected Discrepancies: 6
#   Precision: 100%
#   Recall: 100%
#   Calculation Accuracy: 100%
# --- TEST SUITE COMPLETE: All tests passed ---
```
