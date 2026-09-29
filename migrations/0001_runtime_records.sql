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

ALTER TABLE recoveros_runtime_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE recoveros_runtime_records FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS recoveros_runtime_tenant_isolation ON recoveros_runtime_records;
CREATE POLICY recoveros_runtime_tenant_isolation
  ON recoveros_runtime_records
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
CREATE INDEX IF NOT EXISTS idx_recoveros_runtime_tenant_table
  ON recoveros_runtime_records (tenant_id, table_name);
