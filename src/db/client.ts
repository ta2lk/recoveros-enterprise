import { Pool, PoolClient } from 'pg';

export interface AuthenticatedSession {
  sessionId: string;
  userId: string;
  tenantId: string;
  role: string;
  expiresAt: number;
}

export class SecurityViolationError extends Error {
  constructor(message: string) {
    super(`SECURITY_VIOLATION: ${message}`);
    this.name = 'SecurityViolationError';
  }
}

export interface TenantScopedRecord {
  id: string;
  tenantId: string;
  [key: string]: any;
}

type TransactionCallback<T> = (client: PoolClient, tenantId: string) => Promise<T>;

const RUNTIME_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS recoveros_schema_migrations (
  version VARCHAR(128) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

INSERT INTO recoveros_schema_migrations (version)
VALUES ('0001_runtime_records')
ON CONFLICT (version) DO NOTHING;
`;

function serialize(value: unknown): string {
  return JSON.stringify(value, (_key, item) =>
    typeof item === 'bigint' ? { __recoveros_bigint__: item.toString() } : item
  );
}

function deserialize<T>(value: unknown): T {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return JSON.parse(text, (_key, item) => {
    if (item && typeof item === 'object' && '__recoveros_bigint__' in item) {
      return BigInt(item.__recoveros_bigint__);
    }
    return item;
  }) as T;
}

export class DatabaseClient {
  private readonly tables = new Map<string, Map<string, TenantScopedRecord>>();
  private readonly pool?: Pool;
  private initialized = false;

  constructor() {
    this.initTables([
      'tenants', 'users', 'suppliers', 'contracts', 'purchase_orders', 'po_lines',
      'goods_receipts', 'invoices', 'invoice_lines', 'payments', 'opportunities',
      'claims', 'ingestion_jobs', 'dead_letter_queue', 'audit_log_entries',
    ]);

    if (process.env.DATABASE_URL) {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: Number(process.env.DATABASE_POOL_MAX || 10),
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
        ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
      });
    }
  }

  private initTables(tableNames: string[]) {
    tableNames.forEach((table) => this.tables.set(table, new Map()));
  }

  get usesPostgres(): boolean {
    return Boolean(this.pool);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (!this.pool) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('DATABASE_URL is required in production; refusing to use in-memory persistence.');
      }
      this.initialized = true;
      return;
    }

    await this.pool.query(RUNTIME_SCHEMA_SQL);
    await this.pool.query('SELECT 1');
    this.initialized = true;
  }

  async checkHealth(): Promise<{ connected: boolean; mode: 'postgres' | 'memory' }> {
    if (!this.pool) return { connected: process.env.NODE_ENV !== 'production', mode: 'memory' };
    try {
      await this.pool.query('SELECT 1');
      return { connected: true, mode: 'postgres' };
    } catch {
      return { connected: false, mode: 'postgres' };
    }
  }

  async close(): Promise<void> {
    if (this.pool) await this.pool.end();
  }

  private extractTenantFromSession(session: AuthenticatedSession): string {
    if (!session || !session.tenantId || typeof session.tenantId !== 'string') {
      throw new SecurityViolationError('Unauthorized: No valid authenticated tenant session found.');
    }
    if (session.expiresAt && Date.now() > session.expiresAt) {
      throw new SecurityViolationError('Unauthorized: Authenticated session has expired.');
    }
    return session.tenantId;
  }

  private async withTenant<T>(session: AuthenticatedSession, callback: TransactionCallback<T>): Promise<T> {
    const tenantId = this.extractTenantFromSession(session);
    if (!this.pool) throw new Error('PostgreSQL transaction requested without a configured pool.');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
      const result = await callback(client, tenantId);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async insert<T extends TenantScopedRecord>(
    tableName: string,
    session: AuthenticatedSession,
    data: Omit<T, 'tenantId'> & { tenantId?: string }
  ): Promise<T> {
    const authorizedTenantId = this.extractTenantFromSession(session);
    if (data.tenantId && data.tenantId !== authorizedTenantId) {
      throw new SecurityViolationError(`Cross-tenant write rejected! Session tenant '${authorizedTenantId}' cannot write to tenant '${data.tenantId}'.`);
    }
    const record = { ...(data as any), tenantId: authorizedTenantId } as T;

    if (this.pool) {
      await this.withTenant(session, async (client) => {
        await client.query(
          `INSERT INTO recoveros_runtime_records (table_name, id, tenant_id, data)
           VALUES ($1, $2, $3, $4::jsonb)`,
          [tableName, record.id, authorizedTenantId, serialize(record)]
        );
      });
    } else {
      const table = this.tables.get(tableName);
      if (!table) throw new Error(`DB_TABLE_NOT_FOUND: Table '${tableName}' does not exist.`);
      table.set(record.id, record);
    }
    return record;
  }

  async findById<T extends TenantScopedRecord>(tableName: string, session: AuthenticatedSession, id: string): Promise<T | null> {
    const authorizedTenantId = this.extractTenantFromSession(session);
    if (this.pool) {
      return this.withTenant(session, async (client) => {
        const result = await client.query(
          `SELECT data FROM recoveros_runtime_records
           WHERE table_name = $1 AND id = $2 AND tenant_id = $3`,
          [tableName, id, authorizedTenantId]
        );
        return result.rows[0] ? deserialize<T>(result.rows[0].data) : null;
      });
    }

    const record = this.tables.get(tableName)?.get(id);
    if (!record) return null;
    if (record.tenantId !== authorizedTenantId) {
      throw new SecurityViolationError(`Cross-tenant read rejected! Tenant '${authorizedTenantId}' cannot read resource '${id}' belonging to tenant '${record.tenantId}'.`);
    }
    return record as T;
  }

  async findMany<T extends TenantScopedRecord>(tableName: string, session: AuthenticatedSession, filterFn?: (record: T) => boolean): Promise<T[]> {
    const authorizedTenantId = this.extractTenantFromSession(session);
    if (this.pool) {
      return this.withTenant(session, async (client) => {
        const result = await client.query(
          `SELECT data FROM recoveros_runtime_records
           WHERE table_name = $1 AND tenant_id = $2 ORDER BY created_at ASC`,
          [tableName, authorizedTenantId]
        );
        const records = result.rows.map((row) => deserialize<T>(row.data));
        return filterFn ? records.filter(filterFn) : records;
      });
    }

    const records = [...(this.tables.get(tableName)?.values() || [])]
      .filter((record) => record.tenantId === authorizedTenantId) as T[];
    return filterFn ? records.filter(filterFn) : records;
  }

  async update<T extends TenantScopedRecord>(tableName: string, session: AuthenticatedSession, id: string, updates: Partial<T>): Promise<T> {
    const existing = await this.findById<T>(tableName, session, id);
    if (!existing) throw new Error(`NOT_FOUND: Record '${id}' does not exist.`);
    if (updates.tenantId && updates.tenantId !== existing.tenantId) {
      throw new SecurityViolationError('Cannot alter tenantId of an existing record.');
    }
    const updated = { ...existing, ...updates, tenantId: existing.tenantId } as T;

    if (this.pool) {
      await this.withTenant(session, async (client) => {
        await client.query(
          `UPDATE recoveros_runtime_records SET data = $1::jsonb, updated_at = NOW()
           WHERE table_name = $2 AND id = $3`,
          [serialize(updated), tableName, id]
        );
      });
    } else {
      this.tables.get(tableName)?.set(id, updated);
    }
    return updated;
  }

  async delete(tableName: string, session: AuthenticatedSession, id: string): Promise<boolean> {
    const existing = await this.findById<TenantScopedRecord>(tableName, session, id);
    if (!existing) return false;
    if (this.pool) {
      const result = await this.withTenant(session, (client) => client.query(
        `DELETE FROM recoveros_runtime_records WHERE table_name = $1 AND id = $2`,
        [tableName, id]
      ));
      return result.rowCount === 1;
    }
    return this.tables.get(tableName)?.delete(id) || false;
  }

  clear() {
    this.tables.forEach((table) => table.clear());
  }
}

export const db = new DatabaseClient();
