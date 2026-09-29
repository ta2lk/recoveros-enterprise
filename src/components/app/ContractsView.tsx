import React from 'react';
import { useI18n } from '../../i18n';
import { useTenant } from '../../store/TenantContext';
import { StatusMarker } from '../ui/Badge';
import { FileText, ShieldAlert } from 'lucide-react';

export const ContractsView: React.FC = () => {
  const { t, formatDate, isRtl } = useI18n();
  const { state } = useTenant();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {t.appContracts}
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {isRtl ? 'اتفاقيات التوريد وشروط مكافآت الحجم وبنود خصومات السداد المبكر' : 'Master supply agreements, prompt-payment clauses, volume rebate rules, and SLA credits'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {state.contracts.length === 0 ? (
          <div className="col-span-2 text-center py-12 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-neutral-500 text-xs">
            No contracts registered. Upload master procurement agreements to extract recovery rules.
          </div>
        ) : (
          state.contracts.map((cntr) => {
            const supplier = state.suppliers.find((s) => s.id === cntr.supplierId);
            return (
              <div
                key={cntr.id}
                className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                      {cntr.title}
                    </h3>
                    <div className="text-[11px] text-neutral-500 mt-0.5">
                      {supplier?.name} &bull; <span className="font-mono">{cntr.contractNumber}</span>
                    </div>
                  </div>
                  <StatusMarker label={cntr.status} tone="emerald" />
                </div>

                <div className="p-3 bg-neutral-50 dark:bg-neutral-800/60 rounded-lg text-xs space-y-1.5">
                  {cntr.rebateTerms && (
                    <div>
                      <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                        {isRtl ? 'مكافأة حجم المشتريات: ' : 'Volume Rebate: '}
                      </span>
                      <span className="text-neutral-600 dark:text-neutral-400">{cntr.rebateTerms}</span>
                    </div>
                  )}
                  {cntr.discountTerms && (
                    <div>
                      <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                        {isRtl ? 'خصم السداد المبكر: ' : 'Prompt Discount: '}
                      </span>
                      <span className="text-neutral-600 dark:text-neutral-400">{cntr.discountTerms}</span>
                    </div>
                  )}
                  <div className="text-[10px] text-neutral-400 pt-1">
                    {isRtl ? 'الفترة: ' : 'Term: '}
                    {formatDate(cntr.startDate)} &rarr; {formatDate(cntr.endDate)}
                  </div>
                </div>

                {cntr.rules.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                      {isRtl ? `قواعد التدقيق النشطة (${cntr.rules.length})` : `Active Extraction Rules (${cntr.rules.length})`}
                    </div>
                    <div className="space-y-1">
                      {cntr.rules.map((rule) => (
                        <div
                          key={rule.id}
                          className="text-[11px] bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 p-2 rounded border border-emerald-200/60 dark:border-emerald-800/40"
                        >
                          <strong>{rule.ruleType}:</strong> {rule.description}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
