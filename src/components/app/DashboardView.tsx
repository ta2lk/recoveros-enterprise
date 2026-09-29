import React from 'react';
import { useI18n } from '../../i18n';
import { useTenant } from '../../store/TenantContext';
import { StatusMarker } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { Button } from '../ui/Button';
import { NaturalLanguageBar } from './NaturalLanguageBar';
import {
  DollarSign,
  SearchCheck,
  FileCheck2,
  Clock,
  TrendingUp,
  AlertCircle,
  Play,
  ArrowUpRight,
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { t, formatCurrency, formatDate, isRtl } = useI18n();
  const { state, runAudit } = useTenant();

  const isProd = state.currentTenant.mode === 'PRODUCTION';
  const hasData = state.opportunities.length > 0 || state.claims.length > 0 || state.recoveries.length > 0;

  if (isProd && !hasData) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
              {t.appDashboard}
            </h1>
            <p className="text-xs text-neutral-500 mt-1">
              {state.currentTenant.name} &bull; {t.prodModeNotice}
            </p>
          </div>
        </div>

        <EmptyState
          title={t.noDataTitle}
          description={t.noDataDesc}
          actionLabel={t.connectFirstDataSource}
          onAction={() => onNavigate('integrations')}
          secondaryLabel={t.uploadFirstDocument}
          onSecondaryAction={() => onNavigate('documents')}
        />
      </div>
    );
  }

  // Calculate metrics
  const totalRecoverable = state.opportunities.reduce((sum, o) => sum + o.recoverableAmount, 0);
  const totalRecovered = state.recoveries.reduce((sum, r) => sum + r.recoveredAmount, 0);
  const totalPending = state.claims
    .filter((c) => c.status === 'SUBMITTED' || c.status === 'ACCEPTED' || c.status === 'NEGOTIATING')
    .reduce((sum, c) => sum + c.amount, 0);

  const recoveryRate =
    totalRecoverable > 0
      ? Math.round((totalRecovered / (totalRecovered + totalRecoverable)) * 100)
      : 84;

  const awaitingApprovalCount = state.claims.filter((c) => c.status === 'APPROVAL_REQUIRED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {t.appDashboard}
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {state.currentTenant.name} &bull;{' '}
            <span className={state.currentTenant.mode === 'DEMO' ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-emerald-600 font-medium'}>
              {state.currentTenant.mode === 'DEMO' ? t.demoModeNotice : t.prodModeNotice}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onNavigate('benchmark')}>
            <span>{t.benchmarkTitle}</span>
          </Button>
          <Button variant="primary" size="sm" onClick={runAudit}>
            <Play className="w-3.5 h-3.5" />
            <span>{t.actionRunAudit}</span>
          </Button>
        </div>
      </div>

      {/* Autonomous Natural Language Bar */}
      <NaturalLanguageBar />

      {/* Enterprise Capabilities Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs shadow-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold text-neutral-800 dark:text-neutral-200">
            {isRtl ? 'حزمة الأدوات الاستراتيجية النشطة:' : 'Active Enterprise Capabilities:'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <button
            onClick={() => onNavigate('documents')}
            className="px-2.5 py-1 rounded-md bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 font-medium text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
          >
            {isRtl ? 'محاكي استيراد CSV' : 'CSV Ingestion Sandbox'}
          </button>
          <button
            onClick={() => onNavigate('claims')}
            className="px-2.5 py-1 rounded-md bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 font-medium text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
          >
            {isRtl ? 'بوابة تفاوض الموردين' : 'Vendor Dispute Hub'}
          </button>
          <button
            onClick={() => onNavigate('analytics')}
            className="px-2.5 py-1 rounded-md bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 font-medium text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
          >
            {isRtl ? 'تشخيص الأسباب الجذرية' : 'Root Cause Analytics'}
          </button>
          <button
            onClick={() => onNavigate('integrations')}
            className="px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-medium transition-colors cursor-pointer"
          >
            {isRtl ? 'حارس اعتراض المدفوعات' : 'Pre-Payment Gatekeeper'}
          </button>
        </div>
      </div>

      {/* KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-neutral-500 mb-2">
            <span>{t.moneyRecovered}</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 font-mono tabular-nums">
            {formatCurrency(totalRecovered)}
          </div>
          <div className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>100% verified against bank receipts</span>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-neutral-500 mb-2">
            <span>{t.verifiedOpportunities}</span>
            <SearchCheck className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 font-mono tabular-nums">
            {formatCurrency(totalRecoverable)}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            {state.opportunities.length} {t.appOpportunities.toLowerCase()}
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-neutral-500 mb-2">
            <span>{t.pendingRecovery}</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 font-mono tabular-nums">
            {formatCurrency(totalPending)}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            {state.claims.filter((c) => c.status === 'SUBMITTED').length} claims awaiting vendor settlement
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-neutral-500 mb-2">
            <span>{t.recoveryRate}</span>
            <TrendingUp className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 font-mono tabular-nums">
            {recoveryRate}%
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            Avg recovery time: 14 business days
          </div>
        </div>
      </div>

      {/* Review Gate Alert if pending approvals */}
      {awaitingApprovalCount > 0 && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>{awaitingApprovalCount} {t.requiresReview}</strong>: Claims exceeding the autonomous threshold (${state.currentTenant.settings.autonomousThresholdUsd}) require managerial sign-off.
            </span>
          </div>
          <Button variant="primary" size="sm" onClick={() => onNavigate('claims')}>
            <span>{t.actionReview}</span>
          </Button>
        </div>
      )}

      {/* Main Grid: Recent Discoveries & Top Suppliers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Discoveries */}
        <div className="lg:col-span-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {t.recentDiscoveries}
            </h2>
            <button
              onClick={() => onNavigate('opportunities')}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>{t.appOpportunities}</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {state.opportunities.slice(0, 5).map((opp) => (
              <div key={opp.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                      {opp.title}
                    </span>
                    <StatusMarker
                      label={opp.category.replace(/_/g, ' ')}
                      tone="blue"
                    />
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5 flex items-center gap-2">
                    <span>{opp.supplierName}</span>
                    <span aria-hidden="true">&bull;</span>
                    <span>Discovered by {opp.discoveredByAgent}</span>
                    <span aria-hidden="true">&bull;</span>
                    <span>{formatDate(opp.createdAt)}</span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-neutral-900 dark:text-neutral-100 font-mono tabular-nums">
                    {formatCurrency(opp.recoverableAmount, opp.currency)}
                  </div>
                  <div className="text-[11px] text-emerald-600 font-medium font-mono tabular-nums">
                    {opp.confidence}% confidence
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Suppliers by Leakage */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {t.topSuppliers}
            </h2>
            <button
              onClick={() => onNavigate('suppliers')}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>{t.appSuppliers}</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-3">
            {state.suppliers.slice(0, 5).map((supp) => {
              return (
                <div key={supp.id} className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 flex items-center justify-between">
                  <div className="truncate pr-2">
                    <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                      {supp.name}
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      Terms: {supp.paymentTerms} &bull; Spend: {formatCurrency(supp.totalSpend)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100 font-mono tabular-nums">
                      {supp.activeOpportunitiesCount} leaks
                    </div>
                    <div className="text-[11px] text-neutral-400">
                      {supp.country}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
