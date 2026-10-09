import { createHash, randomBytes } from 'node:crypto';
import { AuthenticatedSession, SecurityViolationError } from '../db/client';
import { AuditLogService } from '../db/auditLog';

export interface SettlementSigner {
  name: string;
  email: string;
  role: string;
  signedAt: string;
  signatureHash: string;
  ipAddress?: string;
}

export interface SettlementAgreement {
  id: string;
  tenantId: string;
  claimId: string;
  claimNumber: string;
  supplierId: string;
  supplierName: string;
  creditorName: string;
  originalDiscrepancyAmountMinor: bigint;
  settledAmountMinor: bigint;
  currency: string;
  resolutionType: 'FULL_ACCEPTANCE' | 'COUNTER_OFFER_ACCEPTED' | 'MUTUAL_RELEASE';
  status: 'DRAFT' | 'EXECUTED' | 'DISPUTED';
  agreementDate: string;
  canonicalText: string;
  documentSha256: string;
  linkedAuditBlockHash: string;
  creditorSigner: SettlementSigner;
  supplierSigner?: SettlementSigner;
}

export class SettlementAgreementService {
  private static agreements: Map<string, SettlementAgreement> = new Map();

  private static sha256(text: string): string {
    return createHash('sha256').update(text, 'utf8').digest('hex');
  }

  private static formatMinorToCurrency(amountMinor: bigint, currency: string): string {
    const units = Number(amountMinor) / 100;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(units);
  }

  /**
   * Compose canonical legal text of mutual settlement agreement.
   */
  static composeCanonicalText(params: {
    agreementId: string;
    claimNumber: string;
    creditorName: string;
    supplierName: string;
    originalAmountMinor: bigint;
    settledAmountMinor: bigint;
    currency: string;
    resolutionType: string;
    agreementDate: string;
  }): string {
    const originalFormatted = this.formatMinorToCurrency(params.originalAmountMinor, params.currency);
    const settledFormatted = this.formatMinorToCurrency(params.settledAmountMinor, params.currency);

    return [
      `=== RECOVEROS OFFICIAL SETTLEMENT & MUTUAL RELEASE AGREEMENT ===`,
      `Agreement ID: ${params.agreementId}`,
      `Date of Execution: ${params.agreementDate}`,
      `Claim Reference: ${params.claimNumber}`,
      ``,
      `1. PARTIES:`,
      `   Creditor / Enterprise: ${params.creditorName}`,
      `   Debtor / Supplier:    ${params.supplierName}`,
      ``,
      `2. FINANCIAL TERMS & RECONCILIATION:`,
      `   Original Audit Discrepancy Amount: ${originalFormatted} (${params.originalAmountMinor} minor units)`,
      `   Agreed Net Settlement Amount:     ${settledFormatted} (${params.settledAmountMinor} minor units)`,
      `   Currency:                         ${params.currency}`,
      `   Resolution Classification:        ${params.resolutionType}`,
      ``,
      `3. MUTUAL RELEASE & FINALITY:`,
      `   Upon execution and receipt of the agreed credit memo or payment offset,`,
      `   both Parties irrevocably agree that Claim ${params.claimNumber} shall be deemed fully`,
      `   satisfied and discharged. Neither Party shall assert further claims arising from`,
      `   the specific audited invoice discrepancies referenced herein.`,
      ``,
      `4. CRYPTOGRAPHIC VERIFICATION & AUDIT LINKAGE:`,
      `   This document is cryptographically anchored into the RecoverOS hash-chained audit ledger.`,
      `================================================================`,
    ].join('\n');
  }

  /**
   * Generate an official Settlement Agreement for an accepted or negotiated claim.
   */
  static generateAgreement(
    session: AuthenticatedSession,
    params: {
      claimId: string;
      claimNumber: string;
      supplierId: string;
      supplierName: string;
      creditorName?: string;
      originalDiscrepancyAmountMinor: bigint;
      settledAmountMinor: bigint;
      currency: string;
      resolutionType?: 'FULL_ACCEPTANCE' | 'COUNTER_OFFER_ACCEPTED' | 'MUTUAL_RELEASE';
    }
  ): SettlementAgreement {
    if (!session.tenantId) {
      throw new SecurityViolationError('Tenant context required to generate settlement agreement.');
    }

    const agreementId = `agr_${Date.now()}_${randomBytes(6).toString('hex')}`;
    const agreementDate = new Date().toISOString();
    const creditorName = params.creditorName || 'RecoverOS Enterprise Client';
    const resolutionType = params.resolutionType || 'FULL_ACCEPTANCE';

    const canonicalText = this.composeCanonicalText({
      agreementId,
      claimNumber: params.claimNumber,
      creditorName,
      supplierName: params.supplierName,
      originalAmountMinor: params.originalDiscrepancyAmountMinor,
      settledAmountMinor: params.settledAmountMinor,
      currency: params.currency,
      resolutionType,
      agreementDate,
    });

    const documentSha256 = this.sha256(canonicalText);

    // Get current audit head hash to bind document to blockchain ledger
    const auditChainStatus = AuditLogService.verifyChainIntegrity(session.tenantId);
    const linkedAuditBlockHash = auditChainStatus.latestHash;

    const creditorSignatureHash = this.sha256(`${session.userId}:${session.role}:${documentSha256}:${agreementDate}`);

    const agreement: SettlementAgreement = {
      id: agreementId,
      tenantId: session.tenantId,
      claimId: params.claimId,
      claimNumber: params.claimNumber,
      supplierId: params.supplierId,
      supplierName: params.supplierName,
      creditorName,
      originalDiscrepancyAmountMinor: params.originalDiscrepancyAmountMinor,
      settledAmountMinor: params.settledAmountMinor,
      currency: params.currency,
      resolutionType,
      status: 'DRAFT',
      agreementDate,
      canonicalText,
      documentSha256,
      linkedAuditBlockHash,
      creditorSigner: {
        name: session.userId,
        email: `${session.userId}@enterprise.internal`,
        role: session.role,
        signedAt: agreementDate,
        signatureHash: creditorSignatureHash,
      },
    };

    this.agreements.set(agreementId, agreement);

    AuditLogService.appendEntry(session, {
      action: 'SETTLEMENT_AGREEMENT_GENERATED',
      targetEntity: 'CLAIM',
      targetId: params.claimId,
      payload: {
        agreementId,
        documentSha256,
        settledAmountMinor: params.settledAmountMinor.toString(),
        linkedAuditBlockHash,
      },
    });

    return { ...agreement };
  }

  /**
   * Record Supplier Electronic Signature on the Settlement Agreement.
   */
  static signSupplierAgreement(params: {
    agreementId: string;
    supplierEmail: string;
    supplierSignerName: string;
    ipAddress?: string;
  }): SettlementAgreement {
    const agreement = this.agreements.get(params.agreementId);
    if (!agreement) {
      throw new Error(`AGREEMENT_NOT_FOUND: Agreement with id ${params.agreementId} not found.`);
    }

    if (agreement.status === 'EXECUTED') {
      return { ...agreement };
    }

    const signedAt = new Date().toISOString();
    const signatureHash = this.sha256(
      `${params.supplierEmail}:${params.supplierSignerName}:${agreement.documentSha256}:${signedAt}`
    );

    agreement.supplierSigner = {
      name: params.supplierSignerName,
      email: params.supplierEmail,
      role: 'Authorized Supplier Representative',
      signedAt,
      signatureHash,
      ipAddress: params.ipAddress || '127.0.0.1',
    };

    agreement.status = 'EXECUTED';
    this.agreements.set(params.agreementId, agreement);

    return { ...agreement };
  }

  /**
   * Retrieve agreement by ID.
   */
  static getAgreement(tenantId: string, agreementId: string): SettlementAgreement | undefined {
    const ag = this.agreements.get(agreementId);
    if (!ag || ag.tenantId !== tenantId) return undefined;
    return { ...ag };
  }

  /**
   * Find agreement by Claim ID.
   */
  static findAgreementByClaimId(tenantId: string, claimId: string): SettlementAgreement | undefined {
    for (const ag of this.agreements.values()) {
      if (ag.tenantId === tenantId && ag.claimId === claimId) {
        return { ...ag };
      }
    }
    return undefined;
  }

  /**
   * Mathematically verify the agreement has not been altered or tampered with.
   */
  static verifyAgreementIntegrity(agreement: SettlementAgreement): {
    isValid: boolean;
    computedHash: string;
    recordedHash: string;
    isFullyExecuted: boolean;
  } {
    const computedHash = this.sha256(agreement.canonicalText);
    const isValid = computedHash === agreement.documentSha256;
    const isFullyExecuted = agreement.status === 'EXECUTED' && !!agreement.supplierSigner;

    return {
      isValid,
      computedHash,
      recordedHash: agreement.documentSha256,
      isFullyExecuted,
    };
  }

  static clear(): void {
    this.agreements.clear();
  }
}
