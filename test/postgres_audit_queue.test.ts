import { AuditLogService, GENESIS_HASH } from '../src/db/auditLog';
import { IngestionQueueService } from '../src/ingestion/queue';
import { AuthenticatedSession, DatabaseClient, db, SecurityViolationError } from '../src/db/client';

if (!process.env.DATABASE_URL) {
  console.log('POSTGRES AUDIT/QUEUE TEST SKIPPED: DATABASE_URL is not configured.');
  process.exit(0);
}

const suffix = Date.now().toString();
const session: AuthenticatedSession = {
  sessionId: `pg-aq-session-${suffix}`,
  userId: `pg-aq-user-${suffix}`,
  tenantId: `pg-aq-tenant-${suffix}`,
  role: 'Finance Manager',
  expiresAt: Date.now() + 60_000,
};

await db.initialize();
const first = await AuditLogService.appendEntryDurable(session, {
  action: 'TEST_FIRST', targetEntity: 'TEST', targetId: 'one', payload: { value: 1 },
});
const second = await AuditLogService.appendEntryDurable(session, {
  action: 'TEST_SECOND', targetEntity: 'TEST', targetId: 'two', payload: { value: 2 },
});
if (first.previousHash !== GENESIS_HASH || second.previousHash !== first.entryHash) {
  throw new Error('Durable audit hash chain linkage failed.');
}

const restartedClient = new DatabaseClient();
await restartedClient.initialize();
const persistedAudit = await restartedClient.findMany<any>('audit_log_entries', session);
if (persistedAudit.length !== 2) throw new Error('Audit entries were not persisted across client restart.');
const report = await AuditLogService.verifyChainIntegrityDurable(session);
if (!report.isValid || report.totalEntriesVerified !== 2) throw new Error('Durable audit verification failed.');

let modificationBlocked = false;
try {
  await restartedClient.update('audit_log_entries', session, first.id, first);
} catch (error) {
  modificationBlocked = error instanceof Error && error.message.includes('append-only');
}
if (!modificationBlocked) throw new Error('Database did not block audit log modification.');

const validPayload: any = {
  idempotencyKey: `pg-aq-idempotency-${suffix}`,
  entityType: 'INVOICE',
  records: [{
    invoiceNumber: `PG-AQ-${suffix}`,
    supplierTaxId: 'US-TEST',
    invoiceDate: '2026-03-01',
    dueDate: '2026-03-31',
    currency: 'USD',
    grossAmountMinor: 10000,
    taxAmountMinor: 0,
    paidAmountMinor: 10000,
    status: 'PAID',
  }],
};
const jobResult = await IngestionQueueService.submitBatchDurable(session, validPayload);
const duplicateResult = await IngestionQueueService.submitBatchDurable(session, validPayload);
if (jobResult.job.status !== 'COMPLETED' || !duplicateResult.isExisting || duplicateResult.job.id !== jobResult.job.id) {
  throw new Error('Durable ingestion idempotency failed.');
}
const persistedJob = await restartedClient.findById<any>('ingestion_jobs', session, jobResult.job.id);
if (!persistedJob || persistedJob.status !== 'COMPLETED') throw new Error('Ingestion job was not persisted.');

const invalidPayload: any = {
  idempotencyKey: `pg-aq-invalid-${suffix}`,
  entityType: 'INVOICE',
  records: [{ invoiceNumber: 'BAD', supplierTaxId: 'US-TEST', invoiceDate: 'invalid', dueDate: '2026-03-31', currency: 'USD', grossAmountMinor: 1 }],
};
const invalid = await IngestionQueueService.submitBatchDurable(session, invalidPayload);
const dlq = await IngestionQueueService.getDeadLettersDurable(session);
if (invalid.job.status !== 'DEAD_LETTER' || !dlq.some((entry) => entry.jobId === invalid.job.id)) {
  throw new Error('Durable ingestion DLQ persistence failed.');
}

await restartedClient.close();
await db.close();
console.log('POSTGRES AUDIT/QUEUE TEST PASSED: persistence, hash chain, append-only trigger, idempotency, and DLQ.');
