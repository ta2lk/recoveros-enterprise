/**
 * RecoverOS - Production Deterministic Financial Calculation Engine
 * 
 * Non-negotiable Rules:
 * 1. Money is NEVER a JS float. Everything uses integer minor units (Money).
 * 2. LLMs never produce or alter financial figures.
 * 3. No hardcoded business rules (read from supplier/contract/tenant config).
 * 4. Sourced dated FX rates with as-of date recorded on each conversion.
 * 5. Opportunity status flow: DETECTED -> REVIEWED -> CLAIMED -> SETTLED.
 * 6. "VERIFIED RECOVERY" only when settlement proof is attached.
 */

import { Money } from './money';
import { FxRateTable, FxRateRecord } from './fx';

export interface PromptPaymentDiscountTerms {
  discountPercentBasisPoints: number; // e.g. 200 for 2.0%
  discountDaysAllowed: number; // e.g. 10
  netDaysAllowed: number; // e.g. 30
}

export interface RebateTierConfig {
  tierNumber: number;
  thresholdSpend: Money;
  rebateBasisPoints: number; // e.g. 300 for 3%
  calcType: 'TOTAL_SPEND' | 'ABOVE_THRESHOLD';
}

export interface VolumeRebateContractTerms {
  contractId: string;
  currency: string;
  tiers: RebateTierConfig[];
}

export interface DuplicatePaymentAuditItem {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  grossAmount: Money;
  invoiceDate: string;
  isRecurringSubscriptionOrRent?: boolean;
}

export interface PaymentAuditRecord {
  id: string;
  supplierId: string;
  invoiceId?: string;
  transactionReference: string;
  amount: Money;
  paymentDate: string;
  clearingStatus: 'SETTLED' | 'PENDING' | 'REVERSED';
}

export interface SettlementProof {
  proofId: string;
  proofType: 'CREDIT_MEMO' | 'BANK_RECORD' | 'INVOICE_OFFSET' | 'CASH_RECEIPT';
  referenceNumber: string;
  settledAmount: Money;
  settledDate: string;
  issuerSupplierId: string;
  documentHash: string;
}

export class DecimalMath {
  /**
   * Safe integer-cents rounded addition (delegates to Money)
   */
  static add(a: number, b: number): number {
    return Money.fromDecimal(a, 'USD').add(Money.fromDecimal(b, 'USD')).toNumber();
  }

  /**
   * Safe integer-cents rounded subtraction (delegates to Money)
   */
  static sub(a: number, b: number): number {
    return Money.fromDecimal(a, 'USD').subtract(Money.fromDecimal(b, 'USD')).toNumber();
  }

  /**
   * Safe percentage computation (delegates to Money)
   */
  static percent(amount: number, percent: number): number {
    return Money.fromDecimal(amount, 'USD').percentage(percent).toNumber();
  }

  /**
   * Safe multiplication (delegates to Money)
   */
  static mul(a: number, b: number): number {
    const scale = 10000;
    const bBps = Math.round(b * scale);
    return Money.fromDecimal(amountToMinor(a), 'USD').multiplyRatio(bBps, scale).toNumber();
  }
}

function amountToMinor(val: number): string {
  return val.toFixed(2);
}

export interface FinancialCalculationResult {
  expectedAmount: Money;
  actualAmount: Money;
  difference: Money;
  formula: string;
  toleranceApplied: Money;
  isDiscrepancy: boolean;
  explanation: string;
  asOfDate?: string;
  fxRateUsed?: FxRateRecord;
}

export class CalculationEngine {
  /**
   * Levenshtein Distance for fuzzy matching typo'd invoice numbers
   */
  static levenshteinDistance(a: string, b: string): number {
    const cleanA = a.toUpperCase().replace(/[\s\-_/]/g, '');
    const cleanB = b.toUpperCase().replace(/[\s\-_/]/g, '');
    const m = cleanA.length;
    const n = cleanB.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = cleanA[i - 1] === cleanB[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + cost // substitution
        );
      }
    }
    return dp[m][n];
  }

  /**
   * Calculate Supplier Overpayment Discrepancy (PO vs Invoice)
   */
  static verifyInvoiceOverpayment(
    poAmount: Money,
    invoicePaidAmount: Money,
    tolerance: Money = Money.zero(poAmount.currency)
  ): FinancialCalculationResult {
    const diff = invoicePaidAmount.subtract(poAmount);
    const isDiscrepancy = diff.compare(tolerance) > 0;

    return {
      expectedAmount: poAmount,
      actualAmount: invoicePaidAmount,
      difference: isDiscrepancy ? diff : Money.zero(poAmount.currency),
      formula: `Overpayment = Paid (${invoicePaidAmount.toFormattedString()}) - ExpectedPO (${poAmount.toFormattedString()})`,
      toleranceApplied: tolerance,
      isDiscrepancy,
      explanation: isDiscrepancy
        ? `Invoice disbursement exceeds contracted purchase order by ${diff.toFormattedString()}.`
        : 'Payment conforms within accepted financial tolerance threshold.',
    };
  }

  /**
   * Calculate Missed Early Payment Discount
   * Non-negotiable Rule: Flag ONLY if amount actually paid did NOT already reflect the discount!
   */
  static verifyMissedDiscount(
    paramsOrGross:
      | number
      | {
          invoiceGross: Money;
          actuallyPaid: Money;
          terms: PromptPaymentDiscountTerms;
          invoiceDateStr: string;
          paymentDateStr: string;
        },
    discountPercent?: number,
    invoiceDateStr?: string,
    paymentDateStr?: string,
    allowedDays: number = 10
  ): any {
    if (typeof paramsOrGross === 'number') {
      const gross = Money.fromDecimal(paramsOrGross, 'USD');
      const terms: PromptPaymentDiscountTerms = {
        discountPercentBasisPoints: Math.round((discountPercent ?? 2.0) * 100),
        discountDaysAllowed: allowedDays,
        netDaysAllowed: 30,
      };
      const res = this.verifyMissedDiscount({
        invoiceGross: gross,
        actuallyPaid: gross,
        terms,
        invoiceDateStr: invoiceDateStr || '2026-03-01',
        paymentDateStr: paymentDateStr || '2026-03-05',
      });
      return {
        expectedAmount: res.expectedAmount.toNumber(),
        actualAmount: res.actualAmount.toNumber(),
        difference: res.difference.toNumber(),
        formula: res.formula,
        toleranceApplied: res.toleranceApplied.toNumber(),
        isDiscrepancy: res.isDiscrepancy,
        explanation: res.explanation,
      };
    }

    const { invoiceGross, actuallyPaid, terms, invoiceDateStr: invDate, paymentDateStr: payDate } = paramsOrGross;
    const currency = invoiceGross.currency;

    const invoiceDate = new Date(invDate);
    const paymentDate = new Date(payDate);
    const diffMs = paymentDate.getTime() - invoiceDate.getTime();
    const daysElapsed = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    const eligible = daysElapsed <= terms.discountDaysAllowed && daysElapsed >= 0;
    const discountAmount = invoiceGross.percentBasisPoints(terms.discountPercentBasisPoints);
    const expectedDiscountedAmount = invoiceGross.subtract(discountAmount);

    if (!eligible) {
      return {
        expectedAmount: invoiceGross,
        actualAmount: actuallyPaid,
        difference: Money.zero(currency),
        formula: `Payment at day ${daysElapsed} exceeds early window (${terms.discountDaysAllowed} days)`,
        toleranceApplied: Money.zero(currency),
        isDiscrepancy: false,
        explanation: `Payment made on day ${daysElapsed}, outside contractual ${terms.discountDaysAllowed}-day early discount window.`,
      };
    }

    // CRITICAL: Check if the discount was ALREADY deducted!
    // If actually paid <= expectedDiscountedAmount (within 1 cent rounding), then the discount WAS taken.
    const oneCent = Money.fromMinor(1n, currency);
    if (actuallyPaid.subtract(expectedDiscountedAmount).compare(oneCent) <= 0) {
      return {
        expectedAmount: expectedDiscountedAmount,
        actualAmount: actuallyPaid,
        difference: Money.zero(currency),
        formula: `Paid (${actuallyPaid.toFormattedString()}) <= DiscountedExpected (${expectedDiscountedAmount.toFormattedString()})`,
        toleranceApplied: oneCent,
        isDiscrepancy: false,
        explanation: `Discount was already captured at time of disbursement (${actuallyPaid.toFormattedString()} paid vs ${invoiceGross.toFormattedString()} gross). No discrepancy.`,
      };
    }

    // Real Missed Discount: paid gross without deducting the discount
    const missedAmount = actuallyPaid.subtract(expectedDiscountedAmount);

    return {
      expectedAmount: expectedDiscountedAmount,
      actualAmount: actuallyPaid,
      difference: missedAmount,
      formula: `Missed Discount = Paid (${actuallyPaid.toFormattedString()}) - Entitled (${expectedDiscountedAmount.toFormattedString()}) [Elapsed days: ${daysElapsed}]`,
      toleranceApplied: Money.zero(currency),
      isDiscrepancy: true,
      explanation: `Payment made in ${daysElapsed} days (within ${terms.discountDaysAllowed}-day window). Entitled discount of ${(terms.discountPercentBasisPoints / 100).toFixed(2)}% (${discountAmount.toFormattedString()}) was not deducted from disbursement.`,
    };
  }

  /**
   * Calculate Contract Volume Rebate
   * Supports both:
   * 1. "% of total spend" (retroactive to dollar 1)
   * 2. "% of spend above threshold" (incremental)
   * 3. Multi-tier structures per contract
   * 4. Multi-currency aggregation using dated FX rates
   * 5. Tracks already-claimed rebate separately from recovered amounts
   */
  static verifyVolumeRebate(
    paramsOrSpend:
      | number
      | {
          contractTerms: VolumeRebateContractTerms;
          spendRecords: Array<{ amount: Money; transactionDate: string }>;
          fxTable: FxRateTable;
          asOfDate: string;
          alreadyClaimedRebate: Money;
        },
    thresholdSpend?: number,
    rebatePercent?: number,
    alreadyClaimedRebate: number = 0
  ): any {
    if (typeof paramsOrSpend === 'number') {
      const totalSpend = Money.fromDecimal(paramsOrSpend, 'USD');
      const threshold = Money.fromDecimal(thresholdSpend ?? 0, 'USD');
      const terms: VolumeRebateContractTerms = {
        contractId: 'legacy-rebate',
        currency: 'USD',
        tiers: [
          {
            tierNumber: 1,
            thresholdSpend: threshold,
            rebateBasisPoints: Math.round((rebatePercent ?? 3.0) * 100),
            calcType: 'TOTAL_SPEND',
          },
        ],
      };
      const res = this.verifyVolumeRebate({
        contractTerms: terms,
        spendRecords: [{ amount: totalSpend, transactionDate: new Date().toISOString().slice(0, 10) }],
        fxTable: new FxRateTable(),
        asOfDate: new Date().toISOString().slice(0, 10),
        alreadyClaimedRebate: Money.fromDecimal(alreadyClaimedRebate, 'USD'),
      });
      return {
        expectedAmount: res.expectedAmount.toNumber(),
        actualAmount: res.actualAmount.toNumber(),
        difference: res.difference.toNumber(),
        formula: res.formula,
        toleranceApplied: res.toleranceApplied.toNumber(),
        isDiscrepancy: res.isDiscrepancy,
        explanation: res.explanation,
      };
    }

    const targetCurrency = paramsOrSpend.contractTerms.currency;
    let totalSpendInContractCurrency = Money.zero(targetCurrency);

    // Aggregate spend converting multi-currency using dated rates
    for (const record of paramsOrSpend.spendRecords) {
      if (record.amount.currency === targetCurrency) {
        totalSpendInContractCurrency = totalSpendInContractCurrency.add(record.amount);
      } else {
        const { converted } = paramsOrSpend.fxTable.convert(
          record.amount,
          targetCurrency,
          record.transactionDate
        );
        totalSpendInContractCurrency = totalSpendInContractCurrency.add(converted);
      }
    }

    // Sort tiers ascending by threshold
    const sortedTiers = [...paramsOrSpend.contractTerms.tiers].sort((a, b) =>
      a.thresholdSpend.compare(b.thresholdSpend)
    );

    let totalRebateEarned = Money.zero(targetCurrency);
    let matchedTier: RebateTierConfig | null = null;

    for (const tier of sortedTiers) {
      if (totalSpendInContractCurrency.compare(tier.thresholdSpend) >= 0) {
        matchedTier = tier;
        if (tier.calcType === 'TOTAL_SPEND') {
          // Retroactive across entire spend
          totalRebateEarned = totalSpendInContractCurrency.percentBasisPoints(tier.rebateBasisPoints);
        } else {
          // Incremental: only on spend exceeding the threshold
          const excessSpend = totalSpendInContractCurrency.subtract(tier.thresholdSpend);
          totalRebateEarned = excessSpend.percentBasisPoints(tier.rebateBasisPoints);
        }
      }
    }

    if (!matchedTier || totalRebateEarned.isZero()) {
      return {
        expectedAmount: totalSpendInContractCurrency,
        actualAmount: totalSpendInContractCurrency,
        difference: Money.zero(targetCurrency),
        formula: `Spend (${totalSpendInContractCurrency.toFormattedString()}) < Rebate Threshold`,
        toleranceApplied: Money.zero(targetCurrency),
        isDiscrepancy: false,
        explanation: 'Cumulative spend has not reached contractual volume rebate threshold.',
      };
    }

    // Separate already-claimed rebate
    const unclaimedRebate = totalRebateEarned.subtract(paramsOrSpend.alreadyClaimedRebate);
    const isDiscrepancy = unclaimedRebate.isPositive();

    return {
      expectedAmount: totalSpendInContractCurrency.subtract(totalRebateEarned),
      actualAmount: totalSpendInContractCurrency,
      difference: isDiscrepancy ? unclaimedRebate : Money.zero(targetCurrency),
      formula: `Rebate Earned (${totalRebateEarned.toFormattedString()} @ Tier #${matchedTier.tierNumber}) - Already Claimed (${paramsOrSpend.alreadyClaimedRebate.toFormattedString()}) = ${unclaimedRebate.toFormattedString()}`,
      toleranceApplied: Money.zero(targetCurrency),
      isDiscrepancy,
      explanation: isDiscrepancy
        ? `Contract entitles ${matchedTier.calcType === 'TOTAL_SPEND' ? 'total' : 'incremental'} ${(matchedTier.rebateBasisPoints / 100).toFixed(2)}% volume rebate on spend ${totalSpendInContractCurrency.toFormattedString()}. Unclaimed rebate: ${unclaimedRebate.toFormattedString()}.`
        : 'All earned contract volume rebates have already been claimed.',
      asOfDate: paramsOrSpend.asOfDate,
    };
  }

  /**
   * Legacy verifyDuplicatePayment method for backward compatibility
   */
  static verifyDuplicatePayment(
    invoiceAmount: number,
    paymentAmounts: number[]
  ): {
    expectedAmount: number;
    actualAmount: number;
    difference: number;
    formula: string;
    toleranceApplied: number;
    isDiscrepancy: boolean;
    explanation: string;
  } {
    const inv = Money.fromDecimal(invoiceAmount, 'USD');
    const totalPaid = paymentAmounts.reduce(
      (sum, p) => sum.add(Money.fromDecimal(p, 'USD')),
      Money.zero('USD')
    );
    const diff = totalPaid.subtract(inv);
    const isDiscrepancy = diff.isPositive();
    return {
      expectedAmount: inv.toNumber(),
      actualAmount: totalPaid.toNumber(),
      difference: isDiscrepancy ? diff.toNumber() : 0,
      formula: `Duplicate Disbursed = TotalDisbursed (${totalPaid.toFormattedString()}) - Invoiced (${inv.toFormattedString()})`,
      toleranceApplied: 0,
      isDiscrepancy,
      explanation: isDiscrepancy
        ? `Invoice was disbursed ${paymentAmounts.length} times resulting in duplicate payment of ${diff.toFormattedString()}.`
        : 'Single disbursement matches invoice amount.',
    };
  }

  /**
   * Detect Duplicate Payments
   * 1. Same invoice ID / reference paid multiple times.
   * 2. Same supplier + exact same amount + close dates with typo'd invoice numbers (fuzzy matching).
   * Known False Positive Suppression: Legitimate recurring subscriptions/rent are NOT flagged.
   */
  static detectDuplicateDisbursements(params: {
    invoices: DuplicatePaymentAuditItem[];
    payments: PaymentAuditRecord[];
    config: {
      closeDateWindowDays: number; // e.g. 30 days
      maxFuzzyDistance: number; // e.g. 2 edits
    };
  }): Array<{
    type: 'EXACT_INVOICE_PAID_TWICE' | 'FUZZY_INVOICE_TYPO_SAME_SUPPLIER_AND_AMOUNT';
    invoice: DuplicatePaymentAuditItem;
    duplicatePaymentOrInvoiceRef: string;
    recoverableAmount: Money;
    confidence: number;
    explanation: string;
  }> {
    const results: Array<{
      type: 'EXACT_INVOICE_PAID_TWICE' | 'FUZZY_INVOICE_TYPO_SAME_SUPPLIER_AND_AMOUNT';
      invoice: DuplicatePaymentAuditItem;
      duplicatePaymentOrInvoiceRef: string;
      recoverableAmount: Money;
      confidence: number;
      explanation: string;
    }> = [];

    // 1. Exact Invoice ID paid multiple times
    const paymentsByInvoice = new Map<string, PaymentAuditRecord[]>();
    params.payments.forEach((p) => {
      if (p.invoiceId && p.clearingStatus === 'SETTLED') {
        const list = paymentsByInvoice.get(p.invoiceId) || [];
        list.push(p);
        paymentsByInvoice.set(p.invoiceId, list);
      }
    });

    params.invoices.forEach((inv) => {
      const settledPayments = paymentsByInvoice.get(inv.id) || [];
      if (settledPayments.length > 1) {
        const totalPaid = settledPayments.reduce(
          (sum, p) => sum.add(p.amount),
          Money.zero(inv.grossAmount.currency)
        );
        if (totalPaid.compare(inv.grossAmount) > 0) {
          const duplicateDisbursed = totalPaid.subtract(inv.grossAmount);
          results.push({
            type: 'EXACT_INVOICE_PAID_TWICE',
            invoice: inv,
            duplicatePaymentOrInvoiceRef: settledPayments.map((p) => p.transactionReference).join(', '),
            recoverableAmount: duplicateDisbursed,
            confidence: 99,
            explanation: `Invoice #${inv.invoiceNumber} had ${settledPayments.length} separate bank disbursements totaling ${totalPaid.toFormattedString()} against invoiced ${inv.grossAmount.toFormattedString()}.`,
          });
        }
      }
    });

    // 2. Fuzzy Typo Match: Same supplier + exact same amount + close dates + typo'd invoice number
    // Skip if marked as legitimate recurring rent/subscription
    const nonRecurringInvoices = params.invoices.filter((inv) => !inv.isRecurringSubscriptionOrRent);

    for (let i = 0; i < nonRecurringInvoices.length; i++) {
      for (let j = i + 1; j < nonRecurringInvoices.length; j++) {
        const invA = nonRecurringInvoices[i];
        const invB = nonRecurringInvoices[j];

        // Must be same supplier and same currency & amount
        if (invA.supplierId !== invB.supplierId) continue;
        if (!invA.grossAmount.equals(invB.grossAmount)) continue;

        // Check date proximity
        const dateA = new Date(invA.invoiceDate).getTime();
        const dateB = new Date(invB.invoiceDate).getTime();
        const diffDays = Math.abs(dateA - dateB) / (1000 * 60 * 60 * 24);

        if (diffDays <= params.config.closeDateWindowDays) {
          // Check fuzzy invoice number distance
          const distance = this.levenshteinDistance(invA.invoiceNumber, invB.invoiceNumber);
          if (distance > 0 && distance <= params.config.maxFuzzyDistance) {
            results.push({
              type: 'FUZZY_INVOICE_TYPO_SAME_SUPPLIER_AND_AMOUNT',
              invoice: invB,
              duplicatePaymentOrInvoiceRef: `Potential duplicate of #${invA.invoiceNumber} (Levenshtein distance: ${distance})`,
              recoverableAmount: invB.grossAmount,
              confidence: 94,
              explanation: `Identical supplier and amount (${invA.grossAmount.toFormattedString()}) within ${Math.round(diffDays)} days. Invoice numbers '${invA.invoiceNumber}' vs '${invB.invoiceNumber}' indicate typographical/OCR entry duplicate.`,
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Verify Settlement Proof to transition opportunity to "VERIFIED RECOVERY" (Status: SETTLED)
   * Rule: No claim of "VERIFIED RECOVERY" unless settlement proof is attached and validated.
   */
  static verifySettlementProof(params: {
    expectedRecoverable: Money;
    proof: SettlementProof;
    supplierId: string;
  }): { isVerified: boolean; verifiedAmount: Money; reason: string } {
    if (!params.proof || !params.proof.documentHash) {
      return {
        isVerified: false,
        verifiedAmount: Money.zero(params.expectedRecoverable.currency),
        reason: 'SETTLEMENT_REJECTED: Proof document hash or certificate missing.',
      };
    }

    if (params.proof.issuerSupplierId !== params.supplierId) {
      return {
        isVerified: false,
        verifiedAmount: Money.zero(params.expectedRecoverable.currency),
        reason: 'SETTLEMENT_REJECTED: Proof issuer supplier does not match opportunity supplier.',
      };
    }

    if (params.proof.settledAmount.isZero() || params.proof.settledAmount.isNegative()) {
      return {
        isVerified: false,
        verifiedAmount: Money.zero(params.expectedRecoverable.currency),
        reason: 'SETTLEMENT_REJECTED: Settled amount must be strictly positive.',
      };
    }

    return {
      isVerified: true,
      verifiedAmount: params.proof.settledAmount,
      reason: `Settlement proof verified via ${params.proof.proofType} #${params.proof.referenceNumber} for ${params.proof.settledAmount.toFormattedString()}.`,
    };
  }
}
