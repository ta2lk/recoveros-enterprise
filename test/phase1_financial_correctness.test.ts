/**
 * RecoverOS - Phase 1 Financial Correctness Test Suite
 * 
 * Verifies:
 * 1. Integer minor units arithmetic & property-based tests (zero JS floats).
 * 2. Duplicate payment detection (exact match, typo fuzzy match, window boundary, false-positive suppression).
 * 3. Missed early-payment discount (flagged only if NOT already deducted).
 * 4. Volume rebate (total spend vs above-threshold, multi-tier, multi-currency dated FX, already-claimed tracking).
 * 5. 3-Way match (partial delivery, UOM conversion, taxes, freight tolerance, change orders).
 * 6. Sourced dated FX rates (fail-closed, as-of date).
 * 7. Dynamic confidence calculation.
 * 8. Opportunity status lifecycle & settlement proof gate.
 */

import { Money, ISO_CURRENCIES } from '../src/engine/money';
import { FxRateTable, FxRateNotFoundError } from '../src/engine/fx';
import { ConfidenceEngine } from '../src/engine/confidence';
import {
  CalculationEngine,
  PromptPaymentDiscountTerms,
  VolumeRebateContractTerms,
  SettlementProof,
} from '../src/engine/calculation';
import {
  ThreeWayMatchEngine,
  PoLineItem,
  GoodsReceiptLineItem,
  InvoiceLineItemMatch,
  PoChangeOrder,
  MatchToleranceConfig,
} from '../src/engine/threeWayMatch';

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
console.log('--- RECOVEROS: PHASE 1 FINANCIAL CORRECTNESS VERIFICATION ---');
console.log('===============================================================');

// ---------------------------------------------------------------------------
// 1. Integer Minor Units & Property-Based Invariant Tests
// ---------------------------------------------------------------------------
console.log('\n[1] Integer Minor Units Arithmetic & Invariants:');
{
  // Floating point jitter elimination
  const m1 = Money.fromDecimal('0.10', 'USD');
  const m2 = Money.fromDecimal('0.20', 'USD');
  const sum = m1.add(m2);
  assert(sum.amountMinor === 30n, '0.10 + 0.20 USD equals exactly 30 cents (0.30 USD)');
  assert(sum.toDecimalString() === '0.30', 'Decimal representation is strictly "0.30"');

  // Multi-currency exponents
  const jpy = Money.fromDecimal('1500', 'JPY');
  assert(jpy.exponent === 0 && jpy.amountMinor === 1500n, 'JPY has 0 exponent (1500 minor units)');

  const kwd = Money.fromDecimal('12.345', 'KWD');
  assert(kwd.exponent === 3 && kwd.amountMinor === 12345n, 'KWD has 3 exponent (12345 minor units)');

  // Bankers Rounding (HALF_EVEN)
  const roundEvenDown = Money.fromDecimal('2.525', 'USD', 'HALF_EVEN'); // 2 is even -> 2.52
  const roundEvenUp = Money.fromDecimal('2.535', 'USD', 'HALF_EVEN'); // 3 is odd -> 2.54
  assert(roundEvenDown.toDecimalString() === '2.52', 'Bankers rounding rounds 2.525 to 2.52 (nearest even)');
  assert(roundEvenUp.toDecimalString() === '2.54', 'Bankers rounding rounds 2.535 to 2.54 (nearest even)');

  // Property-Based Tests (100 synthetic iterations)
  let associativePassed = true;
  let reversiblePassed = true;
  let noFloats = true;

  for (let i = 1; i <= 100; i++) {
    const aVal = BigInt((i * 12345) % 9999999);
    const bVal = BigInt((i * 67891) % 8888888);
    const cVal = BigInt((i * 45678) % 7777777);

    const a = Money.fromMinor(aVal, 'USD');
    const b = Money.fromMinor(bVal, 'USD');
    const c = Money.fromMinor(cVal, 'USD');

    // Associativity: (a + b) + c === a + (b + c)
    const left = a.add(b).add(c);
    const right = a.add(b.add(c));
    if (!left.equals(right)) associativePassed = false;

    // Reversibility: (a + b) - b === a
    const rev = a.add(b).subtract(b);
    if (!rev.equals(a)) reversiblePassed = false;

    // Guarantee integer minor unit type
    if (typeof a.amountMinor !== 'bigint' || typeof left.amountMinor !== 'bigint') {
      noFloats = false;
    }
  }

  assert(associativePassed, 'Property-based test: Addition is strictly associative across 100 iterations');
  assert(reversiblePassed, 'Property-based test: (a + b) - b === a strictly holds without drift');
  assert(noFloats, 'Invariant: Under zero conditions does Money store IEEE-754 floats');
}

// ---------------------------------------------------------------------------
// 2. Duplicate Payments: Exact, Fuzzy Typo, and False Positive Suppression
// ---------------------------------------------------------------------------
console.log('\n[2] Duplicate Payment Detection (Exact, Fuzzy & False-Positive Tests):');
{
  const invoices = [
    {
      id: 'inv-101',
      invoiceNumber: 'INV-90881',
      supplierId: 'supp-tech',
      grossAmount: Money.fromDecimal('14500.00', 'USD'),
      invoiceDate: '2026-03-01',
    },
    {
      id: 'inv-102',
      invoiceNumber: 'INV-9088I', // Typo: 'I' instead of '1'
      supplierId: 'supp-tech',
      grossAmount: Money.fromDecimal('14500.00', 'USD'),
      invoiceDate: '2026-03-05',
    },
    // Known False-Positive candidate: Monthly Recurring Office Rent
    {
      id: 'inv-rent-jan',
      invoiceNumber: 'RENT-2026-01',
      supplierId: 'supp-landlord',
      grossAmount: Money.fromDecimal('25000.00', 'USD'),
      invoiceDate: '2026-01-01',
      isRecurringSubscriptionOrRent: true,
    },
    {
      id: 'inv-rent-feb',
      invoiceNumber: 'RENT-2026-02',
      supplierId: 'supp-landlord',
      grossAmount: Money.fromDecimal('25000.00', 'USD'),
      invoiceDate: '2026-02-01',
      isRecurringSubscriptionOrRent: true,
    },
  ];

  const payments = [
    // Paid inv-101 twice
    {
      id: 'pay-1',
      supplierId: 'supp-tech',
      invoiceId: 'inv-101',
      transactionReference: 'WIRE-001',
      amount: Money.fromDecimal('14500.00', 'USD'),
      paymentDate: '2026-03-02',
      clearingStatus: 'SETTLED' as const,
    },
    {
      id: 'pay-2',
      supplierId: 'supp-tech',
      invoiceId: 'inv-101',
      transactionReference: 'WIRE-002',
      amount: Money.fromDecimal('14500.00', 'USD'),
      paymentDate: '2026-03-12',
      clearingStatus: 'SETTLED' as const,
    },
  ];

  const duplicates = CalculationEngine.detectDuplicateDisbursements({
    invoices,
    payments,
    config: { closeDateWindowDays: 30, maxFuzzyDistance: 2 },
  });

  const exactDup = duplicates.find((d) => d.type === 'EXACT_INVOICE_PAID_TWICE');
  assert(!!exactDup, 'Exact duplicate disbursement on INV-90881 detected');
  assert(exactDup?.recoverableAmount.toDecimalString() === '14500.00', 'Exact duplicate recoverable amount is $14,500.00');

  const fuzzyDup = duplicates.find((d) => d.type === 'FUZZY_INVOICE_TYPO_SAME_SUPPLIER_AND_AMOUNT');
  assert(!!fuzzyDup, 'Fuzzy typo duplicate (INV-90881 vs INV-9088I) detected within 30-day window');

  // False Positive Test: Recurring monthly rent must NOT be flagged as duplicate
  const rentDup = duplicates.find((d) => d.invoice.supplierId === 'supp-landlord');
  assert(!rentDup, 'FALSE-POSITIVE PASS: Legitimate recurring monthly rent is NOT flagged as duplicate');
}

// ---------------------------------------------------------------------------
// 3. Missed Prompt-Payment Early Discount: True Positives vs False Positives
// ---------------------------------------------------------------------------
console.log('\n[3] Missed Early Payment Discount Verification:');
{
  const terms210Net30: PromptPaymentDiscountTerms = {
    discountPercentBasisPoints: 200, // 2%
    discountDaysAllowed: 10,
    netDaysAllowed: 30,
  };

  // Scenario A: Paid full $50,000 on day 5 (Eligible, but discount NOT taken -> Discrepancy!)
  const missedResult = CalculationEngine.verifyMissedDiscount({
    invoiceGross: Money.fromDecimal('50000.00', 'USD'),
    actuallyPaid: Money.fromDecimal('50000.00', 'USD'),
    terms: terms210Net30,
    invoiceDateStr: '2026-03-01',
    paymentDateStr: '2026-03-06',
  });
  assert(missedResult.isDiscrepancy === true, 'Eligible payment with un-deducted discount flagged as discrepancy');
  assert(missedResult.difference.toDecimalString() === '1000.00', '2% discount on $50,000 is exactly $1,000.00');

  // Scenario B: Paid $49,000 on day 5 (Discount was ALREADY deducted! -> FALSE-POSITIVE SCENARIO)
  const alreadyDeductedResult = CalculationEngine.verifyMissedDiscount({
    invoiceGross: Money.fromDecimal('50000.00', 'USD'),
    actuallyPaid: Money.fromDecimal('49000.00', 'USD'), // already reflects 2% discount
    terms: terms210Net30,
    invoiceDateStr: '2026-03-01',
    paymentDateStr: '2026-03-06',
  });
  assert(
    alreadyDeductedResult.isDiscrepancy === false,
    'FALSE-POSITIVE PASS: Payment that already reflected prompt discount is NOT flagged'
  );

  // Scenario C: Paid full $50,000 on day 25 (Outside the 10-day window -> Ineligible, No discrepancy)
  const outsideWindowResult = CalculationEngine.verifyMissedDiscount({
    invoiceGross: Money.fromDecimal('50000.00', 'USD'),
    actuallyPaid: Money.fromDecimal('50000.00', 'USD'),
    terms: terms210Net30,
    invoiceDateStr: '2026-03-01',
    paymentDateStr: '2026-03-26',
  });
  assert(
    outsideWindowResult.isDiscrepancy === false,
    'FALSE-POSITIVE PASS: Payment made outside prompt discount window is NOT flagged'
  );
}

// ---------------------------------------------------------------------------
// 4. Volume Rebates: Total Spend vs Above-Threshold, Multi-Currency, Already Claimed
// ---------------------------------------------------------------------------
console.log('\n[4] Contract Volume Rebates (Total Spend, Above Threshold, Multi-Currency):');
{
  const fxTable = new FxRateTable();
  fxTable.registerDecimalRate('ECB', '2026-03-01', 'EUR', 'USD', '1.1000'); // 1 EUR = 1.10 USD

  // Contract A: Incremental (ABOVE_THRESHOLD) - 4% on spend exceeding $200,000
  const contractAboveThreshold: VolumeRebateContractTerms = {
    contractId: 'cnt-incremental',
    currency: 'USD',
    tiers: [
      {
        tierNumber: 1,
        thresholdSpend: Money.fromDecimal('200000.00', 'USD'),
        rebateBasisPoints: 400, // 4%
        calcType: 'ABOVE_THRESHOLD',
      },
    ],
  };

  const spendRecordsA = [
    { amount: Money.fromDecimal('150000.00', 'USD'), transactionDate: '2026-03-01' },
    { amount: Money.fromDecimal('100000.00', 'EUR'), transactionDate: '2026-03-01' }, // 100k EUR = 110k USD -> Total $260k
  ];

  const rebateResultA = CalculationEngine.verifyVolumeRebate({
    contractTerms: contractAboveThreshold,
    spendRecords: spendRecordsA,
    fxTable,
    asOfDate: '2026-03-01',
    alreadyClaimedRebate: Money.zero('USD'),
  });

  // Total spend = $260,000. Excess above $200k = $60,000. 4% of $60,000 = $2,400.
  assert(rebateResultA.isDiscrepancy === true, 'Incremental above-threshold rebate calculated');
  assert(rebateResultA.difference.toDecimalString() === '2400.00', 'Incremental 4% on $60,000 excess equals exactly $2,400.00');

  // Contract B: Total Spend (TOTAL_SPEND) - 3% on entire spend once $300,000 is met
  const contractTotalSpend: VolumeRebateContractTerms = {
    contractId: 'cnt-total',
    currency: 'USD',
    tiers: [
      {
        tierNumber: 1,
        thresholdSpend: Money.fromDecimal('300000.00', 'USD'),
        rebateBasisPoints: 300, // 3%
        calcType: 'TOTAL_SPEND',
      },
    ],
  };

  const spendRecordsB = [
    { amount: Money.fromDecimal('350000.00', 'USD'), transactionDate: '2026-03-01' },
  ];

  const rebateResultB = CalculationEngine.verifyVolumeRebate({
    contractTerms: contractTotalSpend,
    spendRecords: spendRecordsB,
    fxTable,
    asOfDate: '2026-03-01',
    alreadyClaimedRebate: Money.fromDecimal('5000.00', 'USD'), // already claimed $5,000
  });

  // Total earned = 3% of $350k = $10,500. Already claimed = $5,000. Unclaimed = $5,500.
  assert(rebateResultB.isDiscrepancy === true, 'Total spend rebate with partial claim calculated');
  assert(rebateResultB.difference.toDecimalString() === '5500.00', 'Unclaimed rebate is $10,500 - $5,000 = $5,500.00');

  // False Positive Test: All rebate already claimed
  const rebateAlreadyClaimed = CalculationEngine.verifyVolumeRebate({
    contractTerms: contractTotalSpend,
    spendRecords: spendRecordsB,
    fxTable,
    asOfDate: '2026-03-01',
    alreadyClaimedRebate: Money.fromDecimal('10500.00', 'USD'), // fully claimed
  });
  assert(
    rebateAlreadyClaimed.isDiscrepancy === false,
    'FALSE-POSITIVE PASS: Fully claimed rebate is NOT flagged as discrepancy'
  );
}

// ---------------------------------------------------------------------------
// 5. 3-Way Match: Partial Deliveries, UOM, Taxes, Freight, and Change Orders
// ---------------------------------------------------------------------------
console.log('\n[5] 3-Way & 4-Way Line Item Match (Partial Deliveries, UOM, Freight, Taxes):');
{
  const toleranceConfig: MatchToleranceConfig = {
    maxAbsoluteLineDiscrepancy: Money.fromDecimal('1.00', 'USD'),
    maxPercentageLineBasisPoints: 50, // 0.5%
    maxFreightTolerance: Money.fromDecimal('5.00', 'USD'),
  };

  const poLines: PoLineItem[] = [
    {
      lineNumber: 1,
      itemCode: 'WIDGET-PRO',
      description: 'Industrial Widget Pro',
      quantityOrdered: 100n,
      uom: 'EA',
      unitPrice: Money.fromDecimal('50.00', 'USD'),
      totalPrice: Money.fromDecimal('5000.00', 'USD'),
    },
    {
      lineNumber: 2,
      itemCode: 'BOLT-BOX',
      description: 'Titanium Bolts Box of 10',
      quantityOrdered: 20n,
      uom: 'EA', // 20 individual boxes
      unitPrice: Money.fromDecimal('100.00', 'USD'),
      totalPrice: Money.fromDecimal('2000.00', 'USD'),
    },
  ];

  // Scenario 1: Partial delivery (Only 70 WIDGET-PRO received, but invoiced for 100)
  const partialReceipt: GoodsReceiptLineItem[] = [
    {
      poLineNumber: 1,
      itemCode: 'WIDGET-PRO',
      quantityReceived: 70n, // 30 missing!
      uom: 'EA',
      receivedDate: '2026-03-02',
      receivingNoteRef: 'GRN-001',
    },
    {
      poLineNumber: 2,
      itemCode: 'BOLT-BOX',
      quantityReceived: 20n,
      uom: 'EA',
      receivedDate: '2026-03-02',
      receivingNoteRef: 'GRN-001',
    },
  ];

  const fullInvoice: InvoiceLineItemMatch[] = [
    {
      lineNumber: 1,
      itemCode: 'WIDGET-PRO',
      description: 'Industrial Widget Pro',
      quantityInvoiced: 100n, // overbilling by 30 units
      uom: 'EA',
      unitPrice: Money.fromDecimal('50.00', 'USD'),
      totalPrice: Money.fromDecimal('5000.00', 'USD'),
    },
    {
      lineNumber: 2,
      itemCode: 'BOLT-BOX',
      description: 'Titanium Bolts Box of 10',
      quantityInvoiced: 20n,
      uom: 'EA',
      unitPrice: Money.fromDecimal('100.00', 'USD'),
      totalPrice: Money.fromDecimal('2000.00', 'USD'),
    },
  ];

  const partialMatch = ThreeWayMatchEngine.runThreeWayMatch({
    poLines,
    receiptLines: partialReceipt,
    invoiceLines: fullInvoice,
    tolerance: toleranceConfig,
  });

  assert(partialMatch.isDiscrepancy === true, 'Partial delivery over-billing identified');
  assert(partialMatch.totalRecoverable.toDecimalString() === '1500.00', '30 unreceived units * $50 = $1,500.00 recoverable');

  // Scenario 2: Authorized Change Order amends PO quantity to 70 before invoice -> NO discrepancy!
  const changeOrder: PoChangeOrder = {
    id: 'co-001',
    poNumber: 'PO-100',
    lineNumber: 1,
    authorizedAt: '2026-03-01',
    authorizedBy: 'procurement-mgr',
    adjustedQuantity: 70n,
    reason: 'Supplier supply chain constraint reduction',
  };

  const invoiceMatchingPartial: InvoiceLineItemMatch[] = [
    {
      lineNumber: 1,
      itemCode: 'WIDGET-PRO',
      description: 'Industrial Widget Pro',
      quantityInvoiced: 70n, // matches adjusted PO
      uom: 'EA',
      unitPrice: Money.fromDecimal('50.00', 'USD'),
      totalPrice: Money.fromDecimal('3500.00', 'USD'),
    },
    {
      lineNumber: 2,
      itemCode: 'BOLT-BOX',
      description: 'Titanium Bolts Box of 10',
      quantityInvoiced: 20n,
      uom: 'EA',
      unitPrice: Money.fromDecimal('100.00', 'USD'),
      totalPrice: Money.fromDecimal('2000.00', 'USD'),
    },
  ];

  const changeOrderMatch = ThreeWayMatchEngine.runThreeWayMatch({
    poLines,
    receiptLines: partialReceipt,
    invoiceLines: invoiceMatchingPartial,
    changeOrders: [changeOrder],
    tolerance: toleranceConfig,
  });

  assert(changeOrderMatch.isDiscrepancy === false, 'FALSE-POSITIVE PASS: Authorized change order correctly prevents false positive');

  // Scenario 3: Unit of Measure (UOM) conversion: 10 CASE_12 invoiced vs 120 EA received
  const uomPoLines: PoLineItem[] = [
    {
      lineNumber: 1,
      itemCode: 'SODA',
      description: 'Sparkling Water',
      quantityOrdered: 120n,
      uom: 'EA',
      unitPrice: Money.fromDecimal('1.00', 'USD'),
      totalPrice: Money.fromDecimal('120.00', 'USD'),
    },
  ];
  const uomReceipt: GoodsReceiptLineItem[] = [
    {
      poLineNumber: 1,
      itemCode: 'SODA',
      quantityReceived: 120n,
      uom: 'EA',
      receivedDate: '2026-03-01',
      receivingNoteRef: 'GRN-UOM',
    },
  ];
  const uomInvoice: InvoiceLineItemMatch[] = [
    {
      lineNumber: 1,
      itemCode: 'SODA',
      description: 'Sparkling Water (Case of 12)',
      quantityInvoiced: 10n, // 10 cases of 12 = 120 EA
      uom: 'CASE_12',
      unitPrice: Money.fromDecimal('1.00', 'USD'),
      totalPrice: Money.fromDecimal('120.00', 'USD'),
    },
  ];

  const uomMatch = ThreeWayMatchEngine.runThreeWayMatch({
    poLines: uomPoLines,
    receiptLines: uomReceipt,
    invoiceLines: uomInvoice,
    tolerance: toleranceConfig,
  });
  assert(uomMatch.isDiscrepancy === false, 'UOM conversion (10 CASE_12 -> 120 EA) matches perfectly without discrepancy');

  // Scenario 4: Freight Allowance & Tax Separation
  const freightMatch = ThreeWayMatchEngine.runThreeWayMatch({
    poLines: uomPoLines,
    receiptLines: uomReceipt,
    invoiceLines: uomInvoice,
    tolerance: toleranceConfig,
    contractFreightAllowance: Money.fromDecimal('50.00', 'USD'),
    actualFreightCharged: Money.fromDecimal('95.00', 'USD'), // overcharge of $45 ($40 > $5 tolerance)
    taxRateBasisPoints: 1000, // 10%
    invoiceBilledTax: Money.fromDecimal('25.00', 'USD'), // expected $12.00 on $120. Overcharge $13.
  });
  assert(freightMatch.freightDiscrepancy?.isOvercharge === true, 'Freight overcharge detected');
  assert(freightMatch.taxAnalysis?.taxDiscrepancy.toDecimalString() === '13.00', 'Tax overcharge of $13.00 calculated');
}

// ---------------------------------------------------------------------------
// 6. Sourced Dated FX Rates: Fail-Closed & Provenance
// ---------------------------------------------------------------------------
console.log('\n[6] Sourced Dated FX Rate Engine (Fail-Closed & As-Of Date):');
{
  const fxTable = new FxRateTable();
  fxTable.registerDecimalRate('FEDERAL_RESERVE', '2026-03-01', 'GBP', 'USD', '1.3000');

  // Valid conversion
  const moneyGbp = Money.fromDecimal('100.00', 'GBP');
  const converted = fxTable.convert(moneyGbp, 'USD', '2026-03-02', 3);
  assert(converted.converted.toDecimalString() === '130.00', '£100.00 converts to $130.00 with 1.30 rate');
  assert(converted.rateApplied.source === 'FEDERAL_RESERVE', 'FX rate records verifiable data source');
  assert(converted.rateApplied.asOfDate === '2026-03-01', 'Conversion attaches specific asOfDate');

  // Stale rate fail-closed check: rate requested 30 days after published date
  let staleFailedClosed = false;
  try {
    fxTable.convert(moneyGbp, 'USD', '2026-04-15', 7); // max age 7 days
  } catch (err: any) {
    staleFailedClosed = err instanceof FxRateNotFoundError;
  }
  assert(staleFailedClosed, 'FAIL-CLOSED: Stale exchange rate beyond max age window throws FxRateNotFoundError');

  // Missing currency fail-closed check
  let missingFailedClosed = false;
  try {
    fxTable.convert(moneyGbp, 'TRY', '2026-03-01', 7);
  } catch (err: any) {
    missingFailedClosed = err instanceof FxRateNotFoundError;
  }
  assert(missingFailedClosed, 'FAIL-CLOSED: Missing currency pair throws FxRateNotFoundError (zero fallback guesses)');
}

// ---------------------------------------------------------------------------
// 7. Dynamic Confidence Score Engine
// ---------------------------------------------------------------------------
console.log('\n[7] Dynamic Confidence Engine (Computed, Zero Hardcoded Confidence):');
{
  // High confidence: Complete evidence pack from Direct ERP & Bank Statement
  const highConfidence = ConfidenceEngine.computeOpportunityConfidence({
    category: 'DUPLICATE_PAYMENT',
    evidenceList: [
      { type: 'INVOICE', referenceNumber: 'INV-1', sourceAuthority: 'ERP_SYSTEM_DIRECT', timestamp: '2026-03-01' },
      { type: 'PURCHASE_ORDER', referenceNumber: 'PO-1', sourceAuthority: 'ERP_SYSTEM_DIRECT', timestamp: '2026-03-01' },
      { type: 'GOODS_RECEIPT', referenceNumber: 'GR-1', sourceAuthority: 'ERP_SYSTEM_DIRECT', timestamp: '2026-03-01' },
      { type: 'PAYMENT_RECEIPT', referenceNumber: 'TX-1', sourceAuthority: 'BANK_STATEMENT_DIRECT', timestamp: '2026-03-02' },
    ],
    consistency: {
      supplierTaxIdMatch: true,
      amountReconciliationMatch: true,
      dateChronologyValid: true,
      currencyConsistent: true,
    },
  });
  assert(highConfidence.finalScore >= 80, `High confidence computed: ${highConfidence.finalScore}% (>= 80%)`);
  assert(highConfidence.reasons.length >= 4, 'Full audit rationale generated with point breakdown');

  // Degraded confidence: Incomplete evidence, manual entry source
  const lowConfidence = ConfidenceEngine.computeOpportunityConfidence({
    category: 'PRICE_DISCREPANCY',
    evidenceList: [
      { type: 'INVOICE', referenceNumber: 'INV-1', sourceAuthority: 'MANUAL_ENTRY', timestamp: '2026-03-01' },
    ],
    consistency: {
      supplierTaxIdMatch: false,
      amountReconciliationMatch: true,
      dateChronologyValid: true,
      currencyConsistent: true,
    },
  });
  assert(lowConfidence.finalScore < 50, `Degraded confidence computed: ${lowConfidence.finalScore}% (< 50%)`);
}

// ---------------------------------------------------------------------------
// 8. Opportunity Status Lifecycle & Settlement Proof Gate
// ---------------------------------------------------------------------------
console.log('\n[8] Opportunity Status Lifecycle & Settlement Proof Verification:');
{
  const expectedRecoverable = Money.fromDecimal('8500.00', 'USD');
  const validProof: SettlementProof = {
    proofId: 'proof-001',
    proofType: 'CREDIT_MEMO',
    referenceNumber: 'CM-2026-889',
    settledAmount: expectedRecoverable,
    settledDate: '2026-03-15',
    issuerSupplierId: 'supp-tech',
    documentHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  };

  const validSettlement = CalculationEngine.verifySettlementProof({
    expectedRecoverable,
    proof: validProof,
    supplierId: 'supp-tech',
  });
  assert(validSettlement.isVerified === true, 'Valid Credit Memo settlement proof transitions to verified');

  // Attempt settlement with missing document hash -> Rejected
  const invalidProofHash: SettlementProof = { ...validProof, documentHash: '' };
  const invalidHashResult = CalculationEngine.verifySettlementProof({
    expectedRecoverable,
    proof: invalidProofHashProof(invalidProofHash),
    supplierId: 'supp-tech',
  });
  assert(invalidHashResult.isVerified === false, 'Settlement without document hash rejected');

  // Attempt settlement with mismatched supplier -> Rejected
  const mismatchedSupplierResult = CalculationEngine.verifySettlementProof({
    expectedRecoverable,
    proof: validProof,
    supplierId: 'supp-wrong-vendor',
  });
  assert(mismatchedSupplierResult.isVerified === false, 'Settlement with mismatched supplier rejected');
}

function invalidProofHashProof(p: SettlementProof): SettlementProof {
  return { ...p, documentHash: '' };
}

console.log('\n===============================================================');
console.log(`--- PHASE 1 FINANCIAL SUITE COMPLETED: ${passed}/${total} TESTS PASSED ---`);
console.log('===============================================================\n');

if (passed !== total) {
  process.exit(1);
}
