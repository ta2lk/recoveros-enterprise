import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { AuthenticatedSession, db, SecurityViolationError } from '../db/client';

export const EICAR_TEST_SIGNATURE = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

export interface EncryptedStorageEnvelope {
  id: string;
  documentId: string;
  tenantId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  encryptedDataHex?: string;
  storageKey?: string;
  storageBackend: 'memory' | 's3' | 'filesystem';
  ivHex: string;
  authTagHex: string;
  encryptedDekHex: string;
  dekWrapIvHex: string;
  dekWrapAuthTagHex: string;
  sha256Hash: string;
  uploadedAt: string;
  virusScanPassed: boolean;
}

export class VirusDetectedError extends Error {
  constructor(reason: string) { super(`VIRUS_SCAN_FAILED: Upload rejected by security scanner. ${reason}`); this.name = 'VirusDetectedError'; }
}

export class EncryptedDocumentStorage {
  private static documentStore: Map<string, EncryptedStorageEnvelope> = new Map();
  private static ephemeralMasterKek: Buffer | undefined;
  private static s3Client: S3Client | undefined;

  private static getMasterKek(): Buffer {
    const configured = process.env.RECOVEROS_MASTER_KEK_HEX;
    if (configured) {
      if (!/^[0-9a-fA-F]{64}$/.test(configured)) throw new SecurityViolationError('RECOVEROS_MASTER_KEK_HEX must be exactly 32 bytes encoded as hex.');
      return Buffer.from(configured, 'hex');
    }
    if (process.env.NODE_ENV === 'production') throw new SecurityViolationError('Document encryption key is not configured; refusing production startup operation.');
    if (!this.ephemeralMasterKek) this.ephemeralMasterKek = randomBytes(32);
    return this.ephemeralMasterKek;
  }

  private static backend(): 'memory' | 's3' | 'filesystem' {
    if (!db.usesPostgres) return 'memory';
    if (process.env.OBJECT_STORAGE_DRIVER === 'filesystem') return 'filesystem';
    if (process.env.OBJECT_STORAGE_BUCKET) return 's3';
    if (process.env.NODE_ENV === 'production') throw new SecurityViolationError('OBJECT_STORAGE_BUCKET and OBJECT_STORAGE_SSE_KMS_KEY_ID are required in production.');
    return 'memory';
  }

  private static getS3(): S3Client {
    if (!this.s3Client) {
      const endpoint = process.env.OBJECT_STORAGE_ENDPOINT;
      const accessKeyId = process.env.OBJECT_STORAGE_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
      const secretAccessKey = process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
      this.s3Client = new S3Client({
        region: process.env.OBJECT_STORAGE_REGION || process.env.AWS_REGION || 'us-east-1',
        endpoint,
        forcePathStyle: process.env.OBJECT_STORAGE_FORCE_PATH_STYLE === 'true' || Boolean(endpoint),
        credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
      });
    }
    return this.s3Client;
  }

  private static objectKey(tenantId: string, documentId: string): string { return `tenants/${encodeURIComponent(tenantId)}/documents/${encodeURIComponent(documentId)}.bin`; }

  private static async putObject(key: string, bytes: Buffer, mimeType: string, backend: 's3' | 'filesystem'): Promise<void> {
    if (backend === 'filesystem') {
      const root = process.env.OBJECT_STORAGE_LOCAL_DIR || path.join(process.cwd(), '.object-storage');
      const filePath = path.join(root, key);
      await mkdir(path.dirname(filePath), { recursive: true }); await writeFile(filePath, bytes); return;
    }
    const bucket = process.env.OBJECT_STORAGE_BUCKET!;
    const kmsKey = process.env.OBJECT_STORAGE_SSE_KMS_KEY_ID;
    if (!kmsKey && process.env.NODE_ENV === 'production') throw new SecurityViolationError('OBJECT_STORAGE_SSE_KMS_KEY_ID is required for production object uploads.');
    await this.getS3().send(new PutObjectCommand({
      Bucket: bucket, Key: key, Body: bytes, ContentType: mimeType,
      ServerSideEncryption: 'aws:kms', SSEKMSKeyId: kmsKey,
      Metadata: { recoverosEncrypted: 'aes-256-gcm', recoverosTenant: 'isolated' },
    }));
  }

  private static async getObject(key: string, backend: 's3' | 'filesystem'): Promise<Buffer> {
    if (backend === 'filesystem') {
      const root = process.env.OBJECT_STORAGE_LOCAL_DIR || path.join(process.cwd(), '.object-storage');
      return readFile(path.join(root, key));
    }
    const result = await this.getS3().send(new GetObjectCommand({ Bucket: process.env.OBJECT_STORAGE_BUCKET!, Key: key }));
    if (!result.Body) throw new Error('OBJECT_STORAGE_EMPTY: Object body was empty.');
    if ('transformToByteArray' in result.Body && typeof result.Body.transformToByteArray === 'function') return Buffer.from(await result.Body.transformToByteArray());
    const chunks: Buffer[] = []; for await (const chunk of result.Body as AsyncIterable<Uint8Array>) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  static scanPayload(buffer: Buffer, fileName: string): boolean {
    if (buffer.toString('utf8').includes(EICAR_TEST_SIGNATURE)) throw new VirusDetectedError('Known malicious test signature (EICAR) detected in upload.');
    if (buffer.length >= 4) {
      const headerHex = buffer.subarray(0, 4).toString('hex').toLowerCase();
      if (headerHex.startsWith('4d5a') || headerHex.startsWith('7f454c46')) throw new VirusDetectedError('Executable binaries (.exe, .elf) are strictly prohibited.');
    }
    const forbiddenExtensions = ['.exe', '.bat', '.cmd', '.sh', '.scr', '.vbs', '.ps1'];
    if (forbiddenExtensions.some((ext) => fileName.toLowerCase().endsWith(ext))) throw new VirusDetectedError(`Prohibited file extension detected: ${fileName}`);
    return true;
  }

  static async uploadDocument(session: AuthenticatedSession, fileName: string, mimeType: string, rawBytes: Buffer): Promise<EncryptedStorageEnvelope> {
    if (!session?.tenantId) throw new SecurityViolationError('Cannot upload document without authenticated session.');
    this.scanPayload(rawBytes, fileName);
    const backend = this.backend(); const documentId = `doc-${session.tenantId}-${Date.now()}-${randomBytes(4).toString('hex')}`;
    const sha256Hash = createHash('sha256').update(rawBytes).digest('hex'); const dek = randomBytes(32); const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', dek, iv); const encryptedData = Buffer.concat([cipher.update(rawBytes), cipher.final()]); const authTag = cipher.getAuthTag();
    const dekWrapIv = randomBytes(12); const kekCipher = createCipheriv('aes-256-gcm', this.getMasterKek(), dekWrapIv);
    const encryptedDek = Buffer.concat([kekCipher.update(dek), kekCipher.final()]); const dekWrapAuthTag = kekCipher.getAuthTag();
    const key = this.objectKey(session.tenantId, documentId);
    const envelope: EncryptedStorageEnvelope = {
      id: documentId, documentId, tenantId: session.tenantId, fileName, mimeType, fileSizeBytes: rawBytes.length,
      encryptedDataHex: backend === 'memory' ? encryptedData.toString('hex') : undefined, storageKey: backend === 'memory' ? undefined : key,
      storageBackend: backend, ivHex: iv.toString('hex'), authTagHex: authTag.toString('hex'), encryptedDekHex: encryptedDek.toString('hex'),
      dekWrapIvHex: dekWrapIv.toString('hex'), dekWrapAuthTagHex: dekWrapAuthTag.toString('hex'), sha256Hash, uploadedAt: new Date().toISOString(), virusScanPassed: true,
    };
    if (backend === 'memory') this.documentStore.set(documentId, envelope);
    else { await this.putObject(key, encryptedData, 'application/octet-stream', backend); await db.insert('document_objects', session, envelope as any); }
    return envelope;
  }

  static async downloadDocument(session: AuthenticatedSession, documentId: string): Promise<Buffer> {
    if (!session?.tenantId) throw new SecurityViolationError('Cannot download document without authenticated session.');
    const backend = this.backend();
    const envelope = backend === 'memory' ? this.documentStore.get(documentId) : await db.findById<EncryptedStorageEnvelope>('document_objects', session, documentId);
    if (!envelope) throw new Error(`DOCUMENT_NOT_FOUND: Document '${documentId}' does not exist.`);
    if (envelope.tenantId !== session.tenantId) throw new SecurityViolationError(`Cross-tenant access blocked! Tenant '${session.tenantId}' cannot access document '${documentId}'.`);
    const kekDecipher = createDecipheriv('aes-256-gcm', this.getMasterKek(), Buffer.from(envelope.dekWrapIvHex, 'hex')); kekDecipher.setAuthTag(Buffer.from(envelope.dekWrapAuthTagHex, 'hex'));
    const dek = Buffer.concat([kekDecipher.update(Buffer.from(envelope.encryptedDekHex, 'hex')), kekDecipher.final()]);
    const encryptedData = backend === 'memory' ? Buffer.from(envelope.encryptedDataHex!, 'hex') : await this.getObject(envelope.storageKey!, envelope.storageBackend as 's3' | 'filesystem');
    const decipher = createDecipheriv('aes-256-gcm', dek, Buffer.from(envelope.ivHex, 'hex')); decipher.setAuthTag(Buffer.from(envelope.authTagHex, 'hex'));
    const decryptedData = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    if (createHash('sha256').update(decryptedData).digest('hex') !== envelope.sha256Hash) throw new SecurityViolationError('Document integrity hash mismatch.');
    return decryptedData;
  }

  static clear() { this.documentStore.clear(); }
}
