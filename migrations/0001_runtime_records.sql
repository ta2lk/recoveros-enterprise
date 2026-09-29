-- RecoverOS runtime persistence migration 0001
-- This table preserves the existing repository contract while domain repositories
-- are migrated one aggregate at a time. It is not a substitute for the domain schema.

CREATE TABLE IF NOT EXISTS recoveros_runtime_records (
  table_name VARCHAR(128) NOT NULL,
  id VARCHAR(255) NOT NULL,
  tenant_id VARCHAR(64) NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (table_name, id)
);

CREATE TABLE IF NOT EXISTS auth_users (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id VARCHAR(128) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  role VARCHAR(32) NOT NULL,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions (token_hash);

ALTER TABLE recoveros_runtime_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE recoveros_runtime_records FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS recoveros_runtime_tenant_isolation ON recoveros_runtime_records;
CREATE POLICY recoveros_runtime_tenant_isolation
  ON recoveros_runtime_records
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
CREATE INDEX IF NOT EXISTS idx_recoveros_runtime_tenant_table
  ON recoveros_runtime_records (tenant_id, table_name);

CREATE OR REPLACE FUNCTION deny_recoveros_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.table_name = 'audit_log_entries' THEN
    RAISE EXCEPTION 'SECURITY_VIOLATION: audit log records are append-only.';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recoveros_audit_no_update ON recoveros_runtime_records;
CREATE TRIGGER trg_recoveros_audit_no_update
BEFORE UPDATE OR DELETE ON recoveros_runtime_records
FOR EACH ROW EXECUTE FUNCTION deny_recoveros_audit_modification();
