import {
  Invoice,
  PurchaseOrder,
  Contract,
  PaymentTransaction,
  ShipmentRecord,
  Opportunity,
  Evidence,
  DeterministicCalculation,
  Supplier,
} from '../types';
import { CalculationEngine, PromptPaymentDiscountTerms, VolumeRebateContractTerms } from './calculation';
import { Money } from './money';
import { FxRateTable } from './fx';
import { ConfidenceEngine, EvidenceItemForScoring } from './confidence';

export class MatchingEngine {
  /**
   * Run comprehensive 3-way & 4-way matching across transactions
   * Using Integer Minor Units (Money), Dynamic Confidence, and Configurable Rules.
   */
  static runAudit(params: {
    tenantId: string;
    suppliers: Supplier[];
    invoices: Invoice[];
    purchaseOrders: PurchaseOrder[];
    contracts: Contract[];
    payments: PaymentTransaction[];
    shipments: ShipmentRecord[];
    fxTable?: FxRateTable;
    config?: {
      freightToleranceMajor?: number;
      poToleranceMajor?: number;
      fuzzyWindowDays?: number;
    };
  }): Opportunity[] {
    const opportunities: Opportunity[] = [];
    const supplierMap = new Map<string, Supplier>();
    params.suppliers.forEach((s) => supplierMap.set(s.id, s));

    const poTolerance = Money.fromDecimal(params.config?.poToleranceMajor ?? 0.05, 'USD');
    const freightTolerance = Money.fromDecimal(params.config?.freightToleranceMajor ?? 5.0, 'USD');
    const fx = params.fxTable || FxRateTable.createDefault();

    // 1. Check for Duplicate Payments
    const invoicePaymentsMap = new Map<string, PaymentTransaction[]>();
    params.payments.forEach((p) => {
      if (p.invoiceId) {
        const existing = invoicePaymentsMap.get(p.invoiceId) || [];
        existing.push(p);
        invoicePaymentsMap.set(p.invoiceId, existing);
      }
    });

    params.invoices.forEach((inv) => {
      const relatedPayments = invoicePaymentsMap.get(inv.id) || [];
      if (relatedPayments.length > 1) {
        const invGross = Money.fromDecimal(inv.totalAmount, inv.currency);
        const totalPaid = relatedPayments.reduce(
          (sum, p) => {
            let pMoney = Money.fromDecimal(p.amount, p.currency);
            if (p.currency !== inv.currency) {
              const { converted } = fx.convert(pMoney, inv.currency, p.paymentDate.slice(0, 10), 365);
              pMoney = converted;
            }
            return sum.add(pMoney);
          },
          Money.zero(inv.currency)
        );

        if (totalPaid.compare(invGross) > 0) {
          const duplicateDisbursed = totalPaid.subtract(invGross);
          const supplier = supplierMap.get(inv.supplierId);
          const oppId = `opp-dup-${inv.id}`;

          const evidenceScoring: EvidenceItemForScoring[] = [
            {
              type: 'INVOICE',
              referenceNumber: inv.invoiceNumber,
              sourceAuthority: inv.sourceDocumentId ? 'OCR_PARSED' : 'ERP_SYSTEM_DIRECT',
              timestamp: inv.createdAt,
            },
            ...relatedPayments.map((p) => ({
              type: 'PAYMENT_RECEIPT' as const,
              referenceNumber: p.transactionReference,
              sourceAuthority: 'BANK_STATEMENT_DIRECT' as const,
              timestamp: p.paymentDate,
            })),
          ];

          const confidenceBreakdown = ConfidenceEngine.computeOpportunityConfidence({
            category: 'DUPLICATE_PAYMENT',
            evidenceList: evidenceScoring,
            consistency: {
              supplierTaxIdMatch: true,
              amountReconciliationMatch: true,
              dateChronologyValid: true,
              currencyConsistent: true,
            },
          });

          const evidenceList: Evidence[] = [
            {
              id: `ev-inv-${inv.id}`,
              tenantId: params.tenantId,
              opportunityId: oppId,
              type: 'INVOICE',
              sourceDocumentId: inv.sourceDocumentId,
              documentTitle: `Vendor Invoice #${inv.invoiceNumber}`,
              referenceNumber: inv.invoiceNumber,
              relevantExcerpt: `Billed Total: ${invGross.toFormattedString()} on date ${inv.invoiceDate}`,
              confidence: confidenceBreakdown.finalScore,
              timestamp: inv.createdAt,
            },
            ...relatedPayments.map((p, idx) => ({
              id: `ev-pay-${p.id}`,
              tenantId: params.tenantId,
              opportunityId: oppId,
              type: 'PAYMENT_RECEIPT' as const,
              documentTitle: `Bank Settlement #${p.transactionReference}`,
              referenceNumber: p.transactionReference,
              relevantExcerpt: `Disbursement #${idx + 1}: ${Money.fromDecimal(p.amount, p.currency).toFormattedString()} settled via ${p.method} on ${p.paymentDate}`,
              confidence: confidenceBreakdown.finalScore,
              timestamp: p.paymentDate,
            })),
          ];

          const calculation: DeterministicCalculation = {
            id: `calc-${oppId}`,
            opportunityId: oppId,
            formula: `Duplicate Disbursed = TotalPaid (${totalPaid.toFormattedString()}) - Invoiced (${invGross.toFormattedString()})`,
            expectedAmount: invGross.toNumber(),
            actualAmount: totalPaid.toNumber(),
            difference: duplicateDisbursed.toNumber(),
            currency: inv.currency,
            exchangeRate: 1.0,
            tax: 0,
            discount: 0,
            rebate: 0,
            tolerance: 0,
            codeVerified: true,
            computedAt: new Date().toISOString(),
          };

          opportunities.push({
            id: oppId,
            tenantId: params.tenantId,
            title: `Duplicate Payment on Invoice #${inv.invoiceNumber}`,
            category: 'DUPLICATE_PAYMENT',
            supplierId: inv.supplierId,
            supplierName: supplier?.name || 'Unknown Supplier',
            sourceType: 'DUPLICATE_PAYMENT',
            expectedAmount: invGross.toNumber(),
            actualAmount: totalPaid.toNumber(),
            recoverableAmount: duplicateDisbursed.toNumber(),
            currency: inv.currency,
            confidence: confidenceBreakdown.finalScore,
            evidenceList,
            calculation,
            status: 'DETECTED',
            discoveredByAgent: 'Invoice Agent',
            createdAt: new Date().toISOString(),
          });
        }
      }
    });

    // 2. Check for PO vs Invoice Discrepancies
    const poMap = new Map<string, PurchaseOrder>();
    params.purchaseOrders.forEach((po) => poMap.set(po.id, po));

    params.invoices.forEach((inv) => {
      if (inv.purchaseOrderId && inv.paymentStatus === 'PAID') {
        const po = poMap.get(inv.purchaseOrderId);
        if (po) {
          const poMoney = Money.fromDecimal(po.totalAmount, po.currency);
          let paidMoney = Money.fromDecimal(inv.paidAmount, inv.currency);
          let paidConverted = paidMoney;
          if (inv.currency !== po.currency) {
            const { converted } = fx.convert(paidMoney, po.currency, inv.invoiceDate.slice(0, 10), 365);
            paidConverted = converted;
          }
          const effTolerance = po.currency === 'USD' ? poTolerance : fx.convert(poTolerance, po.currency, inv.invoiceDate.slice(0, 10), 365).converted;
          const result = CalculationEngine.verifyInvoiceOverpayment(poMoney, paidConverted, effTolerance);

          if (result.isDiscrepancy) {
            const supplier = supplierMap.get(inv.supplierId);
            const oppId = `opp-overpay-${inv.id}`;

            const evidenceScoring: EvidenceItemForScoring[] = [
              {
                type: 'PURCHASE_ORDER',
                referenceNumber: po.poNumber,
                sourceAuthority: 'ERP_SYSTEM_DIRECT',
                timestamp: po.orderDate,
              },
              {
                type: 'INVOICE',
                referenceNumber: inv.invoiceNumber,
                sourceAuthority: 'OCR_PARSED',
                timestamp: inv.createdAt,
              },
            ];

            const confidenceBreakdown = ConfidenceEngine.computeOpportunityConfidence({
              category: 'SUPPLIER_OVERPAYMENT',
              evidenceList: evidenceScoring,
              consistency: {
                supplierTaxIdMatch: true,
                amountReconciliationMatch: true,
                dateChronologyValid: true,
                currencyConsistent: po.currency === inv.currency,
              },
            });

            const evidenceList: Evidence[] = [
              {
                id: `ev-po-${po.id}`,
                tenantId: params.tenantId,
                opportunityId: oppId,
                type: 'PURCHASE_ORDER',
                documentTitle: `Authorized PO #${po.poNumber}`,
                referenceNumber: po.poNumber,
                relevantExcerpt: `Contracted Purchase Order authorized amount: ${poMoney.toFormattedString()}`,
                confidence: confidenceBreakdown.finalScore,
                timestamp: po.orderDate,
              },
              {
                id: `ev-inv-${inv.id}`,
                tenantId: params.tenantId,
                opportunityId: oppId,
                type: 'INVOICE',
                sourceDocumentId: inv.sourceDocumentId,
                documentTitle: `Vendor Invoice #${inv.invoiceNumber}`,
                referenceNumber: inv.invoiceNumber,
                relevantExcerpt: `Invoice billed & paid: ${paidMoney.toFormattedString()} (Overbilled by ${result.difference.toFormattedString()})`,
                confidence: confidenceBreakdown.finalScore,
                timestamp: inv.createdAt,
              },
            ];

            const calculation: DeterministicCalculation = {
              id: `calc-${oppId}`,
              opportunityId: oppId,
              formula: result.formula,
              expectedAmount: result.expectedAmount.toNumber(),
              actualAmount: result.actualAmount.toNumber(),
              difference: result.difference.toNumber(),
              currency: inv.currency,
              exchangeRate: 1.0,
              tax: 0,
              discount: 0,
              rebate: 0,
              tolerance: poTolerance.toNumber(),
              codeVerified: true,
              computedAt: new Date().toISOString(),
            };

            opportunities.push({
              id: oppId,
              tenantId: params.tenantId,
              title: `Supplier Overpayment: Invoice #${inv.invoiceNumber} vs PO #${po.poNumber}`,
              category: 'SUPPLIER_OVERPAYMENT',
              supplierId: inv.supplierId,
              supplierName: supplier?.name || 'Unknown Supplier',
              sourceType: 'INVOICE_VS_PO',
              expectedAmount: result.expectedAmount.toNumber(),
              actualAmount: result.actualAmount.toNumber(),
              recoverableAmount: result.difference.toNumber(),
              currency: inv.currency,
              confidence: confidenceBreakdown.finalScore,
              evidenceList,
              calculation,
              status: 'DETECTED',
              discoveredByAgent: 'Discovery Agent',
              createdAt: new Date().toISOString(),
            });
          }
        }
      }
    });

    // 3. Check for Missed Early Payment Discounts
    params.invoices.forEach((inv) => {
      const supplier = supplierMap.get(inv.supplierId);
      const payment = params.payments.find((p) => p.invoiceId === inv.id);

      if (supplier && payment) {
        // Parse discount terms from supplier payment terms (e.g. "2/10 Net 30")
        const match = supplier.paymentTerms.match(/(\d+(?:\.\d+)?)\/(\d+)\s+Net\s+(\d+)/i);
        if (match) {
          const discountPct = parseFloat(match[1]);
          const discountDays = parseInt(match[2], 10);
          const netDays = parseInt(match[3], 10);

          const terms: PromptPaymentDiscountTerms = {
            discountPercentBasisPoints: Math.round(discountPct * 100),
            discountDaysAllowed: discountDays,
            netDaysAllowed: netDays,
          };

          const invoiceGross = Money.fromDecimal(inv.totalAmount, inv.currency);
          let actuallyPaid = Money.fromDecimal(payment.amount, payment.currency);
          if (payment.currency !== inv.currency) {
            const { converted } = fx.convert(actuallyPaid, inv.currency, payment.paymentDate.slice(0, 10), 365);
            actuallyPaid = converted;
          }

          const result = CalculationEngine.verifyMissedDiscount({
            invoiceGross,
            actuallyPaid,
            terms,
            invoiceDateStr: inv.invoiceDate,
            paymentDateStr: payment.paymentDate,
          });

          if (result.isDiscrepancy) {
            const oppId = `opp-discount-${inv.id}`;

            const evidenceScoring: EvidenceItemForScoring[] = [
              {
                type: 'CONTRACT_CLAUSE',
                referenceNumber: supplier.paymentTerms,
                sourceAuthority: 'ERP_SYSTEM_DIRECT',
                timestamp: inv.invoiceDate,
              },
              {
                type: 'INVOICE',
                referenceNumber: inv.invoiceNumber,
                sourceAuthority: 'OCR_PARSED',
                timestamp: inv.invoiceDate,
              },
              {
                type: 'PAYMENT_RECEIPT',
                referenceNumber: payment.transactionReference,
                sourceAuthority: 'BANK_STATEMENT_DIRECT',
                timestamp: payment.paymentDate,
              },
            ];

            const confidenceBreakdown = ConfidenceEngine.computeOpportunityConfidence({
              category: 'MISSED_DISCOUNT',
              evidenceList: evidenceScoring,
              consistency: {
                supplierTaxIdMatch: true,
                amountReconciliationMatch: true,
                dateChronologyValid: true,
                currencyConsistent: inv.currency === payment.currency,
              },
            });

            const evidenceList: Evidence[] = [
              {
                id: `ev-supp-${supplier.id}`,
                tenantId: params.tenantId,
                opportunityId: oppId,
                type: 'CONTRACT_CLAUSE',
                documentTitle: `Master Agreement Terms - ${supplier.name}`,
                referenceNumber: supplier.paymentTerms,
                relevantExcerpt: `Payment Terms: ${supplier.paymentTerms}. Buyer entitled to ${discountPct}% prompt discount if paid within ${discountDays} days.`,
                specificClause: `Prompt Settlement Terms: ${supplier.paymentTerms}`,
                confidence: confidenceBreakdown.finalScore,
                timestamp: inv.invoiceDate,
              },
              {
                id: `ev-inv-${inv.id}`,
                tenantId: params.tenantId,
                opportunityId: oppId,
                type: 'INVOICE',
                sourceDocumentId: inv.sourceDocumentId,
                documentTitle: `Invoice #${inv.invoiceNumber}`,
                referenceNumber: inv.invoiceNumber,
                relevantExcerpt: `Invoice Date: ${inv.invoiceDate}, Gross Amount: ${invoiceGross.toFormattedString()}`,
                confidence: confidenceBreakdown.finalScore,
                timestamp: inv.invoiceDate,
              },
              {
                id: `ev-pay-${payment.id}`,
                tenantId: params.tenantId,
                opportunityId: oppId,
                type: 'PAYMENT_RECEIPT',
                documentTitle: `Settlement Record #${payment.transactionReference}`,
                referenceNumber: payment.transactionReference,
                relevantExcerpt: `Paid Date: ${payment.paymentDate}, Paid Gross: ${actuallyPaid.toFormattedString()}`,
                confidence: confidenceBreakdown.finalScore,
                timestamp: payment.paymentDate,
              },
            ];

            const calculation: DeterministicCalculation = {
              id: `calc-${oppId}`,
              opportunityId: oppId,
              formula: result.formula,
              expectedAmount: result.expectedAmount.toNumber(),
              actualAmount: result.actualAmount.toNumber(),
              difference: result.difference.toNumber(),
              currency: inv.currency,
              exchangeRate: 1.0,
              tax: 0,
              discount: result.difference.toNumber(),
              rebate: 0,
              tolerance: 0,
              codeVerified: true,
              computedAt: new Date().toISOString(),
            };

            opportunities.push({
              id: oppId,
              tenantId: params.tenantId,
              title: `Missed ${discountPct}% Early Payment Discount on Invoice #${inv.invoiceNumber}`,
              category: 'MISSED_DISCOUNT',
              supplierId: inv.supplierId,
              supplierName: supplier.name,
              sourceType: 'MISSED_DISCOUNT',
              expectedAmount: result.expectedAmount.toNumber(),
              actualAmount: result.actualAmount.toNumber(),
              recoverableAmount: result.difference.toNumber(),
              currency: inv.currency,
              confidence: confidenceBreakdown.finalScore,
              evidenceList,
              calculation,
              status: 'DETECTED',
              discoveredByAgent: 'Contract Agent',
              createdAt: new Date().toISOString(),
            });
          }
        }
      }
    });

    // 4. Check for Unclaimed Contract Volume Rebates
    params.contracts.forEach((contract) => {
      const supplier = supplierMap.get(contract.supplierId);
      const rebateRule = contract.rules.find((r) => r.ruleType === 'VOLUME_REBATE');

      if (supplier && rebateRule && rebateRule.thresholdSpend) {
        const thresholdMoney = Money.fromDecimal(rebateRule.thresholdSpend, 'USD');
        const rebateBps = Math.round(rebateRule.rewardValue * 100);

        const terms: VolumeRebateContractTerms = {
          contractId: contract.id,
          currency: 'USD',
          tiers: [
            {
              tierNumber: 1,
              thresholdSpend: thresholdMoney,
              rebateBasisPoints: rebateBps,
              calcType: 'TOTAL_SPEND',
            },
          ],
        };

        const totalSpendMoney = Money.fromDecimal(supplier.totalSpend, 'USD');
        const alreadyClaimed = Money.fromDecimal(supplier.totalRecovered, 'USD');

        const fx = params.fxTable || new FxRateTable();
        const result = CalculationEngine.verifyVolumeRebate({
          contractTerms: terms,
          spendRecords: [{ amount: totalSpendMoney, transactionDate: new Date().toISOString().slice(0, 10) }],
          fxTable: fx,
          asOfDate: new Date().toISOString().slice(0, 10),
          alreadyClaimedRebate: alreadyClaimed,
        });

        if (result.isDiscrepancy) {
          const oppId = `opp-rebate-${contract.id}`;

          const evidenceScoring: EvidenceItemForScoring[] = [
            {
              type: 'CONTRACT_CLAUSE',
              referenceNumber: contract.contractNumber,
              sourceAuthority: 'ERP_SYSTEM_DIRECT',
              timestamp: contract.startDate,
            },
            {
              type: 'BANK_RECORD',
              referenceNumber: supplier.taxId,
              sourceAuthority: 'BANK_STATEMENT_DIRECT',
              timestamp: new Date().toISOString(),
            },
          ];

          const confidenceBreakdown = ConfidenceEngine.computeOpportunityConfidence({
            category: 'CONTRACT_REBATE',
            evidenceList: evidenceScoring,
            consistency: {
              supplierTaxIdMatch: true,
              amountReconciliationMatch: true,
              dateChronologyValid: true,
              currencyConsistent: true,
            },
          });

          const evidenceList: Evidence[] = [
            {
              id: `ev-rule-${rebateRule.id}`,
              tenantId: params.tenantId,
              opportunityId: oppId,
              type: 'CONTRACT_CLAUSE',
              sourceDocumentId: contract.sourceDocumentId,
              documentTitle: `Supply Agreement #${contract.contractNumber}`,
              referenceNumber: contract.contractNumber,
              relevantExcerpt: `Clause Volume Incentive: Supplier grants ${rebateRule.rewardValue}% annual cash rebate once spend exceeds ${thresholdMoney.toFormattedString()}.`,
              specificClause: `Annual Spend Tier: ${thresholdMoney.toFormattedString()}`,
              confidence: confidenceBreakdown.finalScore,
              timestamp: contract.startDate,
            },
            {
              id: `ev-spend-${supplier.id}`,
              tenantId: params.tenantId,
              opportunityId: oppId,
              type: 'BANK_RECORD',
              documentTitle: `Cumulative Vendor Ledger - ${supplier.name}`,
              referenceNumber: supplier.taxId,
              relevantExcerpt: `Cumulative annual spend: ${totalSpendMoney.toFormattedString()} (Exceeds threshold by ${totalSpendMoney.subtract(thresholdMoney).toFormattedString()})`,
              confidence: confidenceBreakdown.finalScore,
              timestamp: new Date().toISOString(),
            },
          ];

          const calculation: DeterministicCalculation = {
            id: `calc-${oppId}`,
            opportunityId: oppId,
            formula: result.formula,
            expectedAmount: result.expectedAmount.toNumber(),
            actualAmount: result.actualAmount.toNumber(),
            difference: result.difference.toNumber(),
            currency: 'USD',
            exchangeRate: 1.0,
            tax: 0,
            discount: 0,
            rebate: result.difference.toNumber(),
            tolerance: 0,
            codeVerified: true,
            computedAt: new Date().toISOString(),
          };

          opportunities.push({
            id: oppId,
            tenantId: params.tenantId,
            title: `Unclaimed Volume Rebate (${rebateRule.rewardValue}%) - ${supplier.name}`,
            category: 'CONTRACT_REBATE',
            supplierId: supplier.id,
            supplierName: supplier.name,
            sourceType: 'CONTRACT_REBATE',
            expectedAmount: result.expectedAmount.toNumber(),
            actualAmount: result.actualAmount.toNumber(),
            recoverableAmount: result.difference.toNumber(),
            currency: 'USD',
            confidence: confidenceBreakdown.finalScore,
            evidenceList,
            calculation,
            status: 'DETECTED',
            discoveredByAgent: 'Contract Agent',
            createdAt: new Date().toISOString(),
          });
        }
      }
    });

    // 5. Check Freight Overcharges
    params.shipments.forEach((shipment) => {
      const charged = Money.fromDecimal(shipment.chargedAmount, shipment.currency);
      const contracted = Money.fromDecimal(shipment.contractedAmount, shipment.currency);

      if (charged.compare(contracted) > 0) {
        const freightDiff = charged.subtract(contracted);
        const effFreightTolerance =
          shipment.currency === 'USD'
            ? freightTolerance
            : fx.convert(freightTolerance, shipment.currency, shipment.shipDate.slice(0, 10), 365).converted;
        if (freightDiff.compare(effFreightTolerance) > 0) {
          const oppId = `opp-freight-${shipment.id || shipment.trackingNumber}`;

          const evidenceScoring: EvidenceItemForScoring[] = [
            {
              type: 'FREIGHT_BILL',
              referenceNumber: shipment.trackingNumber,
              sourceAuthority: 'EDI_FEED',
              timestamp: shipment.deliveryDate,
            },
            {
              type: 'CONTRACT_CLAUSE',
              referenceNumber: `TARIFF-${shipment.carrier}`,
              sourceAuthority: 'ERP_SYSTEM_DIRECT',
              timestamp: shipment.shipDate,
            },
          ];

          const confidenceBreakdown = ConfidenceEngine.computeOpportunityConfidence({
            category: 'FREIGHT_OVERCHARGE',
            evidenceList: evidenceScoring,
            consistency: {
              supplierTaxIdMatch: true,
              amountReconciliationMatch: true,
              dateChronologyValid: true,
              currencyConsistent: true,
            },
          });

          const evidenceList: Evidence[] = [
            {
              id: `ev-freight-bill-${shipment.trackingNumber}`,
              tenantId: params.tenantId,
              opportunityId: oppId,
              type: 'FREIGHT_BILL',
              documentTitle: `Carrier Invoice - Tracking #${shipment.trackingNumber}`,
              referenceNumber: shipment.trackingNumber,
              relevantExcerpt: `Charged Freight: ${charged.toFormattedString()}`,
              confidence: confidenceBreakdown.finalScore,
              timestamp: shipment.deliveryDate,
            },
            {
              id: `ev-freight-contract-${shipment.carrier}`,
              tenantId: params.tenantId,
              opportunityId: oppId,
              type: 'CONTRACT_CLAUSE',
              documentTitle: `Carrier Master Rate Table - ${shipment.carrier}`,
              referenceNumber: `TARIFF-${shipment.carrier}`,
              relevantExcerpt: `Contracted Base Rate for ${shipment.weightLbs} lbs: ${contracted.toFormattedString()}`,
              confidence: confidenceBreakdown.finalScore,
              timestamp: shipment.shipDate,
            },
          ];

          const calculation: DeterministicCalculation = {
            id: `calc-${oppId}`,
            opportunityId: oppId,
            formula: `Carrier Overcharge = Billed (${charged.toFormattedString()}) - Contracted (${contracted.toFormattedString()})`,
            expectedAmount: contracted.toNumber(),
            actualAmount: charged.toNumber(),
            difference: freightDiff.toNumber(),
            currency: shipment.currency,
            exchangeRate: 1.0,
            tax: 0,
            discount: 0,
            rebate: 0,
            tolerance: freightTolerance.toNumber(),
            codeVerified: true,
            computedAt: new Date().toISOString(),
          };

          opportunities.push({
            id: oppId,
            tenantId: params.tenantId,
            title: `Freight Surcharge Error: ${shipment.carrier} #${shipment.trackingNumber}`,
            category: 'FREIGHT_OVERCHARGE',
            supplierId: `carrier-${shipment.carrier}`,
            supplierName: shipment.carrier,
            sourceType: 'FREIGHT_SURCHARGE',
            expectedAmount: contracted.toNumber(),
            actualAmount: charged.toNumber(),
            recoverableAmount: freightDiff.toNumber(),
            currency: shipment.currency,
            confidence: confidenceBreakdown.finalScore,
            evidenceList,
            calculation,
            status: 'DETECTED',
            discoveredByAgent: 'Freight Agent',
            createdAt: new Date().toISOString(),
          });
        }
      }
    });

    return opportunities;
  }
}
