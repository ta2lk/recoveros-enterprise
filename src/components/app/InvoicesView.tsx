import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { useTenant } from '../../store/TenantContext';
import { StatusMarker } from '../ui/Badge';
import { Receipt, Search } from 'lucide-react';

export const InvoicesView: React.FC = () => {
  const { t, formatCurrency, formatDate, isRtl } = useI18n();
  const { state } = useTenant();
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = state.invoices.filter((inv) =>
    inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {t.appInvoices}
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {isRtl ? 'الفواتير المدفوعة ومطابقة أوامر الشراء الثلاثية' : 'Billed invoices and 3-way line item reconciliation against authorized purchase orders'}
          </p>
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search invoice #..."
            className="w-full py-1.5 px-3 text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-neutral-100"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left rtl:text-right border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-800/40 text-neutral-500 font-semibold">
                <th className="py-3 px-4">{isRtl ? 'رقم الفاتورة' : 'Invoice #'}</th>
                <th className="py-3 px-4">{isRtl ? 'رقم أمر الشراء' : 'PO #'}</th>
                <th className="py-3 px-4">{isRtl ? 'المورد' : 'Supplier'}</th>
                <th className="py-3 px-4">{isRtl ? 'التاريخ' : 'Date'}</th>
                <th className="py-3 px-4 text-right rtl:text-left">{isRtl ? 'المبلغ المفوتر' : 'Billed Amount'}</th>
                <th className="py-3 px-4 text-right rtl:text-left">{isRtl ? 'المبلغ المدفوع' : 'Paid Amount'}</th>
                <th className="py-3 px-4 text-center">{isRtl ? 'المطابقة الثلاثية' : '3-Way Match'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-neutral-500">
                    {isRtl ? 'لم يتم العثور على فواتير.' : 'No invoices found.'}
                  </td>
                </tr>
              ) : (
                filtered.slice(0, 50).map((inv) => {
                  const supplier = state.suppliers.find((s) => s.id === inv.supplierId);
                  const isDiscrepancy = inv.matchStatus === 'DISCREPANCY';
                  return (
                    <tr
                      key={inv.id}
                      className={`hover:bg-neutral-50/80 dark:hover:bg-neutral-800/50 transition-colors ${
                        isDiscrepancy ? 'bg-rose-50/30 dark:bg-rose-950/20' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                        {inv.invoiceNumber}
                      </td>

                      <td className="py-3 px-4 font-mono text-neutral-500">
                        {inv.purchaseOrderId || 'N/A'}
                      </td>

                      <td className="py-3 px-4 font-medium text-neutral-800 dark:text-neutral-200">
                        {supplier?.name || 'Unknown'}
                      </td>

                      <td className="py-3 px-4 text-neutral-500">
                        {formatDate(inv.invoiceDate)}
                      </td>

                      <td className="py-3 px-4 text-right rtl:text-left font-mono tabular-nums text-neutral-800 dark:text-neutral-200">
                        {formatCurrency(inv.totalAmount, inv.currency)}
                      </td>

                      <td className="py-3 px-4 text-right rtl:text-left font-mono tabular-nums font-bold text-neutral-900 dark:text-neutral-100">
                        {formatCurrency(inv.paidAmount, inv.currency)}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <StatusMarker
                          label={isDiscrepancy ? (isRtl ? 'تجاوز في الفوترة' : 'OVERBILLING DETECTED') : (isRtl ? 'مطابق' : 'MATCHED')}
                          tone={isDiscrepancy ? 'rose' : 'emerald'}
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
