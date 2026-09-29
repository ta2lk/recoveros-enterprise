import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { useTenant } from '../../store/TenantContext';
import {
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  Cpu,
  Copy,
  CheckCircle2,
  Sliders,
  Building,
  Clock,
  Code2,
  Flame,
  ArrowUpRight,
} from 'lucide-react';
import { Button } from '../ui/Button';

export const AnalyticsView: React.FC = () => {
  const { t, formatCurrency, isRtl } = useI18n();
  const { state } = useTenant();

  const [copiedRuleId, setCopiedRuleId] = useState<string | null>(null);

  // Monthly trends simulation
  const months = [
    { month: isRtl ? 'أبريل' : 'Apr', recovered: 12400, discovered: 16500 },
    { month: isRtl ? 'مايو' : 'May', recovered: 18200, discovered: 22100 },
    { month: isRtl ? 'يونيو' : 'Jun', recovered: 24500, discovered: 28900 },
    { month: isRtl ? 'يوليو' : 'Jul', recovered: 31000, discovered: 35400 },
    { month: isRtl ? 'أغسطس' : 'Aug', recovered: 29800, discovered: 32000 },
    { month: isRtl ? 'سبتمبر' : 'Sep', recovered: 42500, discovered: 48900 },
  ];

  const rootCauses = [
    {
      id: 'RC-1',
      title: isRtl ? 'تكرار كود المورد في دليل الحسابات (Duplicate Vendor Masters)' : 'Duplicate Vendor Masters in ERP',
      impactPercent: 38,
      amount: 58400,
      description: isRtl
        ? 'تسجيل المورد الواحد بأكثر من رقم تعريفي (مثل Apex Industrial و Apex Ltd) مما يعطل كشف الفواتير المكررة.'
        : 'Same legal entity registered under multiple supplier IDs (e.g. Apex LLC vs Apex Global), bypassing ERP standard duplicate checks.',
      erpTarget: 'SAP S/4HANA & NetSuite',
      ruleCode: `// NetSuite SuiteScript 2.1 Duplicate Vendor Invariant
define(['N/search'], function(search) {
  function beforeSubmit(context) {
    var inv = context.newRecord;
    var taxId = inv.getValue({ fieldId: 'custbody_vendor_tax_id' });
    var invNum = inv.getValue({ fieldId: 'tranid' });
    var count = search.create({
      type: 'vendorbill',
      filters: [['tranid', 'is', invNum], 'AND', ['vendor.taxid', 'is', taxId]]
    }).runPaged().count;
    if (count > 0) throw new Error('RECOVEROS_GUARD: Duplicate invoice detected across vendor aliases.');
  }
  return { beforeSubmit: beforeSubmit };
});`,
    },
    {
      id: 'RC-2',
      title: isRtl ? 'عنق زجاجة الاعتمادات وضياع خصم السداد المبكر' : 'Approval Chain Latency (Missed 2/10 Discounts)',
      impactPercent: 29,
      amount: 34200,
      description: isRtl
        ? 'استغراق دورة التوقيعات أكثر من 10 أيام مما يفوت الاستفادة من خصم 2% المنصوص عليه تعاقدياً.'
        : 'Internal department approval cycles averaging 14 days, forfeiting the 2% discount window specified in contract clause 4.2.',
      erpTarget: 'Coupa & Workday',
      ruleCode: `// Coupa Fast-Track AP Rule for 2/10 Net 30 Invoices
RULE fast_track_discount_invoices:
  WHEN invoice.payment_terms CONTAINS '2/10' 
  AND invoice.due_days_remaining < 6
  THEN ESCALATE_TO_DEPUTY_CONTROLLER_URGENT()
  SET routing_priority = 'CRITICAL_DISCOUNT_PROTECT';`,
    },
    {
      id: 'RC-3',
      title: isRtl ? 'رسوم الشحن والوقود المتجاوزة للسقوف التعاقدية' : 'Uncapped Freight Surcharges & Fuel Indices',
      impactPercent: 18,
      amount: 19800,
      description: isRtl
        ? 'قيام شركات النقل بفوترة رسوم رافعة هيدروليكية أو وقود إضافية غير مدرجة في بطاقة الأسعار المتفق عليها.'
        : 'Carriers applying unindexed fuel adjustments and liftgate fees exceeding contracted master service rate card caps.',
      erpTarget: 'Oracle Transportation Mgmt',
      ruleCode: `// OTM Freight Tariff Variance Check
IF billed_fuel_surcharge > contracted_fuel_index * 1.05 THEN
  REJECT_LINE_ITEM(code = 'FREIGHT_VARIANCE_OVER_CAP');
  NOTIFY_RECOVEROS_WEBHOOK('Discrepancy intercepted on BOL');
END IF;`,
    },
    {
      id: 'RC-4',
      title: isRtl ? 'تعديل أسعار بنود أوامر الشراء يدوياً دون ملحق تعاقدي' : 'Manual PO Line Price Overrides',
      impactPercent: 15,
      amount: 14600,
      description: isRtl
        ? 'تجاوز مسؤولي المشتريات للأسعار المعتمدة في العقود الرئيسية وإدخال أسعار فردية أعلى.'
        : 'Procurement buyers manually typing higher item unit rates instead of selecting catalog contractual tier pricing.',
      erpTarget: 'All Accounting ERPs',
      ruleCode: `// Generic Webhook Validation Payload
POST /api/webhooks/recoveros-po-audit
Headers: { "X-RecoverOS-Tenant": "tenant_enterprise" }
Body: { "event": "po.price_variance", "action": "ENFORCE_TIER_FLOOR" }`,
    },
  ];

  const handleCopyRule = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedRuleId(id);
    setTimeout(() => setCopiedRuleId(null), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {t.appAnalytics}
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {isRtl
              ? 'تحليلات الأسباب الجذرية لمنع التسرب المالي، ومؤشرات كفاءة الحسابات الدائنة (AP)'
              : 'Root-cause diagnostic engine, prevention configurations, and macro AP efficiency trends'}
          </p>
        </div>
      </div>

      {/* Top Health KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xs">
          <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
            {isRtl ? 'معدل التسرب المالي العام' : 'AP Leakage Ratio'}
          </div>
          <div className="text-2xl font-mono font-black text-rose-600 dark:text-rose-400 mt-1">
            0.82%
          </div>
          <div className="text-[11px] text-neutral-500 mt-1 flex items-center gap-1">
            <span className="text-emerald-500 font-semibold">&darr; 0.35%</span>
            <span>{isRtl ? 'تحسن منذ تفعيل النظام' : 'vs industry avg 1.2%'}</span>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xs">
          <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
            {isRtl ? 'متوسط سرعة استرداد النزاع' : 'Avg Recovery Velocity'}
          </div>
          <div className="text-2xl font-mono font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {isRtl ? '8.4 يوم' : '8.4 Days'}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            {isRtl ? 'من الاكتشاف إلى إشعار الدائن' : 'Detection to ledger credit'}
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xs">
          <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
            {isRtl ? 'كفاءة محرك المنع الاستباقي' : 'Prevention Score'}
          </div>
          <div className="text-2xl font-mono font-black text-blue-600 dark:text-blue-400 mt-1">
            94.6%
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            {isRtl ? 'أخطاء تم منعها قبل صرفها' : 'Pre-disbursement interception'}
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xs">
          <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
            {isRtl ? 'مجموع المبالغ المستردة' : 'Total Recovered Cash'}
          </div>
          <div className="text-2xl font-mono font-black text-neutral-900 dark:text-neutral-100 mt-1">
            {formatCurrency(158400)}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1 font-semibold">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>{isRtl ? '100% مدقق برمجياً' : '100% Code-Verified'}</span>
          </div>
        </div>
      </div>

      {/* Monthly Recovery Velocity Chart */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <span>{isRtl ? 'سرعة الاسترداد والمبالغ المكتشفة (آخر 6 أشهر)' : 'Recovery Velocity & Discovered Variance (Past 6 Months)'}</span>
          </h3>
          <span className="text-xs text-neutral-500 font-mono">
            {isRtl ? 'تسويات الخزينة الشهرية' : 'Monthly Treasury Settlement'}
          </span>
        </div>

        <div className="flex items-end justify-between gap-4 h-52 pt-6 px-4 border-b border-neutral-200 dark:border-neutral-800">
          {months.map((m) => {
            const heightPercent = Math.round((m.recovered / 50000) * 100);
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <div className="text-[10px] font-mono font-semibold text-neutral-600 dark:text-neutral-400">
                  ${(m.recovered / 1000).toFixed(1)}k
                </div>
                <div
                  style={{ height: `${heightPercent}%` }}
                  className="w-full max-w-[48px] bg-emerald-600 dark:bg-emerald-500 rounded-t transition-all hover:opacity-90"
                />
                <div className="text-xs font-medium text-neutral-500 mt-1">
                  {m.month}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-6 mt-4 text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-xs bg-emerald-600" />
            <span>{isRtl ? 'الأموال المستردة فعلياً في الخزينة' : 'Verified Recovered Cash'}</span>
          </div>
        </div>
      </div>

      {/* Root Cause Diagnostics & Prevention Configurations */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-emerald-500" />
              <span>{isRtl ? 'محرك تشخيص الأسباب الجذرية وقواعد المنع في أنظمة الـ ERP' : 'Root Cause Diagnostics & Automated ERP Prevention Rules'}</span>
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              {isRtl
                ? 'لا نكتفي باسترداد الأموال، بل نعالج أصل المشكلة لمنع تكرار الخطأ برمجياً في نظامك المحاسبي'
                : 'Eliminate root causes permanently by deploying audited prevention scripts directly to your ERP'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rootCauses.map((rc) => {
            const isCopied = copiedRuleId === rc.id;
            return (
              <div
                key={rc.id}
                className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold">
                      {rc.impactPercent}% of Total Leakage
                    </span>
                    <span className="text-xs font-mono font-bold text-neutral-700 dark:text-neutral-300">
                      {formatCurrency(rc.amount)} Identified
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    {rc.title}
                  </h4>

                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    {rc.description}
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-neutral-500 font-medium">Target ERP System:</span>
                    <span className="font-mono font-semibold text-neutral-800 dark:text-neutral-200">
                      {rc.erpTarget}
                    </span>
                  </div>

                  <div className="relative group">
                    <pre className="p-3 bg-neutral-950 text-neutral-300 rounded-lg text-[10px] font-mono overflow-x-auto max-h-28 border border-neutral-800">
                      {rc.ruleCode}
                    </pre>

                    <button
                      onClick={() => handleCopyRule(rc.id, rc.ruleCode)}
                      className="absolute top-2 right-2 rtl:right-auto rtl:left-2 px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {isCopied ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{isCopied ? (isRtl ? 'تم النسخ' : 'Copied!') : (isRtl ? 'نسخ كود الـ ERP' : 'Copy ERP Rule')}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
