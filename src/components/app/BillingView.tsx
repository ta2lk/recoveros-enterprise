import React from 'react';
import { useI18n } from '../../i18n';
import { useTenant } from '../../store/TenantContext';
import { CreditCard, DollarSign, CheckCircle2, ShieldCheck } from 'lucide-react';

export const BillingView: React.FC = () => {
  const { t, formatCurrency, isRtl } = useI18n();
  const { state } = useTenant();

  const totalRecovered = state.recoveries.reduce((sum, r) => sum + r.recoveredAmount, 0);
  const totalBilledFees = state.recoveries.reduce((sum, r) => sum + r.successFeeAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {t.appBilling}
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {isRtl ? 'رسوم الاسترداد القائمة على الأداء الفعلي ونسب النجاح التعاقدية' : 'Contingency-based billing structure: We only bill upon verified cash deposits or credit memos'}
          </p>
        </div>
      </div>

      <div className="p-5 rounded-xl bg-neutral-900 text-white shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs text-emerald-400 font-semibold mb-1 uppercase tracking-wider">
              {t.pricingSuccessFeeTitle}
            </div>
            <h2 className="text-xl font-bold">Standard 20% Recovery Contingency</h2>
            <p className="text-xs text-neutral-400 max-w-lg mt-1">
              Zero upfront subscription fees. Invoices are generated strictly following confirmation of settled funds.
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-neutral-400">Total Billed to Date</div>
            <div className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
              {formatCurrency(totalBilledFees)}
            </div>
            <div className="text-[11px] text-neutral-500">
              Recovered {formatCurrency(totalRecovered)} for client
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
          Contingency Settlement Invoices
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left rtl:text-right border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 font-semibold">
                <th className="py-2.5 px-3">Invoice #</th>
                <th className="py-2.5 px-3">Associated Recovery</th>
                <th className="py-2.5 px-3 text-right rtl:text-left">Recovered Cash</th>
                <th className="py-2.5 px-3 text-right rtl:text-left">Success Fee (20%)</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {state.recoveries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-neutral-500">
                    No billing invoices generated yet.
                  </td>
                </tr>
              ) : (
                state.recoveries.map((r, i) => (
                  <tr key={r.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40">
                    <td className="py-2.5 px-3 font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                      INV-FEE-2026-{100 + i}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-700 dark:text-neutral-300">
                      {r.supplierName} ({r.referenceNumber})
                    </td>
                    <td className="py-2.5 px-3 text-right rtl:text-left font-mono tabular-nums text-neutral-700 dark:text-neutral-300">
                      {formatCurrency(r.recoveredAmount, r.currency)}
                    </td>
                    <td className="py-2.5 px-3 text-right rtl:text-left font-mono tabular-nums font-bold text-neutral-900 dark:text-neutral-100">
                      {formatCurrency(r.successFeeAmount, r.currency)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-medium">
                        PAID VIA OFFSET
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
