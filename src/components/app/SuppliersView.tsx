import React from 'react';
import { useI18n } from '../../i18n';
import { useTenant } from '../../store/TenantContext';
import { Building2, Mail, MapPin } from 'lucide-react';

export const SuppliersView: React.FC = () => {
  const { t, formatCurrency, formatDate, isRtl } = useI18n();
  const { state } = useTenant();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {t.appSuppliers}
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {isRtl ? 'دليل الموردين وتاريخ التسويات وفروقات العقود' : 'Vendor directory with contracted payment terms, spend volume, and active leakage opportunities'}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left rtl:text-right border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-800/40 text-neutral-500 font-semibold">
                <th className="py-3 px-4">{isRtl ? 'اسم المورد' : 'Supplier Name'}</th>
                <th className="py-3 px-4">{isRtl ? 'الرقم الضريبي' : 'Tax ID'}</th>
                <th className="py-3 px-4">{isRtl ? 'الدولة' : 'Country'}</th>
                <th className="py-3 px-4">{isRtl ? 'شروط السداد' : 'Payment Terms'}</th>
                <th className="py-3 px-4 text-right rtl:text-left">{isRtl ? 'إجمالي الإنفاق' : 'Cumulative Spend'}</th>
                <th className="py-3 px-4 text-center">{isRtl ? 'فروقات نشطة' : 'Active Leaks'}</th>
                <th className="py-3 px-4 text-right rtl:text-left">{isRtl ? 'إجمالي المسترد' : 'Total Recovered'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {state.suppliers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-neutral-500">
                    {isRtl
                      ? 'لا يوجد موردون مسجلون حتى الآن. اربط برنامج المحاسبة أو ارفع ملف الفواتير.'
                      : 'No suppliers synced yet. Connect an ERP or upload an accounts payable ledger.'}
                  </td>
                </tr>
              ) : (
                state.suppliers.map((supp) => (
                  <tr
                    key={supp.id}
                    className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {supp.name}
                      </div>
                      <div className="text-[11px] text-neutral-500 flex items-center gap-1.5 mt-0.5">
                        <Mail className="w-3 h-3" />
                        <span>{supp.contactEmail}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-neutral-600 dark:text-neutral-400">
                      {supp.taxId}
                    </td>

                    <td className="py-3 px-4 text-neutral-600 dark:text-neutral-300">
                      {supp.country}
                    </td>

                    <td className="py-3 px-4 font-mono font-medium text-emerald-600">
                      {supp.paymentTerms}
                    </td>

                    <td className="py-3 px-4 text-right rtl:text-left font-mono tabular-nums font-bold text-neutral-900 dark:text-neutral-100">
                      {formatCurrency(supp.totalSpend, supp.currency)}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span className="font-mono tabular-nums px-2 py-0.5 rounded text-[11px] bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-semibold">
                        {supp.activeOpportunitiesCount}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right rtl:text-left font-mono tabular-nums font-semibold text-emerald-600">
                      {formatCurrency(supp.totalRecovered, supp.currency)}
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
