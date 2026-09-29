import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { useTenant } from '../../store/TenantContext';
import { Button } from '../ui/Button';
import { Lock, ShieldCheck, ShieldAlert, Key, CheckCircle, Terminal, RotateCw, AlertTriangle } from 'lucide-react';
import { ArchitecturalTestReport } from '../../engine/architecturalTest';

export const SecurityView: React.FC = () => {
  const { t, isRtl } = useI18n();
  const { state, runArchitecturalAudit, architecturalReport } = useTenant();

  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<ArchitecturalTestReport | null>(architecturalReport);

  const handleRunSecurityTest = async () => {
    setIsRunning(true);
    try {
      const res = await runArchitecturalAudit();
      setReport(res);
    } catch (err: any) {
      console.error('Security audit execution failed:', err);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {t.appSecurity}
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {isRtl
              ? 'حواجز العزل بين الشركات والتشفير السيادي والوقاية ضد حقن الأوامر'
              : 'Logical tenant boundary enforcement, prompt injection defense, and cryptographic auditability'}
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={handleRunSecurityTest}
          disabled={isRunning}
        >
          {isRunning ? (
            <RotateCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5" />
          )}
          <span>
            {isRunning
              ? (isRtl ? 'جارٍ فحص العزل والأمان...' : 'Running Security Invariants...')
              : (isRtl ? 'تشغيل فحص العزل المعماري والأمني' : 'Execute Architectural & Security Verification')}
          </span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center gap-2 text-emerald-600 mb-2">
            <Lock className="w-4 h-4" />
            <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
              {isRtl ? 'العزل المنطقي للشركات' : 'Logical Tenant Isolation'}
            </h3>
          </div>
          <p className="text-xs text-neutral-500 leading-relaxed">
            {t.tenantIsolationEnforced}. {isRtl
              ? 'يتم رفض كافة هجمات الوصول المباشر (IDOR) عبر التحقق الإجباري من هوية الشركة المستأجرة عند كل استعلام.'
              : 'Direct object reference attacks (IDOR) are rejected by mandatory tenant context validation at every query boundary.'}
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center gap-2 text-sky-600 mb-2">
            <Key className="w-4 h-4" />
            <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
              {isRtl ? 'التشفير السيادي للبيانات' : 'Cryptographic Encryption'}
            </h3>
          </div>
          <p className="text-xs text-neutral-500 leading-relaxed">
            {t.encryptionTransitRest}. {isRtl
              ? 'تخزن المفاتيح والربط بالأنظمة الخارجية في خزائن معزولة عتاديًا ومملحة لكل شركة على حدة.'
              : 'Integrations use hardware-isolated credential vaults with dedicated per-tenant salting.'}
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center gap-2 text-indigo-600 mb-2">
            <ShieldCheck className="w-4 h-4" />
            <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
              {isRtl ? 'الحماية ضد حقن الأوامر الخبيثة' : 'Prompt Injection Defense'}
            </h3>
          </div>
          <p className="text-xs text-neutral-500 leading-relaxed">
            {t.promptInjectionDefense}. {isRtl
              ? 'تُعزل نصوص المستندات في وسائط XML محصنة لضمان عدم تغيير تعليمات النظام أو صلاحيات الوكلاء.'
              : 'Document text is partitioned in XML-bounded untrusted buffers; models are constrained to passive extraction.'}
          </p>
        </div>
      </div>

      {/* Security Test Results Console */}
      {report && (
        <div className="bg-neutral-950 text-neutral-200 border border-neutral-800 rounded-xl p-5 font-mono text-xs space-y-3">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <Terminal className="w-4 h-4" />
              <span>
                {report.overallPassed
                  ? (isRtl ? 'تم اجتياز كافة الثوابت المعمارية والأمنية: النظام محمي 100%' : 'All Security & Architectural Invariants Verified: 100% Isolated & Protected')
                  : (isRtl ? 'فشل أحد الفحوصات الأمنية' : 'Security breach detected in isolation harness!')}
              </span>
            </div>
            <span className="text-[11px] text-neutral-400">
              {report.passedTests}/{report.totalTests} Passed ({report.totalDurationMs}ms)
            </span>
          </div>

          <div className="space-y-3 pt-2">
            {report.steps.map((s) => (
              <div key={s.id} className="p-3 rounded-lg bg-neutral-900 border border-neutral-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {s.status === 'PASSED' ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-500" />
                    )}
                    <span className="font-semibold text-neutral-100">
                      {isRtl ? s.nameAr : s.nameEn}
                    </span>
                  </div>
                  <span className="text-[10px] text-neutral-400 font-mono">{s.durationMs}ms</span>
                </div>
                {s.details.map((detail, dIdx) => (
                  <div
                    key={dIdx}
                    className={`text-[11px] ${
                      detail.startsWith('✓')
                        ? 'text-emerald-400/90'
                        : detail.startsWith('✗')
                        ? 'text-rose-400 font-bold'
                        : 'text-neutral-400'
                    }`}
                  >
                    {detail}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
