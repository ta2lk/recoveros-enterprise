import { DatabaseClient, AuthenticatedSession } from '../src/db/client';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.log('POSTGRES INTEGRATION TEST SKIPPED: DATABASE_URL is not configured.');
  process.exit(0);
}

const tenantA: AuthenticatedSession = {
  sessionId: 'pg-test-session-a',
  userId: 'pg-test-user-a',
  tenantId: 'pg-tenant-a',
  role: 'Finance Manager',
  expiresAt: Date.now() + 60_000,
};

const tenantB: AuthenticatedSession = {
  sessionId: 'pg-test-session-b',
  userId: 'pg-test-user-b',
  tenantId: 'pg-tenant-b',
  role: 'Finance Manager',
  expiresAt: Date.now() + 60_000,
};

const client = new DatabaseClient();
await client.initialize();

const recordId = `pg-persistence-${Date.now()}`;
await client.insert('invoices', tenantA, {
  id: recordId,
  invoiceNumber: 'PG-PERSISTENCE-001',
  totalAmountMinor: 125000n,
  currency: 'USD',
});
await client.insert('invoices', tenantB, {
  id: `${recordId}-b`,
  invoiceNumber: 'PG-PERSISTENCE-002',
  totalAmountMinor: 250000n,
  currency: 'USD',
});

const secondClient = new DatabaseClient();
await secondClient.initialize();
const persisted = await secondClient.findById<any>('invoices', tenantA, recordId);
if (!persisted || persisted.totalAmountMinor !== 125000n) {
  throw new Error('PostgreSQL persistence failed: record was not recovered by a new client.');
}

const crossTenantRead = await secondClient.findById<any>('invoices', tenantA, `${recordId}-b`);
if (crossTenantRead !== null) {
  throw new Error('Tenant isolation failed: Tenant A read Tenant B data.');
}

const tenantARecords = await secondClient.findMany<any>('invoices', tenantA);
if (tenantARecords.some((record) => record.tenantId !== 'pg-tenant-a')) {
  throw new Error('Tenant isolation failed: Tenant A query returned another tenant.');
}

console.log('POSTGRES INTEGRATION TEST PASSED: migration, persistence, RLS tenant isolation.');
await client.close();
await secondClient.close();
