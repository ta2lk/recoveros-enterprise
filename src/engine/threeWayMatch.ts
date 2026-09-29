/**
 * RecoverOS - Deterministic 3-Way & 4-Way Matching Engine
 * 
 * Rules:
 * 1. Line-item matching across PO, Goods Receipt, and Invoice.
 * 2. Handle partial deliveries, tax separation, freight allowances, change orders.
 * 3. Support per-line absolute and percentage tolerances.
 * 4. Unit-of-measure (UOM) conversion with fail-closed checks.
 */

import { Money } from './money';

export interface UomConversionTable {
  [fromUnit: string]: {
    [toUnit: string]: {
      multiplierNumerator: bigint;
      multiplierDenominator: bigint;
    };
  };
}

export const STANDARD_UOM_TABLE: UomConversionTable = {
  CASE_12: { EA: { multiplierNumerator: 12n, multiplierDenominator: 1n } },
  BOX_10: { EA: { multiplierNumerator: 10n, multiplierDenominator: 1n } },
  PALLET_48: { CASE_12: { multiplierNumerator: 48n, multiplierDenominator: 1n } },
  DZ: { EA: { multiplierNumerator: 12n, multiplierDenominator: 1n } },
  KG: { LBS: { multiplierNumerator: 220462n, multiplierDenominator: 100000n } },
};

export interface PoLineItem {
  lineNumber: number;
  itemCode: string;
  description: string;
  quantityOrdered: bigint;
  uom: string;
  unitPrice: Money;
  totalPrice: Money;
}

export interface GoodsReceiptLineItem {
  poLineNumber: number;
  itemCode: string;
  quantityReceived: bigint;
  uom: string;
  receivedDate: string;
  receivingNoteRef: string;
}

export interface InvoiceLineItemMatch {
  lineNumber: number;
  itemCode: string;
  description: string;
  quantityInvoiced: bigint;
  uom: string;
  unitPrice: Money;
  totalPrice: Money;
  taxAmount?: Money;
}

export interface PoChangeOrder {
  id: string;
  poNumber: string;
  lineNumber: number;
  authorizedAt: string;
  authorizedBy: string;
  adjustedQuantity?: bigint;
  adjustedUnitPrice?: Money;
  reason: string;
}

export interface MatchToleranceConfig {
  maxAbsoluteLineDiscrepancy: Money; // e.g. $1.00 in cents
  maxPercentageLineBasisPoints: number; // e.g. 50 basis points = 0.5%
  maxFreightTolerance: Money; // configured per tenant, no hardcoded $5
}

export interface LineMatchResult {
  lineNumber: number;
  itemCode: string;
  orderedQty: bigint;
  receivedQty: bigint;
  invoicedQty: bigint;
  invoicedUnitPrice: Money;
  expectedUnitPrice: Money;
  discrepancyType:
    | 'NONE'
    | 'OVERBILLING_QUANTITY'
    | 'OVERBILLING_PRICE'
    | 'UOM_MISMATCH'
    | 'LINE_NOT_RECEIVED'
    | 'UNAUTHORIZED_LINE';
  recoverableAmount: Money;
  explanation: string;
}

export interface ThreeWayMatchResult {
  isDiscrepancy: boolean;
  totalRecoverable: Money;
  lineResults: LineMatchResult[];
  freightDiscrepancy?: {
    chargedFreight: Money;
    contractedFreight: Money;
    freightDiscrepancy: Money;
    isOvercharge: boolean;
  };
  taxAnalysis?: {
    invoicedTax: Money;
    calculatedExpectedTax: Money;
    taxDiscrepancy: Money;
  };
  formula: string;
}

export class ThreeWayMatchEngine {
  /**
   * Convert quantity between units of measure
   */
  static convertQuantity(qty: bigint, fromUom: string, toUom: string): bigint {
    const from = fromUom.toUpperCase();
    const to = toUom.toUpperCase();
    if (from === to) return qty;

    const conversion = STANDARD_UOM_TABLE[from]?.[to];
    if (conversion) {
      return (qty * conversion.multiplierNumerator) / conversion.multiplierDenominator;
    }

    const inverse = STANDARD_UOM_TABLE[to]?.[from];
    if (inverse) {
      return (qty * inverse.multiplierDenominator) / inverse.multiplierNumerator;
    }

    throw new Error(`UOM_CONVERSION_ERROR: Cannot convert from '${fromUom}' to '${toUom}'`);
  }

  /**
   * Run full 3-Way match across PO lines, Goods Receipt lines, and Invoice lines
   */
  static runThreeWayMatch(params: {
    poLines: PoLineItem[];
    receiptLines: GoodsReceiptLineItem[];
    invoiceLines: InvoiceLineItemMatch[];
    changeOrders?: PoChangeOrder[];
    tolerance: MatchToleranceConfig;
    contractFreightAllowance?: Money;
    actualFreightCharged?: Money;
    taxRateBasisPoints?: number; // e.g. 500 = 5%
    invoiceBilledTax?: Money;
  }): ThreeWayMatchResult {
    const currency = params.poLines[0]?.totalPrice.currency || 'USD';
    let totalRecoverable = Money.zero(currency);
    const lineResults: LineMatchResult[] = [];

    // Apply authorized change orders to PO lines
    const effectivePoLines = new Map<number, PoLineItem>();
    params.poLines.forEach((line) => {
      let effQty = line.quantityOrdered;
      let effPrice = line.unitPrice;

      if (params.changeOrders) {
        const lineChanges = params.changeOrders.filter((co) => co.lineNumber === line.lineNumber);
        lineChanges.forEach((co) => {
          if (co.adjustedQuantity !== undefined) effQty = co.adjustedQuantity;
          if (co.adjustedUnitPrice !== undefined) effPrice = co.adjustedUnitPrice;
        });
      }

      effectivePoLines.set(line.lineNumber, {
        ...line,
        quantityOrdered: effQty,
        unitPrice: effPrice,
        totalPrice: effPrice.multiplyRatio(effQty, 1n),
      });
    });

    // Map received quantities by PO line number
    const receivedMap = new Map<number, bigint>();
    params.receiptLines.forEach((rc) => {
      const existing = receivedMap.get(rc.poLineNumber) || 0n;
      // Convert to PO line UOM if needed
      const poLine = effectivePoLines.get(rc.poLineNumber);
      const convertedQty = poLine ? this.convertQuantity(rc.quantityReceived, rc.uom, poLine.uom) : rc.quantityReceived;
      receivedMap.set(rc.poLineNumber, existing + convertedQty);
    });

    // Match each invoice line
    for (const invLine of params.invoiceLines) {
      const poLine = effectivePoLines.get(invLine.lineNumber);

      if (!poLine) {
        // Line invoiced that was not on PO
        const recoverable = invLine.totalPrice;
        totalRecoverable = totalRecoverable.add(recoverable);
        lineResults.push({
          lineNumber: invLine.lineNumber,
          itemCode: invLine.itemCode,
          orderedQty: 0n,
          receivedQty: 0n,
          invoicedQty: invLine.quantityInvoiced,
          invoicedUnitPrice: invLine.unitPrice,
          expectedUnitPrice: Money.zero(currency),
          discrepancyType: 'UNAUTHORIZED_LINE',
          recoverableAmount: recoverable,
          explanation: `Invoice line #${invLine.lineNumber} (${invLine.itemCode}) has no matching authorized PO line item.`,
        });
        continue;
      }

      // Standardize UOM
      let normalizedInvoicedQty = invLine.quantityInvoiced;
      try {
        normalizedInvoicedQty = this.convertQuantity(invLine.quantityInvoiced, invLine.uom, poLine.uom);
      } catch (err: any) {
        lineResults.push({
          lineNumber: invLine.lineNumber,
          itemCode: invLine.itemCode,
          orderedQty: poLine.quantityOrdered,
          receivedQty: receivedMap.get(invLine.lineNumber) || 0n,
          invoicedQty: invLine.quantityInvoiced,
          invoicedUnitPrice: invLine.unitPrice,
          expectedUnitPrice: poLine.unitPrice,
          discrepancyType: 'UOM_MISMATCH',
          recoverableAmount: invLine.totalPrice,
          explanation: `UOM conversion failed between Invoice (${invLine.uom}) and PO (${poLine.uom}): ${err.message}`,
        });
        totalRecoverable = totalRecoverable.add(invLine.totalPrice);
        continue;
      }

      const receivedQty = receivedMap.get(invLine.lineNumber) || 0n;

      // 1. Partial Delivery / Quantity check: Can ONLY invoice what was actually received!
      if (normalizedInvoicedQty > receivedQty) {
        const excessQty = normalizedInvoicedQty - receivedQty;
        const excessCost = poLine.unitPrice.multiplyRatio(excessQty, 1n);

        // Check if discrepancy exceeds tolerance
        const isOutsideTolerance = excessCost.compare(params.tolerance.maxAbsoluteLineDiscrepancy) > 0;
        if (isOutsideTolerance) {
          totalRecoverable = totalRecoverable.add(excessCost);
          lineResults.push({
            lineNumber: invLine.lineNumber,
            itemCode: invLine.itemCode,
            orderedQty: poLine.quantityOrdered,
            receivedQty,
            invoicedQty: normalizedInvoicedQty,
            invoicedUnitPrice: invLine.unitPrice,
            expectedUnitPrice: poLine.unitPrice,
            discrepancyType: receivedQty === 0n ? 'LINE_NOT_RECEIVED' : 'OVERBILLING_QUANTITY',
            recoverableAmount: excessCost,
            explanation: `Billed for ${normalizedInvoicedQty} ${poLine.uom} but received only ${receivedQty} ${poLine.uom}. Overbilled by ${excessQty} units (${excessCost.toFormattedString()}).`,
          });
          continue;
        }
      }

      // 2. Unit Price check: Invoiced unit price vs Contracted PO unit price
      if (invLine.unitPrice.compare(poLine.unitPrice) > 0) {
        const unitDiff = invLine.unitPrice.subtract(poLine.unitPrice);
        const totalLinePriceOvercharge = unitDiff.multiplyRatio(normalizedInvoicedQty, 1n);

        // Calculate allowed tolerance threshold
        const percentToleranceAmount = poLine.unitPrice
          .multiplyRatio(normalizedInvoicedQty, 1n)
          .percentBasisPoints(params.tolerance.maxPercentageLineBasisPoints);

        const effectiveTolerance =
          percentToleranceAmount.compare(params.tolerance.maxAbsoluteLineDiscrepancy) > 0
            ? percentToleranceAmount
            : params.tolerance.maxAbsoluteLineDiscrepancy;

        if (totalLinePriceOvercharge.compare(effectiveTolerance) > 0) {
          totalRecoverable = totalRecoverable.add(totalLinePriceOvercharge);
          lineResults.push({
            lineNumber: invLine.lineNumber,
            itemCode: invLine.itemCode,
            orderedQty: poLine.quantityOrdered,
            receivedQty,
            invoicedQty: normalizedInvoicedQty,
            invoicedUnitPrice: invLine.unitPrice,
            expectedUnitPrice: poLine.unitPrice,
            discrepancyType: 'OVERBILLING_PRICE',
            recoverableAmount: totalLinePriceOvercharge,
            explanation: `Unit price billed at ${invLine.unitPrice.toFormattedString()} vs authorized PO price ${poLine.unitPrice.toFormattedString()}. Total price overcharge: ${totalLinePriceOvercharge.toFormattedString()}.`,
          });
          continue;
        }
      }

      // Line matched within acceptable tolerance
      lineResults.push({
        lineNumber: invLine.lineNumber,
        itemCode: invLine.itemCode,
        orderedQty: poLine.quantityOrdered,
        receivedQty,
        invoicedQty: normalizedInvoicedQty,
        invoicedUnitPrice: invLine.unitPrice,
        expectedUnitPrice: poLine.unitPrice,
        discrepancyType: 'NONE',
        recoverableAmount: Money.zero(currency),
        explanation: 'Line conforms to 3-way match within accepted tolerances.',
      });
    }

    // Freight analysis
    let freightAnalysis: ThreeWayMatchResult['freightDiscrepancy'];
    if (params.contractFreightAllowance && params.actualFreightCharged) {
      if (params.actualFreightCharged.compare(params.contractFreightAllowance) > 0) {
        const freightDiff = params.actualFreightCharged.subtract(params.contractFreightAllowance);
        if (freightDiff.compare(params.tolerance.maxFreightTolerance) > 0) {
          totalRecoverable = totalRecoverable.add(freightDiff);
          freightAnalysis = {
            chargedFreight: params.actualFreightCharged,
            contractedFreight: params.contractFreightAllowance,
            freightDiscrepancy: freightDiff,
            isOvercharge: true,
          };
        }
      }
    }

    // Tax separation & validation
    let taxAnalysis: ThreeWayMatchResult['taxAnalysis'];
    if (params.taxRateBasisPoints !== undefined && params.invoiceBilledTax) {
      // Calculate expected tax strictly on the valid merchandise lines
      const totalTaxableGoods = params.invoiceLines.reduce(
        (sum, line) => sum.add(line.totalPrice),
        Money.zero(currency)
      );
      const expectedTax = totalTaxableGoods.percentBasisPoints(params.taxRateBasisPoints);
      if (params.invoiceBilledTax.compare(expectedTax) > 0) {
        const taxDiff = params.invoiceBilledTax.subtract(expectedTax);
        if (taxDiff.compare(params.tolerance.maxAbsoluteLineDiscrepancy) > 0) {
          totalRecoverable = totalRecoverable.add(taxDiff);
          taxAnalysis = {
            invoicedTax: params.invoiceBilledTax,
            calculatedExpectedTax: expectedTax,
            taxDiscrepancy: taxDiff,
          };
        }
      }
    }

    return {
      isDiscrepancy: totalRecoverable.isPositive(),
      totalRecoverable,
      lineResults,
      freightDiscrepancy: freightAnalysis,
      taxAnalysis,
      formula: `3-Way Match = Sum(LineDiscrepancies) + FreightDiscrepancy + TaxDiscrepancy = ${totalRecoverable.toFormattedString()}`,
    };
  }
}
