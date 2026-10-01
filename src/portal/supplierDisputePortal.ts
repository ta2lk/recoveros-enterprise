import {
  createHash,
  randomBytes,
} from 'node:crypto';
import { AuthenticatedSession, SecurityViolationError } from '../db/client';
import { AuditLogService } from '../db/auditLog';
import { EncryptedDocumentStorage } from '../storage/encryptedStorage';

export type SupplierPortalResponseAction = 'ACCEPT' | 'REJECT' | 'COUNTER_OFFER';

export interface SupplierPortalClaim {
  claimId: string;
  claimNumber: string;
  tenantId: string;
  supplierId: string;
  supplierName: string;
  amountMinor: bigint;
  currency: string;
  status: string;
}

export interface SupplierPortalSession {
  portalToken: string;
  expiresAt: number;
  claim: SupplierPortalClaim;
}

export interface SupplierPortalResponse {
  id: string;
  claimId: string;
  action: SupplierPortalResponseAction;
  reason?: string;
  counterOfferMinor?: bigint;
  documentId?: string;
  createdAt: string;
}

interface MagicLinkRecord {
  tokenHash: string;
  claim: SupplierPortalClaim;
  supplierEmail: string;
  expiresAt: number;
  redeemedAt?: number;
}

interface PortalTokenRecord {
  tokenHash: string;
  claim: SupplierPortalClaim;
  expiresAt: number;
}

export class SupplierPortalError extends Error {
  constructor(public readonly code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'SupplierPortalError';
  }
}

/**
 * Secure supplier-facing dispute channel.
 *
 * Magic links are never stored in plaintext. A link is redeemed once into a
 * short-lived portal token, which is the only credential accepted by public
 * claim endpoints. Every mutation is recorded in the tenant audit chain.
 */
export class SupplierDisputePortalService {
  private static readonly DEFAULT_LINK_TTL_MS = 24 * 60 * 60 * 1000;
  private static readonly PORTAL_SESSION_TTL_MS = 30 * 60 * 1000;
  private static magicLinks = new Map<string, MagicLinkRecord>();
  private static portalTokens = new Map<string, PortalTokenRecord>();
  private static responses = new Map<string, SupplierPortalResponse[]>();

  private static sha256(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
  }

  private static newOpaqueToken(prefix: string): string {
    return `${prefix}_${randomBytes(32).toString('base64url')}`;
  }

  private static portalSession(claim: SupplierPortalClaim, token: string): AuthenticatedSession {
    return {
      sessionId: `supplier-portal-${this.sha256(token).slice(0, 24)}`,
      userId: `supplier:${claim.supplierId}`,
      tenantId: claim.tenantId,
      role: 'Supplier Portal',
      expiresAt: Date.now() + this.PORTAL_SESSION_TTL_MS,
    };
  }

  static issueMagicLink(params: {
    operatorSession: AuthenticatedSession;
    claim: SupplierPortalClaim;
    supplierEmail: string;
    baseUrl: string;
    ttlMs?: number;
  }): { url: string; expiresAt: number } {
    if (!params.operatorSession?.tenantId || params.operatorSession.tenantId !== params.claim.tenantId) {
      throw new SecurityViolationError('Magic link tenant does not match authenticated operator tenant.');
    }
    if (!params.supplierEmail.includes('@')) {
      throw new SupplierPortalError('SUPPLIER_EMAIL_INVALID', 'A valid supplier email is required.');
    }
    const ttlMs = Math.min(Math.max(params.ttlMs ?? this.DEFAULT_LINK_TTL_MS, 5 * 60 * 1000), 7 * 24 * 60 * 60 * 1000);
    const rawToken = this.newOpaqueToken('ml');
    const expiresAt = Date.now() + ttlMs;
    this.magicLinks.set(this.sha256(rawToken), {
      tokenHash: this.sha256(rawToken),
      claim: { ...params.claim },
      supplierEmail: params.supplierEmail.toLowerCase(),
      expiresAt,
    });
    AuditLogService.appendEntry(params.operatorSession, {
      action: 'SUPPLIER_PORTAL_MAGIC_LINK_ISSUED',
      targetEntity: 'CLAIM',
      targetId: params.claim.claimId,
      payload: { supplierId: params.claim.supplierId, expiresAt },
    });
    return {
      url: `${params.baseUrl.replace(/\/$/, '')}/supplier-portal/access?token=${encodeURIComponent(rawToken)}`,
      expiresAt,
    };
  }

  static redeemMagicLink(rawToken: string): SupplierPortalSession {
    const record = this.magicLinks.get(this.sha256(rawToken || ''));
    if (!record) throw new SupplierPortalError('MAGIC_LINK_INVALID', 'Magic link is invalid or has expired.');
    if (record.redeemedAt) throw new SupplierPortalError('MAGIC_LINK_ALREADY_USED', 'Magic link has already been redeemed.');
    if (Date.now() > record.expiresAt) throw new SupplierPortalError('MAGIC_LINK_EXPIRED', 'Magic link has expired.');
    record.redeemedAt = Date.now();
    const portalToken = this.newOpaqueToken('pt');
    const expiresAt = Date.now() + this.PORTAL_SESSION_TTL_MS;
    this.portalTokens.set(this.sha256(portalToken), { tokenHash: this.sha256(portalToken), claim: { ...record.claim }, expiresAt });
    return { portalToken, expiresAt, claim: { ...record.claim } };
  }

  static authenticatePortalToken(rawToken: string, claimId: string): { claim: SupplierPortalClaim; session: AuthenticatedSession } {
    const record = this.portalTokens.get(this.sha256(rawToken || ''));
    if (!record || record.claim.claimId !== claimId) {
      throw new SupplierPortalError('PORTAL_ACCESS_DENIED', 'Portal token is not authorized for this claim.');
    }
    if (Date.now() > record.expiresAt) {
      this.portalTokens.delete(record.tokenHash);
      throw new SupplierPortalError('PORTAL_SESSION_EXPIRED', 'Supplier portal session has expired.');
    }
    return { claim: { ...record.claim }, session: this.portalSession(record.claim, rawToken) };
  }

  static respond(params: {
    portalToken: string;
    claimId: string;
    action: SupplierPortalResponseAction;
    reason?: string;
    counterOfferMinor?: bigint;
    documentId?: string;
  }): SupplierPortalResponse {
    const access = this.authenticatePortalToken(params.portalToken, params.claimId);
    if (params.action === 'REJECT' && !params.reason?.trim()) {
      throw new SupplierPortalError('REJECTION_REASON_REQUIRED', 'A rejection reason is required.');
    }
    if (params.action === 'COUNTER_OFFER' && (!params.counterOfferMinor || params.counterOfferMinor <= 0n)) {
      throw new SupplierPortalError('COUNTER_OFFER_INVALID', 'A positive counter-offer amount is required.');
    }
    const response: SupplierPortalResponse = {
      id: `supplier-response-${Date.now()}-${randomBytes(5).toString('hex')}`,
      claimId: params.claimId,
      action: params.action,
      reason: params.reason?.trim(),
      counterOfferMinor: params.counterOfferMinor,
      documentId: params.documentId,
      createdAt: new Date().toISOString(),
    };
    const prior = this.responses.get(params.claimId) || [];
    prior.push(response);
    this.responses.set(params.claimId, prior);
    AuditLogService.appendEntry(access.session, {
      action: `SUPPLIER_PORTAL_${params.action}`,
      targetEntity: 'CLAIM',
      targetId: params.claimId,
      payload: {
        responseId: response.id,
        supplierId: access.claim.supplierId,
        reason: response.reason,
        counterOfferMinor: response.counterOfferMinor?.toString(),
        documentId: response.documentId,
      },
    });
    return { ...response };
  }

  static async uploadCreditMemo(params: {
    portalToken: string;
    claimId: string;
    fileName: string;
    mimeType: string;
    base64Content: string;
  }): Promise<{ documentId: string; sha256: string; fileSizeBytes: number }> {
    const access = this.authenticatePortalToken(params.portalToken, params.claimId);
    if (!params.fileName || params.fileName.length > 255) throw new SupplierPortalError('FILE_NAME_INVALID', 'File name is invalid.');
    const rawBytes = Buffer.from(params.base64Content || '', 'base64');
    if (!rawBytes.length || rawBytes.length > 25 * 1024 * 1024) throw new SupplierPortalError('FILE_SIZE_INVALID', 'File must be between 1 byte and 25 MB.');
    const envelope = await EncryptedDocumentStorage.uploadDocument(access.session, params.fileName, params.mimeType || 'application/octet-stream', rawBytes);
    AuditLogService.appendEntry(access.session, {
      action: 'SUPPLIER_PORTAL_CREDIT_MEMO_UPLOADED',
      targetEntity: 'CLAIM',
      targetId: params.claimId,
      payload: { documentId: envelope.documentId, sha256: envelope.sha256Hash, fileName: envelope.fileName },
    });
    return { documentId: envelope.documentId, sha256: envelope.sha256Hash, fileSizeBytes: envelope.fileSizeBytes };
  }

  static listResponses(portalToken: string, claimId: string): SupplierPortalResponse[] {
    this.authenticatePortalToken(portalToken, claimId);
    return (this.responses.get(claimId) || []).map((response) => ({ ...response }));
  }

  static clear(): void {
    this.magicLinks.clear();
    this.portalTokens.clear();
    this.responses.clear();
  }
}
