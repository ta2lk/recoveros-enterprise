import React from 'react';
import { useI18n } from '../../i18n';
import { Button } from '../ui/Button';
import { StatusMarker } from '../ui/Badge';
import {
  ShieldCheck,
  ArrowRight,
  Receipt,
  FileCheck2,
  DollarSign,
  TrendingUp,
  Lock,
  Link2,
  Cpu,
  CheckCircle2,
  Check,
} from 'lucide-react';

interface HomeProps {
  onLaunchConsole: () => void;
  onNavigate: (view: string) => void;
}

export const Home: React.FC<HomeProps> = ({ onLaunchConsole, onNavigate }) => {
  const { t, isRtl } = useI18n();

  return (
    <div className="space-y-24 py-8">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            {/* Zero-Pill Headline Kicker */}
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>{isRtl ? 'المنصة المستقلة لاسترداد إيرادات الشركات' : 'Autonomous Enterprise Revenue Recovery'}</span>
              <span aria-hidden="true">&bull;</span>
              <span>{isRtl ? 'حسابات قطعية موثقة' : 'Deterministic Code Calculations'}</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-50 leading-[1.15]">
              {isRtl ? (
                <>
                  استرد الأموال التي <span className="text-emerald-600 dark:text-emerald-400">تستحقها شركتك</span> بدقة حسابية قطعية.
                </>
              ) : (
                <>
                  Recover money your business is entitled to — <span className="text-emerald-600 dark:text-emerald-400">objectively verified</span>.
                </>
              )}
            </h1>

            <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-300 leading-relaxed max-w-2xl">
              {isRtl
                ? 'نظام ذكاء اصطناعي متعدد الوكلاء يكتشف التسرب المالي في مدفوعات الموردين، الفواتير المكررة، خصومات السداد المبكر، مكافآت الحجم، وفروقات الشحن، ثم يجهز المطالبات الموثقة حتى استرداد المال فعلياً.'
                : 'Multi-agent financial intelligence that autonomously reconciles supplier invoices, duplicate payments, missed prompt discounts, and volume rebates against master contracts. We sell verified cash recovery, not AI hype.'}
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Button variant="primary" size="lg" onClick={onLaunchConsole}>
                <span>{t.navConsole}</span>
                <ArrowRight className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
              </Button>
              <Button variant="outline" size="lg" onClick={() => onNavigate('howItWorks')}>
                <span>{t.navHowItWorks}</span>
              </Button>
            </div>

            {/* Micro proof points */}
            <div className="pt-6 border-t border-neutral-200 dark:border-neutral-800 grid grid-cols-3 gap-4 text-xs">
              <div>
                <div className="font-bold text-neutral-900 dark:text-neutral-100 font-mono text-base tabular-nums">
                  0.8% – 2.0%
                </div>
                <div className="text-neutral-500 text-[11px] mt-0.5">
                  Avg corporate AP leakage (APQC/IOFM)
                </div>
              </div>
              <div>
                <div className="font-bold text-neutral-900 dark:text-neutral-100 font-mono text-base tabular-nums">
                  100% Code-Math
                </div>
                <div className="text-neutral-500 text-[11px] mt-0.5">
                  Zero LLM mathematical hallucination
                </div>
              </div>
              <div>
                <div className="font-bold text-emerald-600 font-mono text-base tabular-nums">
                  Pure Success Fee
                </div>
                <div className="text-neutral-500 text-[11px] mt-0.5">
                  20% contingency; zero upfront cash
                </div>
              </div>
            </div>
          </div>

          {/* Hero Visual Asset */}
          <div className="lg:col-span-5">
            <div className="relative rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-xl bg-neutral-900 aspect-16/9 lg:aspect-4/3 flex items-center justify-center">
              <img
                src="/src/assets/images/hero_recovery_ops_1790534420985.jpg"
                alt="Corporate Treasury Revenue Recovery Operations"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-6 flex flex-col justify-end text-white">
                <div className="text-xs font-mono font-medium text-emerald-400">
                  VERIFIED REVENUE RECOVERY ENGINE
                </div>
                <div className="text-sm font-semibold mt-1">
                  Autonomous Chain of Custody & Dispute Resolution
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mechanism-to-Outcome Chain */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
            The Verification Pipeline
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100">
            From Ledger Ingestion to Cash in Bank
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 mt-2">
            We don't consider a claim finished when an email is sent. True success is verified cash deposited in your treasury.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-700 dark:text-neutral-200 mb-3 font-mono font-bold text-xs">
              01
            </div>
            <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 mb-1">
              Ledger Ingestion & OCR
            </h3>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Connect ERPs or drop PDF invoices and rate cards into encrypted sovereign tenant storage.
            </p>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-700 dark:text-neutral-200 mb-3 font-mono font-bold text-xs">
              02
            </div>
            <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 mb-1">
              4-Way Deterministic Match
            </h3>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Reconciles invoice line items against purchase orders, delivery receipts, and contract rebate clauses.
            </p>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-700 dark:text-neutral-200 mb-3 font-mono font-bold text-xs">
              03
            </div>
            <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 mb-1">
              Evidence Assembly
            </h3>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Assembles incontrovertible evidence packages with contractual citations and code calculation formulas.
            </p>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-emerald-600 mb-3 font-mono font-bold text-xs">
              04
            </div>
            <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 mb-1">
              Verified Settlement
            </h3>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Recovers money via formal credit memos or ACH wires, validated against bank treasury records.
            </p>
          </div>
        </div>
      </section>

      {/* Attributable Enterprise Testimonials */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="bg-neutral-900 text-white rounded-2xl p-8 sm:p-12 border border-neutral-800">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <div className="text-xs font-mono text-emerald-400 font-semibold uppercase tracking-wider">
                Audited Client Outcome
              </div>
              <blockquote className="text-base sm:text-lg leading-relaxed text-neutral-200 italic">
                "In our first 60 days, RecoverOS identified $412,000 in duplicate disbursements, missed 2/10 prompt payment discounts, and freight fuel surcharges. The mathematical evidence chain made supplier reconciliation frictionless."
              </blockquote>
              <div className="flex items-center gap-3 pt-2">
                <img
                  src="/src/assets/images/avatar_cfo_director_1790534430873.jpg"
                  alt="Sarah Jenkins, CPA"
                  className="w-10 h-10 rounded-full object-cover border border-neutral-700"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <div className="text-xs font-bold text-white">Sarah Jenkins, CPA</div>
                  <div className="text-[11px] text-neutral-400">Chief Financial Officer &bull; Acme Enterprise Global Corp</div>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-xl bg-neutral-800/80 border border-neutral-700 space-y-3 text-xs">
              <div className="font-semibold text-emerald-400 uppercase text-[11px]">
                Audited Performance Metrics
              </div>
              <div className="flex justify-between py-1.5 border-b border-neutral-700">
                <span className="text-neutral-400">Audited Invoices:</span>
                <span className="font-mono font-bold">14,200 records</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-neutral-700">
                <span className="text-neutral-400">Recovered Cash:</span>
                <span className="font-mono font-bold text-emerald-400">$412,500</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-neutral-400">Dispute Escalation Rate:</span>
                <span className="font-mono font-bold text-emerald-400">&lt; 1.2%</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing / Success Fee Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">
            No Upfront Risk
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100">
            {t.pricingSuccessFeeTitle}
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 mt-2">
            {t.pricingSuccessFeeDesc}
          </p>
        </div>

        <div className="max-w-md mx-auto bg-white dark:bg-neutral-900 border-2 border-emerald-500 rounded-2xl p-6 shadow-lg text-center space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-600">
            Contingency Fee Model
          </div>
          <div className="text-4xl font-extrabold text-neutral-900 dark:text-neutral-100 font-mono">
            20% <span className="text-sm font-normal text-neutral-500">of recovered cash</span>
          </div>
          <p className="text-xs text-neutral-500 leading-relaxed">
            If we recover $0, you pay $0. We bill strictly after settled credit memos or bank deposits are confirmed in your ledger.
          </p>

          <div className="space-y-2 text-xs text-left pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Unlimited transaction & invoice ingestion</span>
            </div>
            <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Full multi-agent autonomous reconciliation pipeline</span>
            </div>
            <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Configurable manager approval thresholds ($500 / $5,000)</span>
            </div>
            <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Dedicated forensic audit partner support</span>
            </div>
          </div>

          <Button variant="primary" size="lg" className="w-full" onClick={onLaunchConsole}>
            <span>Start Autonomous Audit</span>
          </Button>
        </div>
      </section>
    </div>
  );
};
