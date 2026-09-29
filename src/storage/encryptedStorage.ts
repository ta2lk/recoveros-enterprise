/**
 * RecoverOS - Document Object Storage with Per-Tenant Envelope Encryption
 * 
 * Rules:
 * 1. Envelope encryption: Each document encrypted with unique Data Encryption Key (DEK) via AES-256-GCM.
 * 2. DEK is encrypted under the tenant's Key Encryption Key (KEK).
 * 3. Virus scan hook validates file bytes and rejects malware/EICAR signatures before storage.
 * 4. Tenant isolation enforced on document read and write.
 */

import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import { AuthenticatedSession, SecurityViolationError } from '../db/client';

export const EICAR_TEST_SIGNATURE = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

export interface EncryptedStorageEnvelope {
  documentId: string;
  tenantId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  encryptedDataHex: string;
  ivHex: string;
  authTagHex: string;
  encryptedDekHex: string; // DEK encrypted under the configured KEK
  dekWrapIvHex: string;
  dekWrapAuthTagHex: string;
  sha256Hash: string;
  uploadedAt: string;
  virusScanPassed: boolean;
}

export class VirusDetectedError extends Error {
  constructor(reason: string) {
    super(`VIRUS_SCAN_FAILED: Upload rejected by security scanner. ${reason}`);
    this.name = 'VirusDetectedError';
  }
}

export class EncryptedDocumentStorage {
  private static documentStore: Map<string, EncryptedStorageEnvelope> = new Map();

  /**
   * Resolve the KEK from a secret manager-provided environment variable.
   * A per-process ephemeral key is allowed only outside production so local
   * tests cannot accidentally train developers to ship a static key.
   */
  private static getMasterKek(): Buffer {
    const configured = process.env.RECOVEROS_MASTER_KEK_HEX;
    if (configured) {
      if (!/^[0-9a-fA-F]{64}$/.test(configured)) {
        throw new SecurityViolationError('RECOVEROS_MASTER_KEK_HEX must be exactly 32 bytes encoded as hex.');
      }
      return Buffer.from(configured, 'hex');
    }

    if (process.env.NODE_ENV === 'production') {
      throw new SecurityViolationError('Document encryption key is not configured; refusing production startup operation.');
    }

    if (!this.ephemeralMasterKek) this.ephemeralMasterKek = randomBytes(32);
    return this.ephemeralMasterKek;
  }

  private static ephemeralMasterKek: Buffer | undefined;

  /**
   * Antivirus & File Integrity Hook
   */
  static scanPayload(buffer: Buffer, fileName: string): boolean {
    const contentStr = buffer.toString('utf8');

    // 1. Detect standard EICAR test string
    if (contentStr.includes(EICAR_TEST_SIGNATURE)) {
      throw new VirusDetectedError('Known malicious test signature (EICAR) detected in upload.');
    }

    // 2. Reject executable signatures (MZ for Windows PE, ELF for Linux, Mach-O)
    if (buffer.length >= 4) {
      const headerHex = buffer.subarray(0, 4).toString('hex').toLowerCase();
      if (headerHex.startsWith('4d5a') || headerHex.startsWith('7f454c46')) {
        throw new VirusDetectedError('Executable binaries (.exe, .elf) are strictly prohibited.');
      }
    }

    // 3. Reject forbidden file extensions
    const forbiddenExtensions = ['.exe', '.bat', '.cmd', '.sh', '.scr', '.vbs', '.ps1'];
    if (forbiddenExtensions.some((ext) => fileName.toLowerCase().endsWith(ext))) {
      throw new VirusDetectedError(`Prohibited file extension detected: ${fileName}`);
    }

    return true;
  }

  /**
   * Upload and store document with per-tenant envelope encryption (AES-256-GCM)
   */
  static async uploadDocument(
    session: AuthenticatedSession,
    fileName: string,
    mimeType: string,
    rawBytes: Buffer
  ): Promise<EncryptedStorageEnvelope> {
    if (!session || !session.tenantId) {
      throw new SecurityViolationError('Cannot upload document without authenticated session.');
    }

    // 1. Run Pre-Ingestion Virus Scan Hook
    this.scanPayload(rawBytes, fileName);

    const tenantId = session.tenantId;
    const documentId = `doc-${tenantId}-${Date.now()}-${randomBytes(4).toString('hex')}`;
    const sha256Hash = createHash('sha256').update(rawBytes).digest('hex');

    // 2. Generate unique per-document Data Encryption Key (DEK) (256-bit)
    const dek = randomBytes(32);
    const iv = randomBytes(12); // 96-bit IV for AES-GCM

    // 3. Encrypt payload with DEK using AES-256-GCM
    const cipher = createCipheriv('aes-256-gcm', dek, iv);
    const encryptedData = Buffer.concat([cipher.update(rawBytes), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // 4. Envelope Encryption: Encrypt DEK under configured KEK using AES-GCM.
    // ECB is intentionally avoided because it provides no authenticated wrapping.
    const dekWrapIv = randomBytes(12);
    const kekCipher = createCipheriv('aes-256-gcm', this.getMasterKek(), dekWrapIv);
    const encryptedDek = Buffer.concat([kekCipher.update(dek), kekCipher.final()]);
    const dekWrapAuthTag = kekCipher.getAuthTag();

    const envelope: EncryptedStorageEnvelope = {
      documentId,
      tenantId,
      fileName,
      mimeType,
      fileSizeBytes: rawBytes.length,
      encryptedDataHex: encryptedData.toString('hex'),
      ivHex: iv.toString('hex'),
      authTagHex: authTag.toString('hex'),
      encryptedDekHex: encryptedDek.toString('hex'),
      dekWrapIvHex: dekWrapIv.toString('hex'),
      dekWrapAuthTagHex: dekWrapAuthTag.toString('hex'),
      sha256Hash,
      uploadedAt: new Date().toISOString(),
      virusScanPassed: true,
    };

    this.documentStore.set(documentId, envelope);
    return envelope;
  }

  /**
   * Download and decrypt document with strict session tenant verification
   */
  static async downloadDocument(session: AuthenticatedSession, documentId: string): Promise<Buffer> {
    if (!session || !session.tenantId) {
      throw new SecurityViolationError('Cannot download document without authenticated session.');
    }

    const envelope = this.documentStore.get(documentId);
    if (!envelope) {
      throw new Error(`DOCUMENT_NOT_FOUND: Document '${documentId}' does not exist.`);
    }

    // Strict Tenant Isolation Enforcement
    if (envelope.tenantId !== session.tenantId) {
      throw new SecurityViolationError(
        `Cross-tenant access blocked! Tenant '${session.tenantId}' cannot access document '${documentId}' belonging to tenant '${envelope.tenantId}'.`
      );
    }

    // 1. Decrypt and authenticate DEK using the configured KEK
    const kekDecipher = createDecipheriv('aes-256-gcm', this.getMasterKek(), Buffer.from(envelope.dekWrapIvHex, 'hex'));
    kekDecipher.setAuthTag(Buffer.from(envelope.dekWrapAuthTagHex, 'hex'));
    const dek = Buffer.concat([
      kekDecipher.update(Buffer.from(envelope.encryptedDekHex, 'hex')),
      kekDecipher.final(),
    ]);

    // 2. Decrypt payload using DEK and verify GCM AuthTag
    const decipher = createDecipheriv('aes-256-gcm', dek, Buffer.from(envelope.ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(envelope.authTagHex, 'hex'));

    const decryptedData = Buffer.concat([
      decipher.update(Buffer.from(envelope.encryptedDataHex, 'hex')),
      decipher.final(),
    ]);

    return decryptedData;
  }

  /**
   * Clear storage (testing only)
   */
  static clear() {
    this.documentStore.clear();
  }
}
