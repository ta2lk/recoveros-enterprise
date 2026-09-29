import { readFile, rm } from 'node:fs/promises';
import { EncryptedDocumentStorage } from '../src/storage/encryptedStorage';
import { AuthenticatedSession, db } from '../src/db/client';

if (!process.env.DATABASE_URL || process.env.OBJECT_STORAGE_DRIVER !== 'filesystem') {
  console.log('POSTGRES STORAGE TEST SKIPPED: DATABASE_URL and OBJECT_STORAGE_DRIVER=filesystem are required.');
  process.exit(0);
}

await db.initialize();
const suffix = Date.now().toString();
const tenantA: AuthenticatedSession = { sessionId: `storage-a-${suffix}`, userId: `storage-a-${suffix}`, tenantId: `storage-tenant-a-${suffix}`, role: 'Finance Manager', expiresAt: Date.now() + 60_000 };
const tenantB: AuthenticatedSession = { ...tenantA, sessionId: `storage-b-${suffix}`, userId: `storage-b-${suffix}`, tenantId: `storage-tenant-b-${suffix}` };
const content = Buffer.from(`confidential invoice content ${suffix}`, 'utf8');
const envelope = await EncryptedDocumentStorage.uploadDocument(tenantA, `invoice-${suffix}.pdf`, 'application/pdf', content);
if (envelope.storageBackend !== 'filesystem' || !envelope.storageKey || envelope.encryptedDataHex) throw new Error('Durable storage did not separate object bytes from PostgreSQL metadata.');
const objectPath = `${process.env.OBJECT_STORAGE_LOCAL_DIR}/${envelope.storageKey}`;
const encryptedObject = await readFile(objectPath);
if (encryptedObject.includes(content)) throw new Error('Object storage contains plaintext document bytes.');

EncryptedDocumentStorage.clear();
const restored = await EncryptedDocumentStorage.downloadDocument(tenantA, envelope.documentId);
if (!restored.equals(content)) throw new Error('Document was not restored after process-memory cache clear.');

let crossTenantDenied = false;
try { await EncryptedDocumentStorage.downloadDocument(tenantB, envelope.documentId); } catch { crossTenantDenied = true; }
if (!crossTenantDenied) throw new Error('Cross-tenant document download was allowed.');

await rm(process.env.OBJECT_STORAGE_LOCAL_DIR!, { recursive: true, force: true });
await db.close();
console.log('POSTGRES STORAGE TEST PASSED: durable object bytes, encrypted-at-rest payload, metadata persistence, and tenant isolation.');
