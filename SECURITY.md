# RecoverOS - Enterprise Security Constitution

## 1. Multi-Tenant Logical Isolation
*   Every data read, update, or delete operation requires an authenticated tenant context.
*   Cross-tenant attempts throw a fatal `SECURITY_VIOLATION` exception and trigger an immutable security event log.
*   Automated test suites explicitly verify that Tenant A cannot access Tenant B resources, even with direct UUID references.

## 2. Cryptographic Security Standards
*   **Data at Rest**: Encrypted using AES-256 with tenant-isolated key rotation.
*   **Data in Transit**: Enforces TLS 1.3 encryption across all client-to-server and server-to-integration communication channels.
*   **Credentials & API Secrets**: Stored in encrypted key vaults and only decrypted in transient memory during read-only sync sessions.

## 3. Prompt Injection Defense Pipeline
*   All ingested files (PDFs, CSVs, vendor emails, OCR scans) are classified as **Untrusted External Data**.
*   Inputs pass through an adversarial pattern filter scanning for instruction override attempts.
*   Extracted text is encapsulated inside `<UNTRUSTED_DOCUMENT_CONTENT>` CDATA blocks. System instructions explicitly prohibit models from interpreting external text as commands.

## 4. Role-Based Access Control (RBAC)
*   **Owner**: Unrestricted tenant control, billing, settings, and user management.
*   **Admin**: Tenant administration and integration management.
*   **Finance Manager**: Financial approvals, claim dispatch authorization, and settlement logging.
*   **Analyst**: Opportunity review and evidence inspection.
*   **Viewer**: Read-only dashboard access.
*   **Auditor**: Compliance access to immutable audit trails and reports.
*   **AI Agent**: Sandboxed operational execution strictly within pre-configured tool policies.

## 6. Production Security Gate

The application intentionally fails closed in production unless `RECOVEROS_JWT_SECRET`
and `RECOVEROS_MASTER_KEK_HEX` are injected from OCI Vault/KMS or an equivalent
secret manager. Test-only key material is enabled only when `NODE_ENV=test`.

Before accepting real customer data, the deployment owner must complete all of the
following outside this repository:

* Use OCI Vault/KMS, not `.env` files, for all secrets and configure rotation.
* Replace the in-memory refresh-token, session, portal-link, audit and document stores
  with the PostgreSQL/Object Storage adapters and run migrations with RLS enabled.
* Put the service behind TLS 1.3, a WAF/reverse proxy, and a correctly configured
  trusted proxy chain; never expose PostgreSQL publicly.
* Run Gitleaks, Semgrep/CodeQL, Trivy, Terraform security scanning and dependency
  review in CI, followed by an independent staging penetration test.
* Verify backups, restore drills, alerting, incident response, log retention and key
  rotation with evidence before production go-live.

Passing unit tests is not a guarantee that the system is unhackable; production
readiness requires these operational controls and an external security assessment.
