/**
 * RecoverOS - Dynamic Evidence Completeness & Consistency Confidence Engine
 * 
 * Rules:
 * 1. Confidence must be COMPUTED from evidence completeness, consistency, and source authority.
 * 2. NO hardcoded confidence scores (e.g. 99, 100).
 */

export interface EvidenceItemForScoring {
  type: 'INVOICE' | 'PURCHASE_ORDER' | 'CONTRACT_CLAUSE' | 'PAYMENT_RECEIPT' | 'FREIGHT_BILL' | 'BANK_RECORD' | 'GOODS_RECEIPT';
  referenceNumber: string;
  sourceAuthority: 'ERP_SYSTEM_DIRECT' | 'BANK_STATEMENT_DIRECT' | 'EDI_FEED' | 'OCR_PARSED' | 'MANUAL_ENTRY';
  timestamp: string;
  documentHash?: string;
}

export interface ConsistencyCheckParam {
  supplierTaxIdMatch: boolean;
  amountReconciliationMatch: boolean;
  dateChronologyValid: boolean; // e.g., PO <= Delivery <= Invoice <= Payment
  currencyConsistent: boolean;
}

export interface ConfidenceScoreBreakdown {
  finalScore: number; // 0 - 100 integer
  completenessPoints: number; // max 40
  consistencyPoints: number; // max 40
  sourceAuthorityMultiplier: number; // 0.70 to 1.00
  reasons: string[];
}

export class ConfidenceEngine {
  /**
   * Compute dynamic confidence score based on mathematical completeness & integrity
   */
  static computeOpportunityConfidence(params: {
    category: string;
    evidenceList: EvidenceItemForScoring[];
    consistency: ConsistencyCheckParam;
  }): ConfidenceScoreBreakdown {
    const reasons: string[] = [];
    let completenessPoints = 0;
    const typesPresent = new Set(params.evidenceList.map((e) => e.type));

    // 1. Evidence Completeness (Max 40 points)
    if (typesPresent.has('INVOICE')) {
      completenessPoints += 10;
      reasons.push('+10 pts: Vendor invoice document present');
    }
    if (typesPresent.has('PURCHASE_ORDER')) {
      completenessPoints += 10;
      reasons.push('+10 pts: Contracted Purchase Order verified');
    }
    if (typesPresent.has('GOODS_RECEIPT') || typesPresent.has('FREIGHT_BILL')) {
      completenessPoints += 10;
      reasons.push('+10 pts: Physical goods receipt / bill of lading confirmed');
    }
    if (typesPresent.has('PAYMENT_RECEIPT') || typesPresent.has('BANK_RECORD')) {
      completenessPoints += 10;
      reasons.push('+10 pts: Bank disbursement / settlement proof confirmed');
    }
    if (typesPresent.has('CONTRACT_CLAUSE')) {
      // Bonus if contract clause is present for rebate/discount
      completenessPoints = Math.min(40, completenessPoints + 5);
      reasons.push('+5 pts: Specific contract clause citation attached');
    }

    // 2. Document & Mathematical Consistency (Max 40 points)
    let consistencyPoints = 0;
    if (params.consistency.supplierTaxIdMatch) {
      consistencyPoints += 10;
      reasons.push('+10 pts: Supplier tax ID and legal entity match across all documents');
    } else {
      reasons.push('-10 pts: Supplier identity mismatch or missing tax ID');
    }

    if (params.consistency.amountReconciliationMatch) {
      consistencyPoints += 15;
      reasons.push('+15 pts: Exact integer-cents reconciliation across invoice and ledger');
    } else {
      reasons.push('-15 pts: Amount mismatch between documents');
    }

    if (params.consistency.dateChronologyValid) {
      consistencyPoints += 10;
      reasons.push('+10 pts: Document chronological chain is valid (PO -> Delivery -> Invoice -> Payment)');
    } else {
      reasons.push('-10 pts: Chronological anomaly (e.g. invoice date predates PO)');
    }

    if (params.consistency.currencyConsistent) {
      consistencyPoints += 5;
      reasons.push('+5 pts: Currency uniform across all transaction documents');
    } else {
      reasons.push('-5 pts: Currency disparity requires FX translation');
    }

    // 3. Source Authority Multiplier (0.70 to 1.00)
    let minMultiplier = 1.0;
    if (params.evidenceList.length === 0) {
      minMultiplier = 0.5;
    } else {
      for (const ev of params.evidenceList) {
        let mult = 1.0;
        switch (ev.sourceAuthority) {
          case 'ERP_SYSTEM_DIRECT':
          case 'BANK_STATEMENT_DIRECT':
            mult = 1.0;
            break;
          case 'EDI_FEED':
            mult = 0.95;
            break;
          case 'OCR_PARSED':
            mult = 0.85;
            break;
          case 'MANUAL_ENTRY':
            mult = 0.70;
            break;
        }
        if (mult < minMultiplier) {
          minMultiplier = mult;
        }
      }
    }

    const baseSum = completenessPoints + consistencyPoints;
    const finalScore = Math.min(100, Math.max(0, Math.round(baseSum * minMultiplier)));

    reasons.push(`Source Authority Multiplier: ${minMultiplier.toFixed(2)} based on lowest authority document source`);

    return {
      finalScore,
      completenessPoints,
      consistencyPoints,
      sourceAuthorityMultiplier: minMultiplier,
      reasons,
    };
  }
}
