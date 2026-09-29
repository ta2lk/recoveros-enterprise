import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { useTenant } from '../../store/TenantContext';
import { StatusMarker } from '../ui/Badge';
import { ShieldCheck, History, Search } from 'lucide-react';

export const AuditLogView: React.FC = () => {
  const { t, formatDate, isRtl } = useI18n();
  const { state } = useTenant();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = state.auditLogs.filter(
    (l) =>
      l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.actor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.targetType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.reason && l.reason.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {t.appAuditLog}
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {isRtl
              ? 'سجل الرقابة المالية الصارم غير القابل للتعديل لجميع العمليات والقرارات'
              : 'Tamper-evident, immutable audit trail of all manual and autonomous actions across your tenant'}
          </p>
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search audit trail..."
            className="w-full py-1.5 px-3 text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-neutral-100"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left rtl:text-right border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-800/40 text-neutral-500 font-semibold">
                <th className="py-3 px-4">{isRtl ? 'الوقت والتاريخ' : 'Timestamp'}</th>
                <th className="py-3 px-4">{isRtl ? 'المنفذ والصلاحية' : 'Actor & Role'}</th>
                <th className="py-3 px-4">{isRtl ? 'الإجراء' : 'Action'}</th>
                <th className="py-3 px-4">{isRtl ? 'الهدف' : 'Target'}</th>
                <th className="py-3 px-4">{isRtl ? 'تغير الحالة' : 'State Transition'}</th>
                <th className="py-3 px-4">{isRtl ? 'السبب ومبرر الأدلة' : 'Reason / Evidence Justification'}</th>
                <th className="py-3 px-4 text-center">{isRtl ? 'النتيجة' : 'Result'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-neutral-500">
                    {isRtl ? 'لم يتم العثور على سجلات تدقيق مطابقة للبحث.' : 'No matching audit records found.'}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/50 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-neutral-500 text-[11px] whitespace-nowrap">
                      {formatDate(log.timestamp)}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {log.actor}
                      </div>
                      <div className="text-[10px] text-neutral-400 font-mono">
                        {log.role}
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-neutral-800 dark:text-neutral-200">
                      {log.action}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
                      {log.targetType} #{log.targetId}
                    </td>

                    <td className="py-3 px-4 font-mono text-[10px] text-neutral-500 whitespace-nowrap">
                      {log.previousState && <span>{log.previousState} &rarr; </span>}
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100">{log.newState || 'APPLIED'}</span>
                    </td>

                    <td className="py-3 px-4 text-neutral-600 dark:text-neutral-300 max-w-xs text-[11px]">
                      {log.reason || 'Routine compliance check.'}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <StatusMarker
                        label={log.result}
                        tone={log.result === 'SUCCESS' ? 'emerald' : 'rose'}
                      />
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
