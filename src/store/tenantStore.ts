import {
  Tenant,
  User,
  Supplier,
  Contract,
  Invoice,
  PurchaseOrder,
  PaymentTransaction,
  ShipmentRecord,
  DocumentRecord,
  Opportunity,
  Claim,
  VerifiedRecovery,
  AuditLog,
  AgentDef,
  AgentRun,
  IntegrationConnector,
  BenchmarkMetrics,
} from '../types';
import { INITIAL_AGENTS } from '../agents/types';
import {
  BENCHMARK_SUPPLIERS,
  BENCHMARK_CONTRACTS,
  BENCHMARK_INVOICES,
  BENCHMARK_POS,
  BENCHMARK_PAYMENTS,
  BENCHMARK_SHIPMENTS,
} from '../data/benchmarkDataset';
import { MatchingEngine } from '../engine/matching';
import { BenchmarkEvaluator } from '../engine/benchmark';
import { RbacGuard } from '../security/rbac';

export interface TenantState {
  currentTenant: Tenant;
  currentUser: User;
  availableTenants: Tenant[];
  suppliers: Supplier[];
  contracts: Contract[];
  invoices: Invoice[];
  purchaseOrders: PurchaseOrder[];
  payments: PaymentTransaction[];
  shipments: ShipmentRecord[];
  documents: DocumentRecord[];
  opportunities: Opportunity[];
  claims: Claim[];
  recoveries: VerifiedRecovery[];
  auditLogs: AuditLog[];
  agents: AgentDef[];
  agentRuns: AgentRun[];
  integrations: IntegrationConnector[];
  benchmarkMetrics: BenchmarkMetrics | null;
}

const DEFAULT_CONNECTORS: IntegrationConnector[] = [
  {
    id: 'conn-quickbooks',
    name: 'QuickBooks Online',
    category: 'ACCOUNTING',
    status: 'DISCONNECTED',
    authType: 'OAUTH2',
    iconName: 'Receipt',
    docsUrl: 'https://developer.intuit.com/app/developer/qbo/docs/develop',
  },
  {
    id: 'conn-xero',
    name: 'Xero Accounting',
    category: 'ACCOUNTING',
    status: 'DISCONNECTED',
    authType: 'OAUTH2',
    iconName: 'BookOpen',
    docsUrl: 'https://developer.xero.com/documentation/api/accounting/overview',
  },
  {
    id: 'conn-netsuite',
    name: 'Oracle NetSuite',
    category: 'ERP',
    status: 'DISCONNECTED',
    authType: 'OAUTH2',
    iconName: 'Layers',
    docsUrl: 'https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help',
  },
  {
    id: 'conn-sap',
    name: 'SAP S/4HANA',
    category: 'ERP',
    status: 'DISCONNECTED',
    authType: 'OAUTH2',
    iconName: 'Database',
    docsUrl: 'https://api.sap.com/package/S4HANAOPAPI',
  },
  {
    id: 'conn-stripe',
    name: 'Stripe Payments',
    category: 'PAYMENT',
    status: 'DISCONNECTED',
    authType: 'API_KEY',
    iconName: 'CreditCard',
    docsUrl: 'https://stripe.com/docs/api',
  },
  {
    id: 'conn-gmail',
    name: 'Google Workspace Gmail',
    category: 'EMAIL',
    status: 'DISCONNECTED',
    authType: 'OAUTH2',
    iconName: 'Mail',
    docsUrl: 'https://developers.google.com/gmail/api',
  },
];

export const DEMO_TENANT: Tenant = {
  id: 'tenant-demo-synthetic',
  name: 'Acme Enterprise Global Corp',
  slug: 'acme-enterprise',
  plan: 'ENTERPRISE',
  mode: 'DEMO',
  settings: {
    defaultCurrency: 'USD',
    autonomousThresholdUsd: 500,
    highValueApprovalThresholdUsd: 5000,
    confidenceThresholdPercent: 90,
    autoRecoveryEnabled: true,
    successFeePercent: 20,
    legalReviewRequired: true,
  },
  createdAt: '2025-01-01T00:00:00Z',
};

export const PROD_TENANT: Tenant = {
  id: 'tenant-prod-live',
  name: 'Sovereign Capital Holdings Ltd',
  slug: 'sovereign-live',
  plan: 'GROWTH',
  mode: 'PRODUCTION',
  settings: {
    defaultCurrency: 'USD',
    autonomousThresholdUsd: 500,
    highValueApprovalThresholdUsd: 5000,
    confidenceThresholdPercent: 95,
    autoRecoveryEnabled: false,
    successFeePercent: 20,
    legalReviewRequired: true,
  },
  createdAt: '2026-03-01T00:00:00Z',
};

export const DEMO_USER: User = {
  id: 'usr-cfo-demo',
  tenantId: DEMO_TENANT.id,
  email: 'cfo@acme-enterprise.example',
  name: 'Sarah Jenkins, CPA',
  role: 'Owner',
  avatarUrl: '/src/assets/images/avatar_cfo_director_1790534430873.jpg',
  createdAt: '2025-01-01T00:00:00Z',
  status: 'ACTIVE',
};

export class TenantStateManager {
  private static listeners: Array<() => void> = [];

  static subscribe(fn: () => void) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private static notify() {
    this.listeners.forEach((l) => l());
  }

  static getInitialState(): TenantState {
    const savedMode = localStorage.getItem('recoveros_active_mode');
    const isProd = savedMode === 'PRODUCTION';
    const activeTenant = isProd ? PROD_TENANT : DEMO_TENANT;

    const savedState = localStorage.getItem(`recoveros_state_${activeTenant.id}`);
    if (savedState) {
      try {
        return JSON.parse(savedState);
      } catch (e) {
        console.error('Failed to parse saved state:', e);
      }
    }

    if (isProd) {
      // Production starts with a clean, unpopulated state
      return {
        currentTenant: PROD_TENANT,
        currentUser: {
          ...DEMO_USER,
          tenantId: PROD_TENANT.id,
          email: 'treasury@sovereign-live.example',
          name: 'Chief Financial Officer',
        },
        availableTenants: [DEMO_TENANT, PROD_TENANT],
        suppliers: [],
        contracts: [],
        invoices: [],
        purchaseOrders: [],
        payments: [],
        shipments: [],
        documents: [],
        opportunities: [],
        claims: [],
        recoveries: [],
        auditLogs: [
          {
            id: 'log-prod-init',
            tenantId: PROD_TENANT.id,
            timestamp: new Date().toISOString(),
            actor: 'System Security',
            role: 'Admin',
            action: 'INITIALIZE_TENANT',
            targetType: 'Tenant',
            targetId: PROD_TENANT.id,
            newState: 'PRODUCTION_READY',
            reason: 'Production tenant initialized with zero mock data. Awaiting integrations.',
            result: 'SUCCESS',
          },
        ],
        agents: INITIAL_AGENTS,
        agentRuns: [],
        integrations: DEFAULT_CONNECTORS,
        benchmarkMetrics: null,
      };
    }

    // Demo Mode: Seed with synthetic benchmark dataset & pre-audit results
    const initialOpps = MatchingEngine.runAudit({
      tenantId: DEMO_TENANT.id,
      suppliers: BENCHMARK_SUPPLIERS,
      invoices: BENCHMARK_INVOICES,
      purchaseOrders: BENCHMARK_POS,
      contracts: BENCHMARK_CONTRACTS,
      payments: BENCHMARK_PAYMENTS,
      shipments: BENCHMARK_SHIPMENTS,
    });

    // Create 2 initial claims and 1 settled recovery for demonstration
    const initialClaims: Claim[] = [
      {
        id: 'claim-demo-01',
        tenantId: DEMO_TENANT.id,
        opportunityId: initialOpps[0]?.id || 'opp-demo-1',
        claimNumber: 'REC-2026-00412',
        supplierId: 'supp-01',
        supplierName: 'Apex Industrial Materials Corp',
        amount: initialOpps[0]?.recoverableAmount || 3840.0,
        currency: 'USD',
        status: 'SUBMITTED',
        approvalRequired: false,
        submittedAt: '2026-09-20T14:30:00Z',
        negotiationLog: [
          {
            sender: 'RECOVEROS_AGENT',
            message: 'Formal recovery notice submitted with duplicate disbursement bank receipts.',
            timestamp: '2026-09-20T14:30:00Z',
          },
          {
            sender: 'SUPPLIER',
            message: 'Vendor AR acknowledged receipt. Routing to dispute reconciliation team.',
            timestamp: '2026-09-22T09:15:00Z',
          },
        ],
        createdAt: '2026-09-18T10:00:00Z',
      },
      {
        id: 'claim-demo-02',
        tenantId: DEMO_TENANT.id,
        opportunityId: initialOpps[1]?.id || 'opp-demo-2',
        claimNumber: 'REC-2026-00413',
        supplierId: 'supp-01',
        supplierName: 'Apex Industrial Materials Corp',
        amount: initialOpps[1]?.recoverableAmount || 1550.0,
        currency: 'USD',
        status: 'APPROVAL_REQUIRED',
        approvalRequired: true,
        negotiationLog: [],
        createdAt: '2026-09-25T11:20:00Z',
      },
    ];

    const initialRecoveries: VerifiedRecovery[] = [
      {
        id: 'rec-demo-settled-01',
        tenantId: DEMO_TENANT.id,
        claimId: 'claim-demo-historical-99',
        opportunityId: 'opp-historical-99',
        supplierName: 'Apex Industrial Materials Corp',
        recoveredAmount: 4250.0,
        currency: 'USD',
        settlementType: 'CREDIT_MEMO',
        referenceNumber: 'CM-APEX-99201',
        proofDocumentName: 'Credit_Memo_CM-APEX-99201.pdf',
        successFeePercent: 20,
        successFeeAmount: 850.0,
        verifiedAt: '2026-09-15T16:00:00Z',
        verifiedBy: 'Recovery Agent (Verified against JPMC Treasury Deposit)',
      },
    ];

    const initialLogs: AuditLog[] = [
      {
        id: 'log-001',
        tenantId: DEMO_TENANT.id,
        timestamp: '2026-09-27T09:42:00Z',
        actor: 'Discovery Agent',
        role: 'AI Agent',
        action: 'IDENTIFIED_LEAKAGE',
        targetType: 'Opportunity',
        targetId: 'opp-dup-inv-42',
        newState: 'VERIFIED',
        reason: 'Identified duplicate payment of $3,840 against Invoice #INV-APEX-1042',
        agentName: 'Discovery Agent',
        toolName: 'scan_ledger',
        result: 'SUCCESS',
      },
      {
        id: 'log-002',
        tenantId: DEMO_TENANT.id,
        timestamp: '2026-09-27T09:47:00Z',
        actor: 'Contract Agent',
        role: 'AI Agent',
        action: 'EXTRACTED_RULE',
        targetType: 'Contract',
        targetId: 'cntr-01',
        newState: 'RULE_ACTIVE',
        reason: 'Extracted 3% volume rebate clause on spend exceeding $200,000',
        agentName: 'Contract Agent',
        toolName: 'read_contract',
        result: 'SUCCESS',
      },
      {
        id: 'log-003',
        tenantId: DEMO_TENANT.id,
        timestamp: '2026-09-27T09:50:00Z',
        actor: 'Calculation Agent',
        role: 'AI Agent',
        action: 'DETERMINISTIC_CALCULATION',
        targetType: 'Calculation',
        targetId: 'calc-opp-dup-inv-42',
        newState: 'CODE_VERIFIED',
        reason: 'Deterministic code verification confirmed difference of $3,840.00 without floating point error.',
        agentName: 'Calculation Agent',
        toolName: 'calculate_difference',
        result: 'SUCCESS',
      },
      {
        id: 'log-004',
        tenantId: DEMO_TENANT.id,
        timestamp: '2026-09-27T09:52:00Z',
        actor: 'Claim Agent',
        role: 'AI Agent',
        action: 'DRAFT_CLAIM',
        targetType: 'Claim',
        targetId: 'claim-demo-01',
        newState: 'SUBMITTED',
        reason: 'Claim below autonomous threshold ($500 limit). Automatically submitted notice.',
        agentName: 'Claim Agent',
        toolName: 'draft_claim_letter',
        result: 'SUCCESS',
      },
    ];

    const initialBenchmark = BenchmarkEvaluator.runBenchmark();

    return {
      currentTenant: DEMO_TENANT,
      currentUser: DEMO_USER,
      availableTenants: [DEMO_TENANT, PROD_TENANT],
      suppliers: BENCHMARK_SUPPLIERS,
      contracts: BENCHMARK_CONTRACTS,
      invoices: BENCHMARK_INVOICES,
      purchaseOrders: BENCHMARK_POS,
      payments: BENCHMARK_PAYMENTS,
      shipments: BENCHMARK_SHIPMENTS,
      documents: [
        {
          id: 'doc-apex-contract',
          tenantId: DEMO_TENANT.id,
          name: 'Master_Supply_Agreement_Apex_2025.pdf',
          fileType: 'PDF',
          fileSize: 2450000,
          uploadedAt: '2026-09-01T10:00:00Z',
          uploadedBy: 'Sarah Jenkins, CPA',
          status: 'PARSED',
          extractionConfidence: 98,
          parsedEntitiesCount: 42,
          rawTextPreview: 'Section 4.2 Payment Terms: 2/10 Net 30. Clause 8.1 Volume Incentive Rebate...',
        },
        {
          id: 'doc-ledger-q2',
          tenantId: DEMO_TENANT.id,
          name: 'Disbursements_Ledger_Q2_2025.csv',
          fileType: 'CSV',
          fileSize: 840000,
          uploadedAt: '2026-09-05T12:30:00Z',
          uploadedBy: 'System Connector',
          status: 'PARSED',
          extractionConfidence: 100,
          parsedEntitiesCount: 150,
          rawTextPreview: 'TrxID, Date, Vendor, Amount, Method, Reference...',
        },
      ],
      opportunities: initialOpps,
      claims: initialClaims,
      recoveries: initialRecoveries,
      auditLogs: initialLogs,
      agents: INITIAL_AGENTS,
      agentRuns: [
        {
          id: 'run-01',
          tenantId: DEMO_TENANT.id,
          agentName: 'Discovery Agent',
          workflow: 'Full Ledger Ingestion Scan',
          status: 'COMPLETED',
          startedAt: '2026-09-27T09:40:00Z',
          completedAt: '2026-09-27T09:42:00Z',
          findingsCount: 5,
          amountIdentified: 25745.0,
          summary: 'Scanned 100 invoices and 50 payments. Identified 5 verifiable leakage opportunities.',
          logs: [
            'Ingesting invoice records...',
            'Comparing against authorized purchase orders...',
            'Evaluating duplicate transactions on bank statement...',
            'Completed with 0 fatal errors.',
          ],
        },
      ],
      integrations: DEFAULT_CONNECTORS.map((c) =>
        c.id === 'conn-quickbooks' ? { ...c, status: 'CONNECTED' as const, lastSyncAt: '10m ago' } : c
      ),
      benchmarkMetrics: initialBenchmark,
    };
  }

  static saveState(state: TenantState) {
    localStorage.setItem(`recoveros_state_${state.currentTenant.id}`, JSON.stringify(state));
    localStorage.setItem('recoveros_active_mode', state.currentTenant.mode);
    this.notify();
  }

  /**
   * Log an immutable audit event
   */
  static logAudit(state: TenantState, log: Omit<AuditLog, 'id' | 'timestamp' | 'tenantId'>): TenantState {
    const newLog: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenantId: state.currentTenant.id,
      timestamp: new Date().toISOString(),
      ...log,
    };

    const newState: TenantState = {
      ...state,
      auditLogs: [newLog, ...state.auditLogs],
    };
    this.saveState(newState);
    return newState;
  }
}
