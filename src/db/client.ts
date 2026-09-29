/**
 * RecoverOS - Enterprise Multi-Tenant Database Client
 * 
 * Rules:
 * 1. Row-Level Security by tenant_id on every table.
 * 2. Tenant is derived from the authenticated session ONLY, NEVER from a request header.
 * 3. Fail closed on any security or tenant validation error.
 */

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

export class DatabaseClient {
  private tables: Map<string, Map<string, TenantScopedRecord>> = new Map();

  constructor() {
    this.initTables([
      'tenants',
      'users',
      'suppliers',
      'contracts',
      'purchase_orders',
      'po_lines',
      'goods_receipts',
      'invoices',
      'invoice_lines',
      'payments',
      'opportunities',
      'claims',
      'ingestion_jobs',
      'dead_letter_queue',
      'audit_log_entries',
    ]);
  }

  private initTables(tableNames: string[]) {
    tableNames.forEach((t) => this.tables.set(t, new Map()));
  }

  /**
   * Derive tenant strictly from the authenticated session.
   * Throws SecurityViolationError if session is invalid or header spoofing is attempted.
   */
  private extractTenantFromSession(session: AuthenticatedSession): string {
    if (!session || !session.tenantId || typeof session.tenantId !== 'string') {
      throw new SecurityViolationError('Unauthorized: No valid authenticated tenant session found.');
    }
    if (session.expiresAt && Date.now() > session.expiresAt) {
      throw new SecurityViolationError('Unauthorized: Authenticated session has expired.');
    }
    return session.tenantId;
  }

  /**
   * Insert record with strict RLS enforcement
   */
  async insert<T extends TenantScopedRecord>(
    tableName: string,
    session: AuthenticatedSession,
    data: Omit<T, 'tenantId'> & { tenantId?: string }
  ): Promise<T> {
    const authorizedTenantId = this.extractTenantFromSession(session);

    // If caller explicitly passed a conflicting tenantId, reject immediately (spoofing attempt)
    if (data.tenantId && data.tenantId !== authorizedTenantId) {
      throw new SecurityViolationError(
        `Cross-tenant write rejected! Session tenant '${authorizedTenantId}' cannot write to tenant '${data.tenantId}'.`
      );
    }

    const table = this.tables.get(tableName);
    if (!table) {
      throw new Error(`DB_TABLE_NOT_FOUND: Table '${tableName}' does not exist.`);
    }

    const record: T = {
      ...(data as any),
      tenantId: authorizedTenantId,
    };

    table.set(record.id, record);
    return record;
  }

  /**
   * Find record by ID with strict RLS enforcement.
   * If record belongs to another tenant, returns null (or throws in strict mode).
   */
  async findById<T extends TenantScopedRecord>(
    tableName: string,
    session: AuthenticatedSession,
    id: string
  ): Promise<T | null> {
    const authorizedTenantId = this.extractTenantFromSession(session);
    const table = this.tables.get(tableName);
    if (!table) return null;

    const record = table.get(id);
    if (!record) return null;

    // RLS Enforcement: If record belongs to another tenant, deny access
    if (record.tenantId !== authorizedTenantId) {
      throw new SecurityViolationError(
        `Cross-tenant read rejected! Tenant '${authorizedTenantId}' cannot read resource '${id}' belonging to tenant '${record.tenantId}'.`
      );
    }

    return record as T;
  }

  /**
   * Query records filtered by tenant_id automatically
   */
  async findMany<T extends TenantScopedRecord>(
    tableName: string,
    session: AuthenticatedSession,
    filterFn?: (record: T) => boolean
  ): Promise<T[]> {
    const authorizedTenantId = this.extractTenantFromSession(session);
    const table = this.tables.get(tableName);
    if (!table) return [];

    const results: T[] = [];
    for (const record of table.values()) {
      if (record.tenantId === authorizedTenantId) {
        if (!filterFn || filterFn(record as T)) {
          results.push(record as T);
        }
      }
    }

    return results;
  }

  /**
   * Update record with strict RLS enforcement
   */
  async update<T extends TenantScopedRecord>(
    tableName: string,
    session: AuthenticatedSession,
    id: string,
    updates: Partial<T>
  ): Promise<T> {
    const existing = await this.findById<T>(tableName, session, id);
    if (!existing) {
      throw new Error(`NOT_FOUND: Record '${id}' does not exist.`);
    }

    // Invariant: Tenant ID can NEVER be changed
    if (updates.tenantId && updates.tenantId !== existing.tenantId) {
      throw new SecurityViolationError('Cannot alter tenantId of an existing record.');
    }

    const updated: T = {
      ...existing,
      ...updates,
      tenantId: existing.tenantId, // Immutable
    };

    const table = this.tables.get(tableName)!;
    table.set(id, updated);
    return updated;
  }

  /**
   * Delete record with strict RLS enforcement
   */
  async delete(tableName: string, session: AuthenticatedSession, id: string): Promise<boolean> {
    const existing = await this.findById(tableName, session, id);
    if (!existing) return false;

    const table = this.tables.get(tableName)!;
    return table.delete(id);
  }

  /**
   * Clear all records (testing only)
   */
  clear() {
    this.tables.forEach((map) => map.clear());
  }
}

// Global persistent database client instance
export const db = new DatabaseClient();
