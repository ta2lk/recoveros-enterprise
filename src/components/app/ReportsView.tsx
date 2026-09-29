import React from 'react';
import { useI18n } from '../../i18n';
import { useTenant } from '../../store/TenantContext';
import { Button } from '../ui/Button';
import { BarChart3, TrendingUp, Download, PieChart, ArrowUpRight } from 'lucide-react';

export const ReportsView: React.FC = () => {
  const { t, formatCurrency, formatDate, isRtl } = useI18n();
  const { state } = useTenant();

  const totalRecovered = state.recoveries.reduce((sum, r) => sum + r.recoveredAmount, 0);
  const totalLeaked = state.opportunities.reduce((sum, o) => sum + o.recoverableAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {t.appReports}
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {isRtl ? 'التقارير التنفيذية الدورية لفروقات الصرف ومكاسب الاسترداد' : 'Executive recovery statements, supplier leak attribution, and audit summaries'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Audit Executive Summary
            </h3>
            <span className="text-xs font-mono text-neutral-400">Q3 2026</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-neutral-100 dark:border-neutral-800">
              <span className="text-neutral-500">Total Disbursements Audited:</span>
              <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                {formatCurrency(1850000)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-neutral-100 dark:border-neutral-800">
              <span className="text-neutral-500">Gross Verified Overpayments Identified:</span>
              <span className="font-mono font-bold text-rose-600">
                {formatCurrency(totalLeaked)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-neutral-100 dark:border-neutral-800">
              <span className="text-neutral-500">Total Cash & Credits Recovered:</span>
              <span className="font-mono font-bold text-emerald-600">
                {formatCurrency(totalRecovered)}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-neutral-500">Leakage Rate as % of Spend:</span>
              <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                1.38% (In line with IOFM industry benchmark)
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Category Breakdown
            </h3>
          </div>

          <div className="space-y-2.5 text-xs">
            {['DUPLICATE_PAYMENT', 'CONTRACT_REBATE', 'SUPPLIER_OVERPAYMENT', 'MISSED_DISCOUNT', 'FREIGHT_OVERCHARGE'].map((cat) => {
              const count = state.opportunities.filter((o) => o.category === cat).length;
              const sum = state.opportunities.filter((o) => o.category === cat).reduce((s, o) => s + o.recoverableAmount, 0);
              return (
                <div key={cat} className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-neutral-800 dark:text-neutral-200">
                      {cat.replace(/_/g, ' ')}
                    </div>
                    <div className="text-[11px] text-neutral-400">{count} items verified</div>
                  </div>
                  <div className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                    {formatCurrency(sum)}
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
