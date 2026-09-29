/**
 * RecoverOS - Ground-Truth Synthetic Benchmark Dataset
 * 
 * TAG: SYNTHETIC_DEMO_BENCHMARK
 * This dataset is strictly synthetic and labeled as ground-truth test data.
 * Contains 10 suppliers, 100 invoices, 100 purchase orders, 50 payments, 20 contracts, 50 shipments.
 * Planted known discrepancies:
 * 1. Duplicate Payments (e.g. Inv #1042 paid twice)
 * 2. PO-to-Invoice Overbilling (e.g. PO was $8,400, Invoice billed & paid $9,950)
 * 3. Missed Prompt Payment 2/10 Net 30 Discounts (e.g. Paid in 4 days, discount $480 omitted)
 * 4. Contract Volume Rebates (e.g. Spend reached $250k, 3% rebate $7,500 uncollected)
 * 5. Freight Overcharges (e.g. Carrier charged accessorial fee not in master rate agreement)
 */

import {
  Supplier,
  Contract,
  Invoice,
  PurchaseOrder,
  PaymentTransaction,
  ShipmentRecord,
} from '../types';

export const BENCHMARK_TENANT_ID = 'tenant-benchmark-synth';

// 1. 10 Enterprise Suppliers
export const BENCHMARK_SUPPLIERS: Supplier[] = [
  {
    id: 'supp-01',
    tenantId: BENCHMARK_TENANT_ID,
    name: 'Apex Industrial Materials Corp',
    taxId: 'US-94-2849182',
    contactEmail: 'ar-claims@apex-materials.example',
    country: 'United States',
    currency: 'USD',
    paymentTerms: '2/10 Net 30',
    totalSpend: 312500,
    totalRecovered: 0,
    activeOpportunitiesCount: 2,
    createdAt: '2025-01-10T08:00:00Z',
  },
  {
    id: 'supp-02',
    tenantId: BENCHMARK_TENANT_ID,
    name: 'Vanguard Global Logistics Ltd',
    taxId: 'US-13-8829104',
    contactEmail: 'billing@vanguard-logistics.example',
    country: 'United States',
    currency: 'USD',
    paymentTerms: 'Net 30',
    totalSpend: 184200,
    totalRecovered: 0,
    activeOpportunitiesCount: 1,
    createdAt: '2025-01-15T09:30:00Z',
  },
  {
    id: 'supp-03',
    tenantId: BENCHMARK_TENANT_ID,
    name: 'Helios Semiconductor Supply GmbH',
    taxId: 'DE-81-3920194',
    contactEmail: 'disputes@helios-semicon.example',
    country: 'Germany',
    currency: 'EUR',
    paymentTerms: '2/10 Net 30',
    totalSpend: 420000,
    totalRecovered: 0,
    activeOpportunitiesCount: 2,
    createdAt: '2025-02-01T10:00:00Z',
  },
  {
    id: 'supp-04',
    tenantId: BENCHMARK_TENANT_ID,
    name: 'Al-Madar Enterprise Packaging Co',
    taxId: 'SA-10-9948271',
    contactEmail: 'finance@almadar-pack.example',
    country: 'Saudi Arabia',
    currency: 'SAR',
    paymentTerms: 'Net 45',
    totalSpend: 145000,
    totalRecovered: 0,
    activeOpportunitiesCount: 1,
    createdAt: '2025-02-10T11:00:00Z',
  },
  {
    id: 'supp-05',
    tenantId: BENCHMARK_TENANT_ID,
    name: 'Gulf Petrochemical Logistics FZ',
    taxId: 'AE-20-4491823',
    contactEmail: 'settlements@gulfpetro.example',
    country: 'United Arab Emirates',
    currency: 'AED',
    paymentTerms: 'Net 30',
    totalSpend: 295000,
    totalRecovered: 0,
    activeOpportunitiesCount: 1,
    createdAt: '2025-02-18T13:45:00Z',
  },
  {
    id: 'supp-06',
    tenantId: BENCHMARK_TENANT_ID,
    name: 'Bosphorus Precision Tooling A.S.',
    taxId: 'TR-34-1029384',
    contactEmail: 'accounting@bosphorus-tooling.example',
    country: 'Turkey',
    currency: 'TRY',
    paymentTerms: 'Net 30',
    totalSpend: 95000,
    totalRecovered: 0,
    activeOpportunitiesCount: 0,
    createdAt: '2025-03-01T08:00:00Z',
  },
  {
    id: 'supp-07',
    tenantId: BENCHMARK_TENANT_ID,
    name: 'Crestview Hardware & Fasteners Inc',
    taxId: 'US-45-7729103',
    contactEmail: 'receivables@crestviewfasteners.example',
    country: 'United States',
    currency: 'USD',
    paymentTerms: '2/10 Net 30',
    totalSpend: 168000,
    totalRecovered: 0,
    activeOpportunitiesCount: 1,
    createdAt: '2025-03-05T09:00:00Z',
  },
  {
    id: 'supp-08',
    tenantId: BENCHMARK_TENANT_ID,
    name: 'Nordic Paper & Pulp Solutions AB',
    taxId: 'SE-55-6677889',
    contactEmail: 'billing@nordicpulp.example',
    country: 'Sweden',
    currency: 'EUR',
    paymentTerms: 'Net 60',
    totalSpend: 210000,
    totalRecovered: 0,
    activeOpportunitiesCount: 0,
    createdAt: '2025-03-12T14:20:00Z',
  },
  {
    id: 'supp-09',
    tenantId: BENCHMARK_TENANT_ID,
    name: 'Nexus Cloud Infrastructure Corp',
    taxId: 'US-27-3849102',
    contactEmail: 'enterprise-billing@nexuscloud.example',
    country: 'United States',
    currency: 'USD',
    paymentTerms: 'Net 15',
    totalSpend: 88000,
    totalRecovered: 0,
    activeOpportunitiesCount: 0,
    createdAt: '2025-03-15T15:00:00Z',
  },
  {
    id: 'supp-10',
    tenantId: BENCHMARK_TENANT_ID,
    name: 'Thames Heavy Haulage UK Ltd',
    taxId: 'GB-88-2910492',
    contactEmail: 'freight-audit@thameshaulage.example',
    country: 'United Kingdom',
    currency: 'GBP',
    paymentTerms: 'Net 30',
    totalSpend: 135000,
    totalRecovered: 0,
    activeOpportunitiesCount: 1,
    createdAt: '2025-03-20T10:15:00Z',
  },
];

// 2. 20 Master Contracts with rules
export const BENCHMARK_CONTRACTS: Contract[] = [
  {
    id: 'cntr-01',
    tenantId: BENCHMARK_TENANT_ID,
    supplierId: 'supp-01',
    title: 'Master Raw Materials Supply Agreement',
    contractNumber: 'CTR-APEX-2025-01',
    startDate: '2025-01-01',
    endDate: '2026-12-31',
    status: 'ACTIVE',
    rebateTerms: '3% annual cash rebate on cumulative spend exceeding $200,000',
    discountTerms: '2% prompt settlement discount within 10 calendar days',
    rules: [
      {
        id: 'rule-01-rebate',
        contractId: 'cntr-01',
        ruleType: 'VOLUME_REBATE',
        description: '3% volume rebate on spend above $200,000 threshold',
        conditions: { thresholdSpend: 200000 },
        rewardValue: 3.0,
        rewardType: 'PERCENT',
        thresholdSpend: 200000,
      },
    ],
    createdAt: '2025-01-02T00:00:00Z',
  },
  {
    id: 'cntr-02',
    tenantId: BENCHMARK_TENANT_ID,
    supplierId: 'supp-03',
    title: 'Precision Semiconductor Master Framework',
    contractNumber: 'CTR-HELIOS-2025-09',
    startDate: '2025-01-01',
    endDate: '2026-12-31',
    status: 'ACTIVE',
    rebateTerms: '2.5% annual incentive rebate if spend exceeds $300,000',
    rules: [
      {
        id: 'rule-02-rebate',
        contractId: 'cntr-02',
        ruleType: 'VOLUME_REBATE',
        description: '2.5% rebate on spend exceeding $300,000',
        conditions: { thresholdSpend: 300000 },
        rewardValue: 2.5,
        rewardType: 'PERCENT',
        thresholdSpend: 300000,
      },
    ],
    createdAt: '2025-01-05T00:00:00Z',
  },
  ...Array.from({ length: 18 }).map((_, i) => ({
    id: `cntr-${i + 3}`,
    tenantId: BENCHMARK_TENANT_ID,
    supplierId: BENCHMARK_SUPPLIERS[(i + 2) % BENCHMARK_SUPPLIERS.length].id,
    title: `Standard Procurement Contract #${103 + i}`,
    contractNumber: `CTR-STD-2025-${i + 10}`,
    startDate: '2025-01-01',
    endDate: '2026-12-31',
    status: 'ACTIVE' as const,
    rules: [],
    createdAt: '2025-01-10T00:00:00Z',
  })),
];

// 3. Generate 100 Purchase Orders & 100 Invoices with Planted Ground-Truth Errors
export const BENCHMARK_POS: PurchaseOrder[] = [];
export const BENCHMARK_INVOICES: Invoice[] = [];
export const BENCHMARK_PAYMENTS: PaymentTransaction[] = [];

// Ground-truth known planted discrepancies catalog
export const GROUND_TRUTH_DISCREPANCIES = [
  {
    type: 'DUPLICATE_PAYMENT',
    invoiceNumber: 'INV-APEX-1042',
    expectedRecovery: 3840.0,
    supplierId: 'supp-01',
  },
  {
    type: 'SUPPLIER_OVERPAYMENT',
    invoiceNumber: 'INV-APEX-1088',
    expectedRecovery: 1550.0, // PO: 8400, Inv Paid: 9950
    supplierId: 'supp-01',
  },
  {
    type: 'MISSED_DISCOUNT',
    invoiceNumber: 'INV-HELIOS-2015',
    expectedRecovery: 480.0, // 2% of $24,000 paid in 4 days
    supplierId: 'supp-03',
  },
  {
    type: 'CONTRACT_REBATE',
    contractId: 'cntr-01',
    expectedRecovery: 9375.0, // 3% of $312,500 spend
    supplierId: 'supp-01',
  },
  {
    type: 'CONTRACT_REBATE',
    contractId: 'cntr-02',
    expectedRecovery: 10500.0, // 2.5% of $420,000 spend
    supplierId: 'supp-03',
  },
  {
    type: 'FREIGHT_OVERCHARGE',
    trackingNumber: 'THAMES-FRT-9941',
    expectedRecovery: 420.0, // Billed $1,820, Tariff $1,400
    carrier: 'Thames Heavy Haulage UK Ltd',
  },
];

// Populate 100 POs and 100 Invoices
for (let i = 1; i <= 100; i++) {
  const supplierIndex = (i - 1) % BENCHMARK_SUPPLIERS.length;
  const supplier = BENCHMARK_SUPPLIERS[supplierIndex];
  const poId = `po-${i}`;
  const poNumber = `PO-2025-${1000 + i}`;
  const invId = `inv-${i}`;
  let invNumber = `INV-${supplier.name.split(' ')[0].toUpperCase()}-${1000 + i}`;

  // Default clean amounts
  let baseAmount = Math.round((2500 + (i * 185) % 15000) * 100) / 100;
  let poAmount = baseAmount;
  let invAmount = baseAmount;
  let paidAmount = baseAmount;

  // Plant Discrepancy 1: Overpayment on Invoice #1088 (i = 88)
  if (i === 88) {
    invNumber = 'INV-APEX-1088';
    poAmount = 8400.0;
    invAmount = 9950.0;
    paidAmount = 9950.0; // Overpayment of $1,550
  }

  // Plant Discrepancy 2: Duplicate Payment on Invoice #1042 (i = 42)
  if (i === 42) {
    invNumber = 'INV-APEX-1042';
    invAmount = 3840.0;
    poAmount = 3840.0;
    paidAmount = 3840.0;
  }

  // Plant Discrepancy 3: Missed Discount on Invoice #2015 (i = 15)
  if (i === 15) {
    invNumber = 'INV-HELIOS-2015';
    invAmount = 24000.0;
    poAmount = 24000.0;
    paidAmount = 24000.0;
  }

  BENCHMARK_POS.push({
    id: poId,
    tenantId: BENCHMARK_TENANT_ID,
    supplierId: supplier.id,
    poNumber,
    orderDate: '2025-04-01',
    currency: supplier.currency,
    totalAmount: poAmount,
    status: 'FULFILLED',
    lineItems: [
      {
        description: `Industrial Component Batch #${i}`,
        quantity: 10,
        unitPrice: poAmount / 10,
        totalPrice: poAmount,
      },
    ],
  });

  BENCHMARK_INVOICES.push({
    id: invId,
    tenantId: BENCHMARK_TENANT_ID,
    supplierId: supplier.id,
    invoiceNumber: invNumber,
    purchaseOrderId: poId,
    invoiceDate: '2025-04-05',
    dueDate: '2025-05-05',
    currency: supplier.currency,
    subtotal: invAmount,
    taxAmount: 0,
    totalAmount: invAmount,
    paidAmount: paidAmount,
    paymentStatus: 'PAID',
    matchStatus: i === 88 ? 'DISCREPANCY' : 'MATCHED',
    lineItems: [
      {
        id: `line-${i}`,
        description: `Industrial Component Batch #${i}`,
        quantity: 10,
        unitPrice: invAmount / 10,
        totalPrice: invAmount,
      },
    ],
    createdAt: '2025-04-06T10:00:00Z',
  });
}

// 4. Generate 50 Payments (including duplicate disbursement for i = 42 and prompt pay for i = 15)
for (let j = 1; j <= 50; j++) {
  const inv = BENCHMARK_INVOICES[j - 1];
  BENCHMARK_PAYMENTS.push({
    id: `pay-${j}`,
    tenantId: BENCHMARK_TENANT_ID,
    supplierId: inv.supplierId,
    invoiceId: inv.id,
    transactionReference: `ACH-TRX-${88200 + j}`,
    bankAccount: 'US-JPM-TREASURY-091',
    amount: inv.paidAmount,
    currency: inv.currency,
    // Pay within 4 days for invoice #15 to trigger 2/10 prompt discount eligibility
    paymentDate: j === 15 ? '2025-04-09' : '2025-04-25',
    method: 'ACH',
    status: 'SETTLED',
  });
}

// Plant the second duplicate disbursement for Invoice #42
BENCHMARK_PAYMENTS.push({
  id: 'pay-dup-42',
  tenantId: BENCHMARK_TENANT_ID,
  supplierId: BENCHMARK_INVOICES[41].supplierId,
  invoiceId: BENCHMARK_INVOICES[41].id,
  transactionReference: 'ACH-TRX-DUP-99182',
  bankAccount: 'US-JPM-TREASURY-091',
  amount: 3840.0, // Exact duplicate payment
  currency: 'USD',
  paymentDate: '2025-05-02',
  method: 'ACH',
  status: 'SETTLED',
});

// 5. Generate 50 Shipments with planted freight overcharge
export const BENCHMARK_SHIPMENTS: ShipmentRecord[] = Array.from({ length: 50 }).map((_, idx) => {
  const isOvercharge = idx === 12;
  const chargedAmount = isOvercharge ? 1820.0 : 1400.0;
  const contractedAmount = 1400.0;
  return {
    id: `shp-${idx + 1}`,
    tenantId: BENCHMARK_TENANT_ID,
    carrier: isOvercharge ? 'Thames Heavy Haulage UK Ltd' : 'Vanguard Global Logistics Ltd',
    trackingNumber: isOvercharge ? 'THAMES-FRT-9941' : `TRACK-VGD-${10000 + idx}`,
    shipDate: '2025-05-10',
    deliveryDate: '2025-05-14',
    weightLbs: 4500,
    chargedAmount,
    contractedAmount,
    currency: 'USD',
    fuelSurcharge: isOvercharge ? 240.0 : 120.0,
    accessorialCharges: isOvercharge ? 180.0 : 0,
    discrepancyReason: isOvercharge ? 'Non-contracted fuel surcharge and accessorial liftgate fee' : undefined,
  };
});
