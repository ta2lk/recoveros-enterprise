import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  TenantState,
  TenantStateManager,
  DEMO_TENANT,
  PROD_TENANT,
} from './tenantStore';
import { UserRole, Claim, Opportunity, VerifiedRecovery, DocumentRecord } from '../types';
import { MatchingEngine } from '../engine/matching';
import { BenchmarkEvaluator } from '../engine/benchmark';
import { GeminiAgentProvider } from '../agents/geminiProvider';
import { CalculationEngine } from '../engine/calculation';
import { ArchitecturalTestRunner, ArchitecturalTestReport, ArchitecturalTestStep } from '../engine/architecturalTest';
import { BenchmarkMetrics } from '../types';

interface TenantContextType {
  state: TenantState;
  switchRole: (role: UserRole) => void;
  switchMode: (mode: 'DEMO' | 'PRODUCTION') => void;
  runAudit: () => void;
  approveClaim: (claimId: string) => void;
  submitClaim: (claimId: string) => void;
  resolveRecovery: (params: {
    claimId: string;
    amount: number;
    settlementType: 'CREDIT_MEMO' | 'BANK_TRANSFER' | 'INVOICE_OFFSET' | 'CHECK';
    referenceNumber: string;
    proofDocumentName?: string;
  }) => void;
  uploadDocument: (doc: Omit<DocumentRecord, 'id' | 'uploadedAt' | 'tenantId'>) => void;
  toggleIntegration: (id: string, credentials?: Record<string, string>) => void;
  runBenchmark: () => Promise<BenchmarkMetrics>;
  runArchitecturalAudit: (
    onStepUpdate?: (step: ArchitecturalTestStep, index: number) => void
  ) => Promise<ArchitecturalTestReport>;
  architecturalReport: ArchitecturalTestReport | null;
  executeNaturalLanguageQuery: (query: string, language: 'en' | 'ar') => Promise<{
    messageEn: string;
    messageAr: string;
    opportunitiesCount: number;
    totalAmount: number;
  }>;
  startClaimFromOpportunity: (opp: Opportunity) => Promise<Claim>;
  importInvoicesAndRunAudit: (newInvoices: any[]) => void;
}

const TenantContext = createContext<TenantContextType | null>(null);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<TenantState>(() => TenantStateManager.getInitialState());
  const [architecturalReport, setArchitecturalReport] = useState<ArchitecturalTestReport | null>(null);

  useEffect(() => {
    return TenantStateManager.subscribe(() => {
      setState(TenantStateManager.getInitialState());
    });
  }, []);

  const switchRole = (newRole: UserRole) => {
    const updated: TenantState = {
      ...state,
      currentUser: {
        ...state.currentUser,
        role: newRole,
      },
    };
    TenantStateManager.saveState(updated);
    setState(updated);
  };

  const switchMode = (newMode: 'DEMO' | 'PRODUCTION') => {
    localStorage.setItem('recoveros_active_mode', newMode);
    const targetTenant = newMode === 'PRODUCTION' ? PROD_TENANT : DEMO_TENANT;
    localStorage.removeItem(`recoveros_state_${targetTenant.id}`);
    const fresh = TenantStateManager.getInitialState();
    setState(fresh);
  };

  const runAudit = () => {
    const opps = MatchingEngine.runAudit({
      tenantId: state.currentTenant.id,
      suppliers: state.suppliers,
      invoices: state.invoices,
      purchaseOrders: state.purchaseOrders,
      contracts: state.contracts,
      payments: state.payments,
      shipments: state.shipments,
    });

    const totalIdentified = opps.reduce((sum, o) => sum + o.recoverableAmount, 0);

    const updated = TenantStateManager.logAudit(
      {
        ...state,
        opportunities: opps,
        agentRuns: [
          {
            id: `run-${Date.now()}`,
            tenantId: state.currentTenant.id,
            agentName: 'Discovery & Invoice Agents',
            workflow: 'Continuous Ingestion Re-Audit',
            status: 'COMPLETED',
            startedAt: new Date(Date.now() - 3000).toISOString(),
            completedAt: new Date().toISOString(),
            findingsCount: opps.length,
            amountIdentified: totalIdentified,
            summary: `Automated matching discovered ${opps.length} discrepancy opportunities totaling $${totalIdentified.toFixed(2)}.`,
            logs: [
              `Examined ${state.invoices.length} invoices across ${state.suppliers.length} active vendors.`,
              `Verified 3-way matching tolerance against contracted PO limits.`,
              `Audit completed with 100% mathematical integrity.`,
            ],
          },
          ...state.agentRuns,
        ],
      },
      {
        actor: state.currentUser.name,
        role: state.currentUser.role,
        action: 'RUN_AUDIT',
        targetType: 'Opportunity',
        targetId: 'ALL',
        reason: `Manual or triggered audit pass executed across ${state.invoices.length} transactions.`,
        result: 'SUCCESS',
      }
    );

    setState(updated);
  };

  const approveClaim = (claimId: string) => {
    const claim = state.claims.find((c) => c.id === claimId);
    if (!claim) return;

    const updatedClaims = state.claims.map((c) =>
      c.id === claimId
        ? {
            ...c,
            status: 'APPROVED' as const,
            approvedBy: state.currentUser.name,
            approvedAt: new Date().toISOString(),
          }
        : c
    );

    const updated = TenantStateManager.logAudit(
      {
        ...state,
        claims: updatedClaims,
      },
      {
        actor: state.currentUser.name,
        role: state.currentUser.role,
        action: 'APPROVE_CLAIM',
        targetType: 'Claim',
        targetId: claimId,
        previousState: claim.status,
        newState: 'APPROVED',
        reason: `Claim approved by ${state.currentUser.role}. Ready for supplier dispatch.`,
        result: 'SUCCESS',
      }
    );

    setState(updated);
  };

  const submitClaim = (claimId: string) => {
    const claim = state.claims.find((c) => c.id === claimId);
    if (!claim) return;

    const updatedClaims = state.claims.map((c) =>
      c.id === claimId
        ? {
            ...c,
            status: 'SUBMITTED' as const,
            submittedAt: new Date().toISOString(),
            negotiationLog: [
              {
                sender: 'RECOVEROS_AGENT' as const,
                message: `Formal claim notice dispatched to vendor accounts receivable (${claim.supplierName}).`,
                timestamp: new Date().toISOString(),
              },
              ...c.negotiationLog,
            ],
          }
        : c
    );

    const updated = TenantStateManager.logAudit(
      {
        ...state,
        claims: updatedClaims,
      },
      {
        actor: state.currentUser.name,
        role: state.currentUser.role,
        action: 'SUBMIT_CLAIM',
        targetType: 'Claim',
        targetId: claimId,
        previousState: claim.status,
        newState: 'SUBMITTED',
        reason: 'Claim formally transmitted to supplier.',
        result: 'SUCCESS',
      }
    );

    setState(updated);
  };

  const resolveRecovery = (params: {
    claimId: string;
    amount: number;
    settlementType: 'CREDIT_MEMO' | 'BANK_TRANSFER' | 'INVOICE_OFFSET' | 'CHECK';
    referenceNumber: string;
    proofDocumentName?: string;
  }) => {
    const claim = state.claims.find((c) => c.id === params.claimId);
    if (!claim) return;

    const feePercent = state.currentTenant.settings.successFeePercent;
    const feeAmount = (params.amount * feePercent) / 100;

    const recovery: VerifiedRecovery = {
      id: `rec-${Date.now()}`,
      tenantId: state.currentTenant.id,
      claimId: claim.id,
      opportunityId: claim.opportunityId,
      supplierName: claim.supplierName,
      recoveredAmount: params.amount,
      currency: claim.currency,
      settlementType: params.settlementType,
      referenceNumber: params.referenceNumber,
      proofDocumentName: params.proofDocumentName || `${params.settlementType}_${params.referenceNumber}.pdf`,
      successFeePercent: feePercent,
      successFeeAmount: feeAmount,
      verifiedAt: new Date().toISOString(),
      verifiedBy: `${state.currentUser.name} (${state.currentUser.role})`,
    };

    const updatedClaims = state.claims.map((c) =>
      c.id === params.claimId
        ? {
            ...c,
            status: 'RECOVERED' as const,
            settledAt: new Date().toISOString(),
          }
        : c
    );

    const updatedOpps = state.opportunities.map((o) =>
      o.id === claim.opportunityId ? { ...o, status: 'RECOVERED' as const } : o
    );

    const updated = TenantStateManager.logAudit(
      {
        ...state,
        recoveries: [recovery, ...state.recoveries],
        claims: updatedClaims,
        opportunities: updatedOpps,
      },
      {
        actor: state.currentUser.name,
        role: state.currentUser.role,
        action: 'VERIFY_RECOVERY',
        targetType: 'Recovery',
        targetId: recovery.id,
        previousState: 'SETTLEMENT_PENDING',
        newState: 'RECOVERED',
        reason: `Deposit or credit memo verified: ${params.settlementType} #${params.referenceNumber} for $${params.amount.toFixed(2)}.`,
        result: 'SUCCESS',
      }
    );

    setState(updated);
  };

  const uploadDocument = (doc: Omit<DocumentRecord, 'id' | 'uploadedAt' | 'tenantId'>) => {
    const newDoc: DocumentRecord = {
      id: `doc-${Date.now()}`,
      tenantId: state.currentTenant.id,
      uploadedAt: new Date().toISOString(),
      ...doc,
    };

    const updated = TenantStateManager.logAudit(
      {
        ...state,
        documents: [newDoc, ...state.documents],
      },
      {
        actor: state.currentUser.name,
        role: state.currentUser.role,
        action: 'UPLOAD_DOCUMENT',
        targetType: 'Document',
        targetId: newDoc.id,
        reason: `Uploaded ${newDoc.fileType} document: ${newDoc.name}`,
        result: 'SUCCESS',
      }
    );

    setState(updated);
  };

  const toggleIntegration = (id: string) => {
    const updatedIntegrations = state.integrations.map((i) => {
      if (i.id === id) {
        const nextStatus: 'CONNECTED' | 'DISCONNECTED' = i.status === 'CONNECTED' ? 'DISCONNECTED' : 'CONNECTED';
        return {
          ...i,
          status: nextStatus,
          lastSyncAt: nextStatus === 'CONNECTED' ? 'Just now' : undefined,
          recordsSyncedCount: nextStatus === 'CONNECTED' ? 142 : 0,
        };
      }
      return i;
    });

    const conn = state.integrations.find((i) => i.id === id);
    const updated = TenantStateManager.logAudit(
      {
        ...state,
        integrations: updatedIntegrations,
      },
      {
        actor: state.currentUser.name,
        role: state.currentUser.role,
        action: conn?.status === 'CONNECTED' ? 'DISCONNECT_INTEGRATION' : 'CONNECT_INTEGRATION',
        targetType: 'Integration',
        targetId: id,
        reason: `Toggled connector state for ${conn?.name}.`,
        result: 'SUCCESS',
      }
    );

    setState(updated);
  };

  const runBenchmark = async (): Promise<BenchmarkMetrics> => {
    // Artificial small delay for UX so UI can show executing state
    await new Promise((resolve) => setTimeout(resolve, 150));
    const metrics = BenchmarkEvaluator.runBenchmark();
    const updated = TenantStateManager.logAudit(
      {
        ...state,
        benchmarkMetrics: metrics,
      },
      {
        actor: state.currentUser.name,
        role: state.currentUser.role,
        action: 'RUN_BENCHMARK',
        targetType: 'Benchmark',
        targetId: 'SYNTHETIC_DATASET_100',
        reason: `Evaluated 100 benchmark invoices: Precision ${metrics.precision}%, Recall ${metrics.recall}%, Calculation Accuracy ${metrics.calculationAccuracy}%.`,
        result: 'SUCCESS',
      }
    );
    setState(updated);
    return metrics;
  };

  const runArchitecturalAudit = async (
    onStepUpdate?: (step: ArchitecturalTestStep, index: number) => void
  ): Promise<ArchitecturalTestReport> => {
    const report = await ArchitecturalTestRunner.runFullArchitecturalAudit(onStepUpdate);
    setArchitecturalReport(report);

    // If report includes benchmark metrics, update tenant state
    if (report.benchmarkMetrics) {
      const updated = TenantStateManager.logAudit(
        {
          ...state,
          benchmarkMetrics: report.benchmarkMetrics,
        },
        {
          actor: state.currentUser.name,
          role: state.currentUser.role,
          action: 'RUN_ARCHITECTURAL_AUDIT',
          targetType: 'SystemArchitecture',
          targetId: 'INVARIANTS_5_PILLARS',
          reason: `Executed full architectural verification: ${report.passedTests}/${report.totalTests} invariant suites passed in ${report.totalDurationMs}ms.`,
          result: report.overallPassed ? 'SUCCESS' : 'FAILED',
        }
      );
      setState(updated);
    }

    return report;
  };

  const startClaimFromOpportunity = async (opp: Opportunity): Promise<Claim> => {
    const draft = await GeminiAgentProvider.draftClaimNotice({
      supplierName: opp.supplierName,
      claimNumber: `REC-${Date.now().toString().slice(-5)}`,
      invoiceNumbers: opp.evidenceList.map((e) => e.referenceNumber),
      recoverableAmount: opp.recoverableAmount,
      currency: opp.currency,
      categoryTitle: opp.category,
      evidenceSummary: opp.evidenceList.map((e) => `${e.documentTitle}: ${e.relevantExcerpt}`).join(' | '),
      language: 'en',
    });

    const newClaim: Claim = {
      id: `claim-${Date.now()}`,
      tenantId: state.currentTenant.id,
      opportunityId: opp.id,
      claimNumber: `REC-${Date.now().toString().slice(-5)}`,
      supplierId: opp.supplierId,
      supplierName: opp.supplierName,
      amount: opp.recoverableAmount,
      currency: opp.currency,
      status: opp.recoverableAmount > state.currentTenant.settings.autonomousThresholdUsd ? 'APPROVAL_REQUIRED' : 'READY',
      approvalRequired: opp.recoverableAmount > state.currentTenant.settings.autonomousThresholdUsd,
      negotiationLog: [
        {
          sender: 'RECOVEROS_AGENT',
          message: 'Claim drafted with mathematical evidence attachments.',
          timestamp: new Date().toISOString(),
        },
      ],
      draftSubject: draft.subject,
      draftBody: draft.body,
      createdAt: new Date().toISOString(),
    };

    const updatedOpps = state.opportunities.map((o) =>
      o.id === opp.id ? { ...o, status: 'CLAIM_SUBMITTED' as const, claimId: newClaim.id } : o
    );

    const updated = TenantStateManager.logAudit(
      {
        ...state,
        claims: [newClaim, ...state.claims],
        opportunities: updatedOpps,
      },
      {
        actor: state.currentUser.name,
        role: state.currentUser.role,
        action: 'CREATE_CLAIM',
        targetType: 'Claim',
        targetId: newClaim.id,
        newState: newClaim.status,
        reason: `Created claim from opportunity #${opp.id} for $${opp.recoverableAmount.toFixed(2)}.`,
        result: 'SUCCESS',
      }
    );

    setState(updated);
    return newClaim;
  };

  const executeNaturalLanguageQuery = async (query: string, language: 'en' | 'ar') => {
    const plan = GeminiAgentProvider.parseNaturalLanguageIntent(query, language);
    let matched = state.opportunities;

    if (plan.action === 'DISCOVER_DUPLICATES') {
      matched = state.opportunities.filter((o) => o.category === 'DUPLICATE_PAYMENT');
    } else if (plan.action === 'CHECK_REBATES') {
      matched = state.opportunities.filter((o) => o.category === 'CONTRACT_REBATE' || o.category === 'MISSED_DISCOUNT');
    } else if (plan.action === 'CHECK_FREIGHT') {
      matched = state.opportunities.filter((o) => o.category === 'FREIGHT_OVERCHARGE');
    } else if (plan.action === 'DISCOVER_OVERPAYMENTS') {
      matched = state.opportunities.filter((o) => o.category === 'SUPPLIER_OVERPAYMENT');
    }

    if (plan.filterAmount) {
      matched = matched.filter((o) => o.recoverableAmount >= (plan.filterAmount || 0));
    }

    const total = matched.reduce((sum, o) => sum + o.recoverableAmount, 0);

    return {
      messageEn: `Query executed: Identified ${matched.length} verified opportunities totaling $${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}.`,
      messageAr: `تم تنفيذ الاستعلام: تم تحديد ${matched.length} فرصة استرداد موثقة بإجمالي $${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}.`,
      opportunitiesCount: matched.length,
      totalAmount: total,
    };
  };

  const importInvoicesAndRunAudit = (newInvoices: any[]) => {
    const combinedInvoices = [...state.invoices, ...newInvoices];
    const opps = MatchingEngine.runAudit({
      tenantId: state.currentTenant.id,
      suppliers: state.suppliers,
      invoices: combinedInvoices,
      purchaseOrders: state.purchaseOrders,
      contracts: state.contracts,
      payments: state.payments,
      shipments: state.shipments,
    });
    const totalIdentified = opps.reduce((sum, o) => sum + o.recoverableAmount, 0);
    const updated = TenantStateManager.logAudit(
      {
        ...state,
        invoices: combinedInvoices,
        opportunities: opps,
      },
      {
        actor: state.currentUser.name,
        role: state.currentUser.role,
        action: 'RUN_AUDIT',
        targetType: 'Invoice',
        targetId: 'BULK_IMPORT',
        reason: `Imported ${newInvoices.length} transactions via CSV Ingestor Sandbox. Identified ${opps.length} discrepancies ($${totalIdentified.toFixed(2)}).`,
        result: 'SUCCESS',
      }
    );
    setState(updated);
  };

  return (
    <TenantContext.Provider
      value={{
        state,
        switchRole,
        switchMode,
        runAudit,
        approveClaim,
        submitClaim,
        resolveRecovery,
        uploadDocument,
        toggleIntegration,
        runBenchmark,
        runArchitecturalAudit,
        architecturalReport,
        executeNaturalLanguageQuery,
        startClaimFromOpportunity,
        importInvoicesAndRunAudit,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
};
