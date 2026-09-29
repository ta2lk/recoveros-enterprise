import React from 'react';
import { useI18n } from '../../i18n';
import { useTenant } from '../../store/TenantContext';
import { StatusMarker } from '../ui/Badge';
import { DollarSign, CheckCircle2, FileText, ArrowDownToLine } from 'lucide-react';
import { Button } from '../ui/Button';

export const RecoveriesView: React.FC = () => {
  const { t, formatCurrency, formatDate, isRtl } = useI18n();
  const { state } = useTenant();

  const totalRecovered = state.recoveries.reduce((sum, r) => sum + r.recoveredAmount, 0);
  const totalFees = state.recoveries.reduce((sum, r) => sum + r.successFeeAmount, 0);
  const netClientBenefit = totalRecovered - totalFees;

  const exportCsv = () => {
    const headers = ['Recovery ID', 'Supplier', 'Recovered Amount', 'Currency', 'Settlement Type', 'Reference #', 'Verified Date', 'Verified By'];
    const rows = state.recoveries.map(r => [
      r.id,
      r.supplierName,
      r.recoveredAmount,
      r.currency,
      r.settlementType,
      r.referenceNumber,
      r.verifiedAt,
      r.verifiedBy
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `RecoverOS_Verified_Recoveries_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {t.appRecoveries}
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {isRtl
              ? 'الأموال المستردة فعلياً التي دخلت الحساب البنكي أو قُيدت بإشعارات دائنة رسمية'
              : 'Verifiably settled cash recoveries and legal credit memos deposited into treasury accounts'}
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={exportCsv} disabled={state.recoveries.length === 0}>
          <ArrowDownToLine className="w-3.5 h-3.5" />
          <span>{t.actionExport}</span>
        </Button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-xs">
          <div className="text-xs text-neutral-500 mb-1">
            {isRtl ? 'إجمالي السيولة المستردة' : 'Total Settled Cash'}
          </div>
          <div className="text-2xl font-bold text-emerald-600 font-mono tabular-nums">
            {formatCurrency(totalRecovered)}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            {isRtl ? `${state.recoveries.length} تسوية مؤكدة في الخزينة` : `${state.recoveries.length} verified settlements`}
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-xs">
          <div className="text-xs text-neutral-500 mb-1">
            {isRtl ? 'صافي أرباح العميل المستبقاة (80%)' : 'Net Client Retained (80%)'}
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 font-mono tabular-nums">
            {formatCurrency(netClientBenefit)}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            {isRtl ? 'إضافة نقدية مباشرة لصافي الأرباح التشغيلية EBITDA' : 'Direct EBITDA profit enhancement'}
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-xs">
          <div className="text-xs text-neutral-500 mb-1">
            {isRtl ? 'رسوم النجاح المشروطة (20%)' : 'Contingency Success Fee (20%)'}
          </div>
          <div className="text-2xl font-bold text-neutral-700 dark:text-neutral-300 font-mono tabular-nums">
            {formatCurrency(totalFees)}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            {isRtl ? 'صفر مخاطرة مسبقة؛ تُدفع فقط بعد دخول الأموال' : 'Zero upfront risk; billed upon verified deposit'}
          </div>
        </div>
      </div>

      {/* Recoveries Table */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left rtl:text-right border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-800/40 text-neutral-500 font-semibold">
                <th className="py-3 px-4">{isRtl ? 'معرف الاسترداد' : 'Recovery ID'}</th>
                <th className="py-3 px-4">{isRtl ? 'المورد' : 'Supplier'}</th>
                <th className="py-3 px-4">{isRtl ? 'آلية التسوية' : 'Settlement Mechanism'}</th>
                <th className="py-3 px-4 font-mono">{isRtl ? 'الرقم المرجعي' : 'Reference #'}</th>
                <th className="py-3 px-4 text-right rtl:text-left">{isRtl ? 'المبلغ المسترد' : 'Recovered Amount'}</th>
                <th className="py-3 px-4 text-right rtl:text-left">{isRtl ? 'رسوم النجاح' : 'Success Fee'}</th>
                <th className="py-3 px-4">{isRtl ? 'تم التحقق بواسطة' : 'Verified By'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {state.recoveries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-neutral-500">
                    {isRtl ? 'لا توجد تسويات مستردة مسجلة حتى الآن.' : 'No verified recoveries recorded yet.'}
                  </td>
                </tr>
              ) : (
                state.recoveries.map((rec) => (
                  <tr
                    key={rec.id}
                    className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/50 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                      {rec.id}
                    </td>

                    <td className="py-3 px-4 font-medium text-neutral-800 dark:text-neutral-200">
                      {rec.supplierName}
                    </td>

                    <td className="py-3 px-4">
                      <StatusMarker
                        label={rec.settlementType.replace(/_/g, ' ')}
                        tone="emerald"
                      />
                    </td>

                    <td className="py-3 px-4 font-mono text-neutral-600 dark:text-neutral-400">
                      {rec.referenceNumber}
                    </td>

                    <td className="py-3 px-4 text-right rtl:text-left font-mono tabular-nums font-bold text-emerald-600">
                      {formatCurrency(rec.recoveredAmount, rec.currency)}
                    </td>

                    <td className="py-3 px-4 text-right rtl:text-left font-mono tabular-nums text-neutral-600 dark:text-neutral-400">
                      {formatCurrency(rec.successFeeAmount, rec.currency)}
                    </td>

                    <td className="py-3 px-4 text-neutral-500 text-[11px]">
                      <div>{rec.verifiedBy}</div>
                      <div className="text-[10px] opacity-70">{formatDate(rec.verifiedAt)}</div>
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
