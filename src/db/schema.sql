-- RecoverOS Enterprise Multi-Tenant PostgreSQL Schema
-- Migration: 0001_initial_production_schema.sql
-- Enforces: Row-Level Security (RLS) on all tenant-bound tables,
--           Strict immutable append-only audit log with triggers blocking UPDATE/DELETE.

-- 1. Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(64) UNIQUE NOT NULL,
    plan VARCHAR(32) NOT NULL DEFAULT 'ENTERPRISE',
    mode VARCHAR(16) NOT NULL DEFAULT 'PRODUCTION',
    default_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    autonomous_threshold_minor BIGINT NOT NULL DEFAULT 50000, -- $500.00
    high_value_threshold_minor BIGINT NOT NULL DEFAULT 500000, -- $5000.00
    confidence_threshold_percent INT NOT NULL DEFAULT 90,
    success_fee_percent INT NOT NULL DEFAULT 20,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    password_hash VARCHAR(255) NOT NULL,
    mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_secret VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    UNIQUE (tenant_id, email)
);

-- 3. Suppliers Table
CREATE TABLE IF NOT EXISTS suppliers (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    tax_id VARCHAR(64) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    country VARCHAR(64) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    payment_terms VARCHAR(64) NOT NULL, -- e.g. "2/10 Net 30"
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, tax_id)
);

-- 4. Contracts Table
CREATE TABLE IF NOT EXISTS contracts (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    supplier_id VARCHAR(64) NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    contract_number VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    rebate_tiers_json JSONB,
    early_discount_terms_json JSONB,
    source_document_id VARCHAR(64),
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, contract_number)
);

-- 5. Purchase Orders Table
CREATE TABLE IF NOT EXISTS purchase_orders (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    supplier_id VARCHAR(64) NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    po_number VARCHAR(64) NOT NULL,
    order_date DATE NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    total_amount_minor BIGINT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'ISSUED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, po_number)
);

-- 6. Purchase Order Lines Table
CREATE TABLE IF NOT EXISTS po_lines (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    po_id VARCHAR(64) NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    line_number INT NOT NULL,
    item_code VARCHAR(64) NOT NULL,
    description TEXT NOT NULL,
    quantity_ordered BIGINT NOT NULL,
    uom VARCHAR(16) NOT NULL DEFAULT 'EA',
    unit_price_minor BIGINT NOT NULL,
    total_price_minor BIGINT NOT NULL,
    UNIQUE (po_id, line_number)
);

-- 7. Goods Receipts Table
CREATE TABLE IF NOT EXISTS goods_receipts (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    po_id VARCHAR(64) NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
    receipt_number VARCHAR(64) NOT NULL,
    received_date DATE NOT NULL,
    line_number INT NOT NULL,
    item_code VARCHAR(64) NOT NULL,
    quantity_received BIGINT NOT NULL,
    uom VARCHAR(16) NOT NULL DEFAULT 'EA',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    supplier_id VARCHAR(64) NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    purchase_order_id VARCHAR(64) REFERENCES purchase_orders(id) ON DELETE SET NULL,
    invoice_number VARCHAR(64) NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    subtotal_minor BIGINT NOT NULL,
    tax_minor BIGINT NOT NULL DEFAULT 0,
    total_amount_minor BIGINT NOT NULL,
    paid_amount_minor BIGINT NOT NULL DEFAULT 0,
    payment_status VARCHAR(16) NOT NULL DEFAULT 'UNPAID',
    source_document_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, invoice_number)
);

-- 9. Invoice Lines Table
CREATE TABLE IF NOT EXISTS invoice_lines (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_id VARCHAR(64) NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    line_number INT NOT NULL,
    item_code VARCHAR(64) NOT NULL,
    description TEXT NOT NULL,
    quantity_invoiced BIGINT NOT NULL,
    uom VARCHAR(16) NOT NULL DEFAULT 'EA',
    unit_price_minor BIGINT NOT NULL,
    total_price_minor BIGINT NOT NULL,
    UNIQUE (invoice_id, line_number)
);

-- 10. Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    supplier_id VARCHAR(64) NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    invoice_id VARCHAR(64) REFERENCES invoices(id) ON DELETE SET NULL,
    transaction_reference VARCHAR(64) NOT NULL,
    amount_minor BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    payment_date DATE NOT NULL,
    method VARCHAR(16) NOT NULL DEFAULT 'ACH',
    status VARCHAR(16) NOT NULL DEFAULT 'SETTLED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, transaction_reference)
);

-- 11. Opportunities Table (Lifecycle: DETECTED -> REVIEWED -> CLAIMED -> SETTLED)
CREATE TABLE IF NOT EXISTS opportunities (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(64) NOT NULL,
    supplier_id VARCHAR(64) NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    expected_amount_minor BIGINT NOT NULL,
    actual_amount_minor BIGINT NOT NULL,
    recoverable_amount_minor BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    confidence_score INT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'DETECTED',
    calculation_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Claims Table
CREATE TABLE IF NOT EXISTS claims (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    opportunity_id VARCHAR(64) NOT NULL REFERENCES opportunities(id) ON DELETE RESTRICT,
    claim_number VARCHAR(64) UNIQUE NOT NULL,
    supplier_id VARCHAR(64) NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    amount_minor BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(32) NOT NULL DEFAULT 'DISCOVERED',
    approval_required BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_user_id VARCHAR(64) REFERENCES users(id),
    approved_by_user_id VARCHAR(64) REFERENCES users(id),
    submitted_at TIMESTAMPTZ,
    settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12a. Supplier Dispute Portal Credentials and Responses
CREATE TABLE IF NOT EXISTS supplier_portal_magic_links (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    claim_id VARCHAR(64) NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    supplier_id VARCHAR(64) NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    supplier_email VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    redeemed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_portal_responses (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    claim_id VARCHAR(64) NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    supplier_id VARCHAR(64) NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    action VARCHAR(32) NOT NULL,
    reason TEXT,
    counter_offer_minor BIGINT,
    document_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Ingestion Jobs Table (Idempotent Queue)
CREATE TABLE IF NOT EXISTS ingestion_jobs (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    idempotency_key VARCHAR(128) NOT NULL,
    payload_sha256 VARCHAR(64) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    entity_type VARCHAR(32) NOT NULL,
    record_count INT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'QUEUED', -- QUEUED, PROCESSING, COMPLETED, FAILED
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    UNIQUE (tenant_id, idempotency_key)
);

-- 14. Dead-Letter Queue (DLQ)
CREATE TABLE IF NOT EXISTS dead_letter_queue (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    job_id VARCHAR(64) REFERENCES ingestion_jobs(id) ON DELETE CASCADE,
    failed_payload_preview TEXT NOT NULL,
    failure_reason TEXT NOT NULL,
    attempt_history JSONB NOT NULL,
    quarantined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. Append-Only Audit Log Table (Cryptographically Hash-Chained)
CREATE TABLE IF NOT EXISTS audit_log_entries (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sequence_number BIGINT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_id VARCHAR(64) NOT NULL,
    actor_role VARCHAR(32) NOT NULL,
    action VARCHAR(64) NOT NULL,
    target_entity VARCHAR(64) NOT NULL,
    target_id VARCHAR(64) NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    previous_hash VARCHAR(64) NOT NULL,
    entry_hash VARCHAR(64) NOT NULL,
    UNIQUE (tenant_id, sequence_number),
    UNIQUE (tenant_id, entry_hash)
);

-- Database trigger to strictly prevent UPDATE and DELETE on audit_log_entries
CREATE OR REPLACE FUNCTION deny_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'SECURITY_VIOLATION: Audit log entries are strictly append-only. UPDATE and DELETE are prohibited by cryptographic integrity invariant.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_no_update ON audit_log_entries;
CREATE TRIGGER trg_audit_log_no_update
BEFORE UPDATE ON audit_log_entries
FOR EACH ROW EXECUTE FUNCTION deny_audit_log_modification();

DROP TRIGGER IF EXISTS trg_audit_log_no_delete ON audit_log_entries;
CREATE TRIGGER trg_audit_log_no_delete
BEFORE DELETE ON audit_log_entries
FOR EACH ROW EXECUTE FUNCTION deny_audit_log_modification();

-- Enable Row-Level Security (RLS) on all tenant-isolated tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_portal_magic_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_portal_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dead_letter_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log_entries ENABLE ROW LEVEL SECURITY;

-- Dynamic RLS policies asserting current session tenant id
CREATE POLICY tenant_isolation_users ON users USING (tenant_id = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_suppliers ON suppliers USING (tenant_id = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_contracts ON contracts USING (tenant_id = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_pos ON purchase_orders USING (tenant_id = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_invoices ON invoices USING (tenant_id = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_payments ON payments USING (tenant_id = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_opps ON opportunities USING (tenant_id = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_claims ON claims USING (tenant_id = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_supplier_portal_magic_links ON supplier_portal_magic_links USING (tenant_id = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_supplier_portal_responses ON supplier_portal_responses USING (tenant_id = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_jobs ON ingestion_jobs USING (tenant_id = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_audit ON audit_log_entries USING (tenant_id = current_setting('app.current_tenant_id', true));
