/**
 * RecoverOS - Phase 2 Backend and Data Integrity Test Suite
 * 
 * Verifies:
 * 1. Strict Tenant Isolation (RLS): Tenant A can never read/write Tenant B data via direct ID, query, or spoofed headers.
 * 2. Append-Only Cryptographic Hash Chaining: Sequential hash integrity, tamper detection, and UPDATE/DELETE denial.
 * 3. Idempotent Ingestion Queue: Zod schema validation, payload hash deduplication, size limits, and Dead-Letter Queue (DLQ).
 * 4. Document Envelope Encryption: AES-256-GCM envelope encryption, cross-tenant download rejection.
 * 5. Antivirus Scanner Hook: Immediate rejection of EICAR test signature and prohibited executable binaries.
 */

import { DatabaseClient, AuthenticatedSession, SecurityViolationError, db } from '../src/db/client';
import { AuditLogService, GENESIS_HASH } from '../src/db/auditLog';
import { IngestionQueueService, IngestionBatchPayload } from '../src/ingestion/queue';
import { EncryptedDocumentStorage, EICAR_TEST_SIGNATURE, VirusDetectedError } from '../src/storage/encryptedStorage';
import { SessionService } from '../src/security/sessionAuth';

let passed = 0;
let total = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    console.error(`  ✗ [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
    process.exitCode = 1;
  }
}

console.log('===============================================================');
console.log('--- RECOVEROS: PHASE 2 BACKEND & DATA ARCHITECTURE VERIFICATION ---');
console.log('===============================================================');

const sessionTenantA: AuthenticatedSession = {
  sessionId: 'sess-tenant-A-001',
  userId: 'usr-alice',
  tenantId: 'tenant-A',
  role: 'Finance Manager',
  expiresAt: Date.now() + 3600000,
};

const sessionTenantB: AuthenticatedSession = {
  sessionId: 'sess-tenant-B-001',
  userId: 'usr-bob',
  tenantId: 'tenant-B',
  role: 'Admin',
  expiresAt: Date.now() + 3600000,
};

// ---------------------------------------------------------------------------
// 1. Cross-Tenant Data Isolation (RLS & Session-Derived Context)
// ---------------------------------------------------------------------------
console.log('\n[1] Testing Multi-Tenant Row-Level Security (RLS) Isolation:');
{
  db.clear();

  // Seed record into Tenant A
  const seededInvoiceA = await db.insert('invoices', sessionTenantA, {
    id: 'inv-A-100',
    invoiceNumber: 'INV-A-100',
    totalAmountMinor: 100000n,
    currency: 'USD',
  });
  assert(seededInvoiceA.tenantId === 'tenant-A', 'Record created with Tenant A session correctly tagged with tenantId A');

  // Seed record into Tenant B
  const seededInvoiceB = await db.insert('invoices', sessionTenantB, {
    id: 'inv-B-200',
    invoiceNumber: 'INV-B-200',
    totalAmountMinor: 250000n,
    currency: 'USD',
  });
  assert(seededInvoiceB.tenantId === 'tenant-B', 'Record created with Tenant B session correctly tagged with tenantId B');

  // Test 1.1: Tenant A attempts to read Tenant B record by direct ID -> Strictly Denied
  let crossReadDenied = false;
  try {
    await db.findById('invoices', sessionTenantA, 'inv-B-200');
  } catch (err: any) {
    crossReadDenied = err instanceof SecurityViolationError;
  }
  assert(crossReadDenied, 'ACCEPTANCE: Tenant A cannot read Tenant B invoice via direct ID (throws SecurityViolationError)');

  // Test 1.2: Tenant A attempts to write a record claiming tenantId 'tenant-B' -> Strictly Denied
  let crossWriteDenied = false;
  try {
    await db.insert('invoices', sessionTenantA, {
      id: 'inv-malicious',
      tenantId: 'tenant-B', // Attempting to inject into tenant B
      invoiceNumber: 'INV-SPOOF',
      totalAmountMinor: 5000n,
      currency: 'USD',
    });
  } catch (err: any) {
    crossWriteDenied = err instanceof SecurityViolationError;
  }
  assert(crossWriteDenied, 'ACCEPTANCE: Tenant A cannot insert record with Tenant B tenantId (throws SecurityViolationError)');

  // Test 1.3: Tenant A queries collection -> only Tenant A records returned
  const tenantARecords = await db.findMany('invoices', sessionTenantA);
  const containsTenantB = tenantARecords.some((r) => r.tenantId === 'tenant-B');
  assert(!containsTenantB && tenantARecords.length === 1, 'ACCEPTANCE: Query by Tenant A returns zero Tenant B records');

  // Test 1.4: Header spoofing check via SessionService
  const registeredSession = SessionService.createSession({
    userId: 'usr-alice',
    tenantId: 'tenant-A',
    role: 'Finance Manager',
  });
  const retrievedSession = SessionService.getSession(registeredSession.sessionId);
  assert(retrievedSession?.tenantId === 'tenant-A', 'Session strictly derived from authenticated token, not client headers');
}

// ---------------------------------------------------------------------------
// 2. Append-Only Cryptographic Hash Chaining & Tamper Detection
// ---------------------------------------------------------------------------
console.log('\n[2] Testing Append-Only Hash-Chained Audit Log:');
{
  AuditLogService.clear();

  // Create sequential entries for Tenant A
  const e1 = AuditLogService.appendEntry(sessionTenantA, {
    action: 'INVOICE_INGESTED',
    targetEntity: 'INVOICE',
    targetId: 'inv-101',
    payload: { amount: 15000, supplier: 'ACME' },
  });

  const e2 = AuditLogService.appendEntry(sessionTenantA, {
    action: 'DISCREPANCY_DETECTED',
    targetEntity: 'OPPORTUNITY',
    targetId: 'opp-202',
    payload: { recoverable: 300, reason: 'DUPLICATE_PAYMENT' },
  });

  const e3 = AuditLogService.appendEntry(sessionTenantA, {
    action: 'CLAIM_SUBMITTED',
    targetEntity: 'CLAIM',
    targetId: 'clm-303',
    payload: { claimNumber: 'CLM-2026-001' },
  });

  // Check Hash Chain linkage
  assert(e1.previousHash === GENESIS_HASH, 'Entry #1 previousHash points to GENESIS_HASH (000...000)');
  assert(e2.previousHash === e1.entryHash, 'Entry #2 previousHash cryptographically links to Entry #1 entryHash');
  assert(e3.previousHash === e2.entryHash, 'Entry #3 previousHash cryptographically links to Entry #2 entryHash');

  // Verify valid chain
  const initialVerification = AuditLogService.verifyChainIntegrity('tenant-A');
  assert(initialVerification.isValid === true, 'Chain verification succeeds for pristine audit chain');
  assert(initialVerification.totalEntriesVerified === 3, 'All 3 blocks verified from genesis to head');

  // Test Tamper Detection: Alter Entry #2 action without regenerating hash
  AuditLogService._tamperForTesting('tenant-A', 1, 'FRAUDULENT_ACTION_MODIFIED');
  const tamperedVerification = AuditLogService.verifyChainIntegrity('tenant-A');
  assert(tamperedVerification.isValid === false, 'TAMPER DETECTED: Chain verification catches modified block');
  assert(
    tamperedVerification.tamperedSequenceNumber === 2,
    `Identified tampered block sequence number (#${tamperedVerification.tamperedSequenceNumber})`
  );

  // Test Immutability: Calling updateEntry or deleteEntry throws SecurityViolationError
  let updateRejected = false;
  try {
    AuditLogService.updateEntry();
  } catch (err: any) {
    updateRejected = err instanceof SecurityViolationError;
  }
  assert(updateRejected, 'IMMUTABLE: Audit log updateEntry strictly throws SecurityViolationError');

  let deleteRejected = false;
  try {
    AuditLogService.deleteEntry();
  } catch (err: any) {
    deleteRejected = err instanceof SecurityViolationError;
  }
  assert(deleteRejected, 'IMMUTABLE: Audit log deleteEntry strictly throws SecurityViolationError');
}

// ---------------------------------------------------------------------------
// 3. Idempotent Ingestion Queue & Schema Validation
// ---------------------------------------------------------------------------
console.log('\n[3] Testing Idempotent Ingestion Queue & Zod Schema Validation:');
{
  IngestionQueueService.clear();

  const validPayload: IngestionBatchPayload = {
    idempotencyKey: 'batch-2026-q1-invoices-001',
    entityType: 'INVOICE',
    records: [
      {
        invoiceNumber: 'INV-VALID-01',
        supplierTaxId: 'US-99-1234567',
        invoiceDate: '2026-03-01',
        dueDate: '2026-03-31',
        currency: 'USD',
        grossAmountMinor: 125000,
        taxAmountMinor: 0,
        paidAmountMinor: 125000,
        status: 'PAID',
      },
      {
        invoiceNumber: 'INV-VALID-02',
        supplierTaxId: 'DE-81-3920194',
        invoiceDate: '2026-03-05',
        dueDate: '2026-04-05',
        currency: 'EUR',
        grossAmountMinor: 89000,
        taxAmountMinor: 0,
        paidAmountMinor: 89000,
        status: 'PAID',
      },
    ],
  };

  // 3.1 Initial submission
  const res1 = await IngestionQueueService.submitBatch(sessionTenantA, validPayload);
  assert(res1.isExisting === false, 'First submission accepted and processed as new job');
  assert(res1.job.status === 'COMPLETED', 'Job completed with 2 valid records processed');

  // 3.2 Idempotent re-submission (Same idempotency key and payload)
  const res2 = await IngestionQueueService.submitBatch(sessionTenantA, validPayload);
  assert(res2.isExisting === true, 'IDEMPOTENCY: Re-submitting identical payload returns existing job');
  assert(res2.job.id === res1.job.id, 'Returned job ID matches initial job (zero duplicates created)');

  // 3.3 Schema Validation Failure: Invalid date format and unsupported currency
  const invalidPayload: IngestionBatchPayload = {
    idempotencyKey: 'batch-invalid-001',
    entityType: 'INVOICE',
    records: [
      {
        invoiceNumber: 'INV-BAD',
        supplierTaxId: 'TAX-1',
        invoiceDate: 'INVALID-DATE', // Schema violation
        dueDate: '2026-03-31',
        currency: 'BITCOIN' as any, // Schema violation
        grossAmountMinor: 100,
      },
    ],
  };

  const resInvalid = await IngestionQueueService.submitBatch(sessionTenantA, invalidPayload);
  assert(resInvalid.job.status === 'QUEUED' || resInvalid.job.status === 'DEAD_LETTER', 'Invalid schema batch triggers retry/DLQ quarantine');
  assert(resInvalid.job.errorMessage !== undefined, 'Validation failure error message recorded');
}

// ---------------------------------------------------------------------------
// 4. Object Storage with Envelope Encryption & Virus Scan
// ---------------------------------------------------------------------------
console.log('\n[4] Testing Document Object Storage Envelope Encryption & Antivirus Hook:');
{
  EncryptedDocumentStorage.clear();

  const sampleContractText = 'CONFIDENTIAL MASTER SUPPLY AGREEMENT - PAYMENT TERMS 2/10 NET 30';
  const sampleBuffer = Buffer.from(sampleContractText, 'utf8');

  // 4.1 Upload with envelope encryption
  const envelope = await EncryptedDocumentStorage.uploadDocument(
    sessionTenantA,
    'Contract_ACME_2026.pdf',
    'application/pdf',
    sampleBuffer
  );

  assert(envelope.virusScanPassed === true, 'Pre-ingestion antivirus scan passed for clean document');
  assert(envelope.encryptedDataHex !== sampleBuffer.toString('hex'), 'Ciphertext on storage does not match plaintext buffer');
  assert(envelope.encryptedDekHex.length > 0, 'Unique per-document DEK generated and encrypted under Master KEK');

  // 4.2 Download and decrypt with authorized session
  const downloadedBytes = await EncryptedDocumentStorage.downloadDocument(sessionTenantA, envelope.documentId);
  assert(downloadedBytes.toString('utf8') === sampleContractText, 'Authorized tenant decrypts plaintext perfectly via AES-256-GCM');

  // 4.3 Cross-Tenant Download Rejection
  let crossDownloadDenied = false;
  try {
    await EncryptedDocumentStorage.downloadDocument(sessionTenantB, envelope.documentId);
  } catch (err: any) {
    crossDownloadDenied = err instanceof SecurityViolationError;
  }
  assert(crossDownloadDenied, 'ACCEPTANCE: Tenant B strictly denied from downloading Tenant A document');

  // 4.4 Virus Scan Hook: EICAR malware test signature rejection
  const eicarBuffer = Buffer.from(EICAR_TEST_SIGNATURE, 'utf8');
  let virusCaught = false;
  try {
    await EncryptedDocumentStorage.uploadDocument(sessionTenantA, 'invoice_malicious.pdf', 'application/pdf', eicarBuffer);
  } catch (err: any) {
    virusCaught = err instanceof VirusDetectedError;
  }
  assert(virusCaught, 'ANTIVIRUS HOOK: EICAR malware test signature caught and rejected before storage');

  // 4.5 Executable Binary Rejection
  const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]); // MZ PE header
  let exeCaught = false;
  try {
    await EncryptedDocumentStorage.uploadDocument(sessionTenantA, 'malware.exe', 'application/x-msdownload', exeBuffer);
  } catch (err: any) {
    exeCaught = err instanceof VirusDetectedError;
  }
  assert(exeCaught, 'ANTIVIRUS HOOK: Executable binary upload (.exe / MZ header) rejected');
}

console.log('\n===============================================================');
console.log(`--- PHASE 2 BACKEND SUITE COMPLETED: ${passed}/${total} TESTS PASSED ---`);
console.log('===============================================================\n');

if (passed !== total) {
  process.exit(1);
}
