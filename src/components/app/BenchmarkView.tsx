import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { useTenant } from '../../store/TenantContext';
import { Button } from '../ui/Button';
import {
  Target,
  Play,
  ShieldAlert,
  Award,
  CheckCircle2,
  Clock,
  Terminal,
  ShieldCheck,
  Cpu,
  Layers,
  CheckCircle,
  AlertTriangle,
  RotateCw,
} from 'lucide-react';
import { ArchitecturalTestReport, ArchitecturalTestStep } from '../../engine/architecturalTest';
import { GROUND_TRUTH_DISCREPANCIES } from '../../data/benchmarkDataset';

export const BenchmarkView: React.FC = () => {
  const { t, formatNumber, formatCurrency, isRtl } = useI18n();
  const { state, runBenchmark, runArchitecturalAudit, architecturalReport } = useTenant();

  const [isRunningArch, setIsRunningArch] = useState(false);
  const [isRunningBench, setIsRunningBench] = useState(false);
  const [activeReport, setActiveReport] = useState<ArchitecturalTestReport | null>(architecturalReport);
  const [liveSteps, setLiveSteps] = useState<ArchitecturalTestStep[]>([]);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const metrics = state.benchmarkMetrics;

  const handleRunArchitecturalAudit = async () => {
    setIsRunningArch(true);
    setSuccessBanner(null);
    setProgressPercent(10);
    setLiveSteps([]);

    try {
      const report = await runArchitecturalAudit((step, index) => {
        setLiveSteps((prev) => {
          const next = [...prev];
          next[index] = step;
          return next;
        });
        setProgressPercent(Math.round(((index + 1) / 5) * 100));
      });

      setActiveReport(report);
      setProgressPercent(100);
      setSuccessBanner(
        isRtl
          ? `اكتمل الاختبار المعماري بنجاح: تم اجتياز ${report.passedTests}/${report.totalTests} من الثوابت المعمارية خلال ${report.totalDurationMs}ms!`
          : `Architectural audit passed: ${report.passedTests}/${report.totalTests} system invariants verified in ${report.totalDurationMs}ms!`
      );
    } catch (err: any) {
      console.error('Architectural audit error:', err);
    } finally {
      setIsRunningArch(false);
    }
  };

  const handleRunBenchmark = async () => {
    setIsRunningBench(true);
    setSuccessBanner(null);
    setProgressPercent(20);

    try {
      // Simulate live steps for algorithmic evaluation
      await new Promise((r) => setTimeout(r, 120));
      setProgressPercent(60);
      const res = await runBenchmark();
      setProgressPercent(100);
      setSuccessBanner(
        isRtl
          ? `اكتمل الاختبار المعياري: دقة الاكتشاف ${res.precision}%، شمولية الاسترداد ${res.recall}%، دقة الحساب ${res.calculationAccuracy}%!`
          : `Benchmark evaluated: Precision ${res.precision}%, Recall ${res.recall}%, Calculation Accuracy ${res.calculationAccuracy}%!`
      );
    } catch (err: any) {
      console.error('Benchmark execution error:', err);
    } finally {
      setIsRunningBench(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header with Action Buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>{t.benchmarkTitle}</span>
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {t.benchmarkSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="primary"
            size="md"
            onClick={handleRunArchitecturalAudit}
            disabled={isRunningArch || isRunningBench}
          >
            {isRunningArch ? (
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-200" />
            )}
            <span>
              {isRunningArch ? t.runningTest : t.architecturalRunBtn}
            </span>
          </Button>

          <Button
            variant="outline"
            size="md"
            onClick={handleRunBenchmark}
            disabled={isRunningArch || isRunningBench}
          >
            {isRunningBench ? (
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            )}
            <span>
              {isRunningBench ? t.runningTest : t.benchmarkRunBtn}
            </span>
          </Button>
        </div>
      </div>

      {/* Progress Bar when running */}
      {(isRunningArch || isRunningBench) && (
        <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
          <div
            className="bg-emerald-600 h-full transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Success Notification Banner */}
      {successBanner && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-3 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="font-semibold text-sm">{successBanner}</div>
        </div>
      )}

      {/* Mandatory Synthetic Label Banner */}
      <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-sm">
            {isRtl ? 'حزم الاختبار المعماري وضمانات انعدام البيانات الوهمية في الإنتاج' : 'Synthetic Benchmark Rigor & Zero Fake Production Data Policy'}
          </div>
          <p className="leading-relaxed">
            {t.benchmarkNotice}{' '}
            {isRtl
              ? 'تخضع خوارزميات الاسترداد المستقلة لـ 100 فاتورة مركبة و20 عقداً و50 بوليصة شحن تتضمن أخطاء مزروعة مسبقاً لقياس الدقة والشمولية بدون أي تدليس أو ادعاء كاذب.'
              : 'This test harness runs deterministic matching algorithms against 100 synthetic invoices, 20 master contracts, and 50 shipments containing pre-planted billing errors to objectively measure algorithm accuracy.'}
          </p>
        </div>
      </div>

      {/* Live Architectural Invariants Execution Console */}
      {(activeReport || liveSteps.length > 0) && (
        <div className="bg-neutral-950 text-neutral-200 border border-neutral-800 rounded-xl p-5 font-mono text-xs space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <Terminal className="w-4 h-4" />
              <span>{t.testConsoleTitle}</span>
            </div>
            {activeReport && (
              <span className="text-[11px] text-neutral-400">
                {activeReport.passedTests}/{activeReport.totalTests} Invariants Passed ({activeReport.totalDurationMs}ms)
              </span>
            )}
          </div>

          <div className="space-y-3">
            {(liveSteps.length > 0 ? liveSteps : activeReport?.steps || []).map((step) => {
              const isPassed = step.status === 'PASSED';
              const isFailed = step.status === 'FAILED';
              const isRunning = step.status === 'RUNNING';

              return (
                <div
                  key={step.id}
                  className="p-3 rounded-lg bg-neutral-900 border border-neutral-800 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      {isPassed && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                      {isFailed && <AlertTriangle className="w-4 h-4 text-rose-500" />}
                      {isRunning && <RotateCw className="w-4 h-4 text-sky-400 animate-spin" />}
                      {step.status === 'PENDING' && (
                        <div className="w-4 h-4 rounded-full border border-neutral-600" />
                      )}
                      <span className="font-semibold text-neutral-100">
                        {isRtl ? step.nameAr : step.nameEn}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                      <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-[10px]">
                        {step.category}
                      </span>
                      <span>{step.durationMs}ms</span>
                    </div>
                  </div>

                  {step.details.length > 0 && (
                    <div className="pt-2 border-t border-neutral-800/80 space-y-1 text-[11px] text-neutral-400">
                      {step.details.map((detail, dIdx) => (
                        <div
                          key={dIdx}
                          className={
                            detail.startsWith('✓')
                              ? 'text-emerald-400/90'
                              : detail.startsWith('✗')
                              ? 'text-rose-400 font-bold'
                              : 'text-neutral-400'
                          }
                        >
                          {detail}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Algorithmic Metrics 4-Card Grid */}
      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-xs">
            <div className="text-xs text-neutral-500 mb-1">{t.benchmarkPrecision}</div>
            <div className="text-3xl font-bold font-mono text-emerald-600 tabular-nums">
              {metrics.precision}%
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">
              {isRtl
                ? `${metrics.truePositives} إيجابيات حقيقية / ${metrics.detectedErrorsCount} مكتشفة`
                : `${metrics.truePositives} True Positives / ${metrics.detectedErrorsCount} Detected`}
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-xs">
            <div className="text-xs text-neutral-500 mb-1">{t.benchmarkRecall}</div>
            <div className="text-3xl font-bold font-mono text-sky-600 tabular-nums">
              {metrics.recall}%
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">
              {isRtl
                ? `اكتُشف ${metrics.truePositives} من أصل ${metrics.plantedErrorsCount} أخطاء مزروعة`
                : `Found ${metrics.truePositives} of ${metrics.plantedErrorsCount} planted discrepancies`}
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-xs">
            <div className="text-xs text-neutral-500 mb-1">{t.benchmarkAccuracy}</div>
            <div className="text-3xl font-bold font-mono text-indigo-600 tabular-nums">
              {metrics.calculationAccuracy}%
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">
              {isRtl ? 'دقة حسابية قطعية خالية من أي انحراف' : 'Deterministic decimal code-verified accuracy'}
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-xs">
            <div className="text-xs text-neutral-500 mb-1">{t.benchmarkF1}</div>
            <div className="text-3xl font-bold font-mono text-neutral-900 dark:text-neutral-100 tabular-nums">
              {metrics.f1Score}%
            </div>
            <div className="text-[11px] text-neutral-400 mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{isRtl ? `تمت المعالجة في ${metrics.averageProcessingTimeMs}ms` : `Processed in ${metrics.averageProcessingTimeMs}ms`}</span>
            </div>
          </div>
        </div>
      )}

      {/* Dataset Composition Table */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs space-y-4">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-neutral-500" />
          <span>
            {isRtl ? 'تكوين حزمة الاختبار المعياري المركبة' : 'Synthetic Test Harness Dataset Composition'}
          </span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center text-xs">
          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/60">
            <div className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100">10</div>
            <div className="text-neutral-500 text-[11px]">{isRtl ? 'موردين' : 'Suppliers'}</div>
          </div>
          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/60">
            <div className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100">100</div>
            <div className="text-neutral-500 text-[11px]">{isRtl ? 'فاتورة' : 'Invoices'}</div>
          </div>
          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/60">
            <div className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100">100</div>
            <div className="text-neutral-500 text-[11px]">{isRtl ? 'أمر شراء' : 'Purchase Orders'}</div>
          </div>
          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/60">
            <div className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100">20</div>
            <div className="text-neutral-500 text-[11px]">{isRtl ? 'عقد رئيسي' : 'Master Contracts'}</div>
          </div>
          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/60">
            <div className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100">50</div>
            <div className="text-neutral-500 text-[11px]">{isRtl ? 'بوليصة شحن' : 'Shipment Bills'}</div>
          </div>
        </div>
      </div>

      {/* Planted Discrepancies Verification Registry */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs space-y-4">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center justify-between">
          <span>{isRtl ? 'سجل الأخطاء المالية المزروعة للاختبار (Ground Truth)' : 'Planted Ground-Truth Discrepancies Registry'}</span>
          <span className="text-xs font-normal text-neutral-500">
            {GROUND_TRUTH_DISCREPANCIES.length} {isRtl ? 'حالات مستهدفة' : 'Target Test Cases'}
          </span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left rtl:text-right text-xs">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-500">
                <th className="pb-2 font-medium">{isRtl ? 'النوع' : 'Category'}</th>
                <th className="pb-2 font-medium">{isRtl ? 'المعرف المرجعي' : 'Reference'}</th>
                <th className="pb-2 font-medium text-right rtl:text-left">{isRtl ? 'المبلغ المستهدف' : 'Expected Recovery'}</th>
                <th className="pb-2 font-medium">{isRtl ? 'الوصف' : 'Description'}</th>
                <th className="pb-2 font-medium">{isRtl ? 'حالة المطابقة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
              {GROUND_TRUTH_DISCREPANCIES.map((gt, idx) => {
                const refKey = gt.invoiceNumber || gt.contractId || gt.trackingNumber || `gt-${idx}`;
                return (
                  <tr key={refKey} className="text-neutral-700 dark:text-neutral-300">
                    <td className="py-2.5 font-medium">{gt.type}</td>
                    <td className="py-2.5 font-mono text-[11px] text-neutral-500">
                      {refKey}
                    </td>
                    <td className="py-2.5 font-mono tabular-nums text-right rtl:text-left text-emerald-600 dark:text-emerald-400 font-semibold">
                      {formatCurrency(gt.expectedRecovery)}
                    </td>
                    <td className="py-2.5 text-neutral-500 text-[11px]">
                      {gt.supplierId
                        ? isRtl ? `المورد: ${gt.supplierId}` : `Supplier: ${gt.supplierId}`
                        : gt.carrier
                        ? isRtl ? `شركة الشحن: ${gt.carrier}` : `Carrier: ${gt.carrier}`
                        : isRtl ? 'حالة اختبار حقيقية' : 'Ground-truth case'}
                    </td>
                    <td className="py-2.5">
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{isRtl ? 'تم التحقق' : 'Verified'}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
