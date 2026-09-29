import React from 'react';
import { useI18n } from '../../i18n';
import { useTenant } from '../../store/TenantContext';
import { StatusMarker } from '../ui/Badge';
import { CreditCard } from 'lucide-react';

export const TransactionsView: React.FC = () => {
  const { t, formatCurrency, formatDate, isRtl } = useI18n();
  const { state } = useTenant();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {t.appTransactions}
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {isRtl ? 'حركات الصرف والتحويلات البنكية المعتمدة' : 'Bank disbursements and treasury payment reconciliation records'}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left rtl:text-right border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-800/40 text-neutral-500 font-semibold">
                <th className="py-3 px-4">{isRtl ? 'مرجع المعاملة' : 'Transaction Ref'}</th>
                <th className="py-3 px-4">{isRtl ? 'الحساب البنكي' : 'Bank Account'}</th>
                <th className="py-3 px-4">{isRtl ? 'المورد' : 'Supplier'}</th>
                <th className="py-3 px-4">{isRtl ? 'طريقة السداد' : 'Method'}</th>
                <th className="py-3 px-4">{isRtl ? 'تاريخ التسوية' : 'Settled Date'}</th>
                <th className="py-3 px-4 text-right rtl:text-left">{isRtl ? 'المبلغ المصروف' : 'Disbursed Amount'}</th>
                <th className="py-3 px-4 text-center">{isRtl ? 'الحالة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {state.payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-neutral-500">
                    {isRtl
                      ? 'لا توجد معاملات مسجلة بعد. ارفع ملف معاملات بصيغة CSV أو اربط برنامج المحاسبة.'
                      : 'No transactions recorded. Upload disbursement CSV or connect accounting software.'}
                  </td>
                </tr>
              ) : (
                state.payments.map((p) => {
                  const supplier = state.suppliers.find((s) => s.id === p.supplierId);
                  const isDup = p.id === 'pay-dup-42';
                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-neutral-50/80 dark:hover:bg-neutral-800/50 transition-colors ${
                        isDup ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                        {p.transactionReference}
                      </td>

                      <td className="py-3 px-4 font-mono text-neutral-500">
                        {p.bankAccount}
                      </td>

                      <td className="py-3 px-4 font-medium text-neutral-800 dark:text-neutral-200">
                        {supplier?.name || 'Vendor'}
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                          {p.method}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-neutral-500">
                        {formatDate(p.paymentDate)}
                      </td>

                      <td className="py-3 px-4 text-right rtl:text-left font-mono tabular-nums font-bold text-neutral-900 dark:text-neutral-100">
                        {formatCurrency(p.amount, p.currency)}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <StatusMarker
                          label={isDup ? (isRtl ? 'دفع مكرر' : 'DUPLICATE DISBURSEMENT') : p.status}
                          tone={isDup ? 'amber' : 'emerald'}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
