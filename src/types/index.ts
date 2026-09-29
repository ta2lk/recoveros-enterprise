/**
 * RecoverOS - Enterprise Revenue Recovery Platform
 * Master Data Model Types (Multi-Tenant, Auditable, Verifiable)
 */

export type UserRole =
  | 'Owner'
  | 'Admin'
  | 'Finance Manager'
  | 'Analyst'
  | 'Viewer'
  | 'Auditor'
  | 'AI Agent';

export interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: string;
  lastLoginAt?: string;
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED';
}

export interface TenantSettings {
  defaultCurrency: 'USD' | 'EUR' | 'GBP' | 'TRY' | 'AED' | 'SAR';
  autonomousThresholdUsd: number; // e.g. 500: claims under this auto-submit if verified
  highValueApprovalThresholdUsd: number; // e.g. 5000: claims above require explicit manager approval
  confidenceThresholdPercent: number; // e.g. 90%
  autoRecoveryEnabled: boolean;
  successFeePercent: number; // e.g. 20%
  legalReviewRequired: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: 'TRIAL' | 'STARTER' | 'GROWTH' | 'ENTERPRISE';
  mode: 'DEMO' | 'PRODUCTION';
  settings: TenantSettings;
  createdAt: string;
}

export type LeakageCategory =
  | 'SUPPLIER_OVERPAYMENT'
  | 'DUPLICATE_PAYMENT'
  | 'MISSED_DISCOUNT'
  | 'CONTRACT_REBATE'
  | 'FREIGHT_OVERCHARGE'
  | 'PRICING_DISCREPANCY'
  | 'WARRANTY_CLAIM'
  | 'SUBSCRIPTION_WASTE'
  | 'MARKETPLACE_FEE_ERROR';

export type OpportunityStatus =
  | 'DETECTED'
  | 'REVIEWED'
  | 'CLAIMED'
  | 'SETTLED'
  | 'DISCOVERED'
  | 'VERIFIED'
  | 'READY'
  | 'CLAIM_SUBMITTED'
  | 'RECOVERED'
  | 'DISMISSED';

export type ClaimStatus =
  | 'DISCOVERED'
  | 'VERIFIED'
  | 'READY'
  | 'APPROVAL_REQUIRED'
  | 'APPROVED'
  | 'SUBMITTED'
  | 'ACKNOWLEDGED'
  | 'NEGOTIATING'
  | 'ACCEPTED'
  | 'SETTLEMENT_PENDING'
  | 'RECOVERED'
  | 'REJECTED'
  | 'DISPUTED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface Supplier {
  id: string;
  tenantId: string;
  name: string;
  taxId: string;
  contactEmail: string;
  contactPhone?: string;
  country: string;
  currency: string;
  paymentTerms: string; // e.g., "2/10 Net 30"
  disputeContactName?: string;
  totalSpend: number;
  totalRecovered: number;
  activeOpportunitiesCount: number;
  createdAt: string;
}

export interface ContractRule {
  id: string;
  contractId: string;
  ruleType: 'VOLUME_REBATE' | 'EARLY_PAYMENT_DISCOUNT' | 'SLA_PENALTY' | 'PRICE_CAP' | 'FREIGHT_ALLOWANCE';
  description: string;
  conditions: Record<string, any>;
  rewardValue: number; // percentage or fixed
  rewardType: 'PERCENT' | 'FIXED_AMOUNT';
  thresholdSpend?: number;
}

export interface Contract {
  id: string;
  tenantId: string;
  supplierId: string;
  title: string;
  contractNumber: string;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'EXPIRED' | 'RENEWING';
  rebateTerms?: string;
  discountTerms?: string;
  sourceDocumentId?: string;
  rules: ContractRule[];
  createdAt: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  itemCode?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Invoice {
  id: string;
  tenantId: string;
  supplierId: string;
  invoiceNumber: string;
  purchaseOrderId?: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
  matchStatus: 'MATCHED' | 'DISCREPANCY' | 'PENDING';
  sourceDocumentId?: string;
  lineItems: InvoiceLineItem[];
  createdAt: string;
}

export interface PurchaseOrder {
  id: string;
  tenantId: string;
  supplierId: string;
  poNumber: string;
  orderDate: string;
  currency: string;
  totalAmount: number;
  status: 'ISSUED' | 'FULFILLED' | 'CLOSED';
  lineItems: Array<{
    itemCode?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
}

export interface PaymentTransaction {
  id: string;
  tenantId: string;
  supplierId: string;
  invoiceId?: string;
  transactionReference: string;
  bankAccount: string;
  amount: number;
  currency: string;
  paymentDate: string;
  method: 'ACH' | 'WIRE' | 'CHECK' | 'CARD';
  status: 'SETTLED' | 'PENDING' | 'REVERSED';
}

export interface ShipmentRecord {
  id: string;
  tenantId: string;
  carrier: string;
  trackingNumber: string;
  shipDate: string;
  deliveryDate: string;
  weightLbs: number;
  chargedAmount: number;
  contractedAmount: number;
  currency: string;
  fuelSurcharge: number;
  accessorialCharges: number;
  discrepancyReason?: string;
}

export interface DocumentRecord {
  id: string;
  tenantId: string;
  name: string;
  fileType: 'PDF' | 'CSV' | 'XLSX' | 'DOCX' | 'IMAGE';
  fileSize: number;
  uploadedAt: string;
  uploadedBy: string;
  status: 'PROCESSING' | 'PARSED' | 'FAILED';
  extractionConfidence: number; // 0 - 100
  parsedEntitiesCount: number;
  rawTextPreview?: string;
  fileUrl?: string;
}

export interface Evidence {
  id: string;
  tenantId: string;
  opportunityId: string;
  type: 'INVOICE' | 'PURCHASE_ORDER' | 'CONTRACT_CLAUSE' | 'PAYMENT_RECEIPT' | 'FREIGHT_BILL' | 'BANK_RECORD';
  sourceDocumentId?: string;
  documentTitle: string;
  referenceNumber: string;
  relevantExcerpt: string;
  specificClause?: string;
  confidence: number; // 0 - 100
  timestamp: string;
}

export interface DeterministicCalculation {
  id: string;
  opportunityId: string;
  formula: string;
  expectedAmount: number;
  actualAmount: number;
  difference: number;
  currency: string;
  exchangeRate: number;
  tax: number;
  discount: number;
  rebate: number;
  tolerance: number;
  codeVerified: boolean;
  computedAt: string;
}

export interface Opportunity {
  id: string;
  tenantId: string;
  title: string;
  category: LeakageCategory;
  supplierId: string;
  supplierName: string;
  sourceType: 'INVOICE_VS_PO' | 'DUPLICATE_PAYMENT' | 'MISSED_DISCOUNT' | 'CONTRACT_REBATE' | 'FREIGHT_SURCHARGE';
  expectedAmount: number;
  actualAmount: number;
  recoverableAmount: number;
  currency: string;
  confidence: number; // 0 - 100
  evidenceList: Evidence[];
  calculation: DeterministicCalculation;
  status: OpportunityStatus;
  claimId?: string;
  discoveredByAgent: string;
  createdAt: string;
  verifiedAt?: string;
}

export interface Claim {
  id: string;
  tenantId: string;
  opportunityId: string;
  claimNumber: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  currency: string;
  status: ClaimStatus;
  approvalRequired: boolean;
  approvedBy?: string;
  approvedAt?: string;
  submittedAt?: string;
  settledAt?: string;
  negotiationLog: Array<{
    sender: 'RECOVEROS_AGENT' | 'SUPPLIER' | 'HUMAN_OPERATOR';
    message: string;
    timestamp: string;
  }>;
  draftSubject?: string;
  draftBody?: string;
  createdAt: string;
}

export interface VerifiedRecovery {
  id: string;
  tenantId: string;
  claimId: string;
  opportunityId: string;
  supplierName: string;
  recoveredAmount: number;
  currency: string;
  settlementType: 'CREDIT_MEMO' | 'BANK_TRANSFER' | 'INVOICE_OFFSET' | 'CHECK';
  referenceNumber: string;
  proofDocumentId?: string;
  proofDocumentName?: string;
  successFeePercent: number;
  successFeeAmount: number;
  verifiedAt: string;
  verifiedBy: string;
}

export interface AuditLog {
  id: string;
  tenantId: string;
  timestamp: string;
  actor: string;
  role: string;
  action: string;
  targetType: string;
  targetId: string;
  previousState?: string;
  newState?: string;
  reason?: string;
  agentName?: string;
  toolName?: string;
  result: 'SUCCESS' | 'FAILED' | 'REJECTED';
}

export interface AgentDef {
  id: string;
  name: string;
  arabicName: string;
  role: string;
  description: string;
  status: 'IDLE' | 'ACTIVE' | 'WAITING_APPROVAL' | 'PAUSED';
  allowedTools: string[];
  deniedTools: string[];
  maxFinancialExposureUsd: number;
  tasksCompleted: number;
  lastActive: string;
}

export interface AgentRun {
  id: string;
  tenantId: string;
  agentName: string;
  workflow: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'REQUIRES_APPROVAL';
  startedAt: string;
  completedAt?: string;
  findingsCount: number;
  amountIdentified: number;
  summary: string;
  logs: string[];
}

export interface IntegrationConnector {
  id: string;
  name: string;
  category: 'ERP' | 'ACCOUNTING' | 'PAYMENT' | 'EMAIL' | 'LOGISTICS';
  status: 'CONNECTED' | 'DISCONNECTED' | 'SYNCING' | 'ERROR';
  authType: 'OAUTH2' | 'API_KEY';
  lastSyncAt?: string;
  recordsSyncedCount?: number;
  iconName: string;
  docsUrl: string;
}

export interface BenchmarkMetrics {
  totalRecordsProcessed: number;
  plantedErrorsCount: number;
  detectedErrorsCount: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1Score: number;
  calculationAccuracy: number;
  averageProcessingTimeMs: number;
  timestamp: string;
}
