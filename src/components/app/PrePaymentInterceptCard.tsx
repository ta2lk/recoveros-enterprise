import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { Button } from '../ui/Button';
import {
  ShieldAlert,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RotateCw,
  Bell,
  Lock,
  ArrowRight,
  ShieldCheck,
  Send,
} from 'lucide-react';

interface BlockedItem {
  id: string;
  invoiceNumber: string;
  supplier: string;
  amount: number;
  scheduledPayDate: string;
  riskReason: string;
  status: 'HELD' | 'RELEASED' | 'BLOCKED_PERMANENTLY';
}

export const PrePaymentInterceptCard: React.FC = () => {
  const { formatCurrency, formatDate, isRtl } = useI18n();
  const [isScanning, setIsScanning] = useState(false);
  const [autoInterceptEnabled, setAutoInterceptEnabled] = useState(true);
  const [blockedItems, setBlockedItems] = useState<BlockedItem[]>([
    {
      id: 'INT-01',
      invoiceNumber: 'INV-2026-9011-DUP',
      supplier: 'Apex Industrial Supplies',
      amount: 14500,
      scheduledPayDate: '2026-10-02',
      riskReason: isRtl
        ? 'تطابق كامل للمبلغ وتاريخ الفاتورة مع تحويل مسجل مسبقاً (دفع مكرر محتمل)'
        : 'Exact disbursement match to Settled Wire #W-4412 (Duplicate payment risk)',
      status: 'HELD',
    },
    {
      id: 'INT-02',
      invoiceNumber: 'INV-2026-8841',
      supplier: 'FastTrack Logistics',
      amount: 3900,
      scheduledPayDate: '2026-10-03',
      riskReason: isRtl
        ? 'عدم خصم نسبة 2% المتاحة بالسداد قبل 10 أيام (خسارة خصم مبكر)'
        : 'Eligible for 2% early payment discount ($78.00 unapplied discount)',
      status: 'HELD',
    },
  ]);

  const [notificationSlack, setNotificationSlack] = useState(true);
  const [notificationEmail, setNotificationEmail] = useState(true);

  const handleRunScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      // Add another intercepted item
      const newItem: BlockedItem = {
        id: `INT-${Date.now().toString().slice(-2)}`,
        invoiceNumber: `INV-2026-${Math.floor(Math.random() * 8000 + 1000)}`,
        supplier: 'Global Precision Parts',
        amount: 8200,
        scheduledPayDate: '2026-10-04',
        riskReason: isRtl
          ? 'تجاوز تسعير بند الفاتورة للمبلغ المتفق عليه في أمر الشراء بنسبة 12%'
          : 'Invoice line price exceeds PO contracted ceiling by 12%',
        status: 'HELD',
      };
      setBlockedItems((prev) => [newItem, ...prev]);
    }, 1200);
  };

  const handleAction = (id: string, action: 'RELEASED' | 'BLOCKED_PERMANENTLY') => {
    setBlockedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: action } : item))
    );
  };

  const totalHeldCash = blockedItems
    .filter((i) => i.status === 'HELD')
    .reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs space-y-5">
      {/* Header & Gatekeeper Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <span>
                {isRtl
                  ? 'محرك اعتراض المدفوعات الاستباقي (Pre-Disbursement Intercept Gatekeeper)'
                  : 'Real-Time Pre-Disbursement Intercept Gatekeeper'}
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                  autoInterceptEnabled
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                    : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500'
                }`}
              >
                {autoInterceptEnabled ? 'ACTIVE & GUARDING' : 'PAUSED'}
              </span>
            </h3>
            <p className="text-xs text-neutral-500">
              {isRtl
                ? 'يفحص دفعات السداد الأسبوعية (ACH / Wire) ويعترض الفواتير المكررة والمشبوهة قبل خروج الأموال من حساب الخزينة'
                : 'Scans scheduled bank payment runs to intercept and freeze duplicate disbursements before cash leaves treasury'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setAutoInterceptEnabled(!autoInterceptEnabled)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
              autoInterceptEnabled
                ? 'bg-neutral-100 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                : 'bg-emerald-600 border-emerald-600 text-white'
            }`}
          >
            {autoInterceptEnabled
              ? isRtl ? 'إيقاف مؤقت' : 'Pause Gatekeeper'
              : isRtl ? 'تفعيل الحارس' : 'Enable Gatekeeper'}
          </button>

          <Button
            variant="primary"
            size="sm"
            disabled={isScanning}
            onClick={handleRunScan}
            className="gap-1.5"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>
              {isScanning
                ? isRtl ? 'جارٍ فحص الدفعة...' : 'Scanning Batch...'
                : isRtl ? 'فحص دفعة السداد الحالية' : 'Scan Pending Payment Batch'}
            </span>
          </Button>
        </div>
      </div>

      {/* Held Cash Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 text-xs">
        <div>
          <span className="text-neutral-500">{isRtl ? 'السيولة المحمية من الصرف الخاطئ:' : 'Cash Prevented From Leakage:'}</span>
          <div className="text-base font-mono font-black text-rose-600 dark:text-rose-400 mt-0.5">
            {formatCurrency(totalHeldCash)}
          </div>
        </div>

        <div>
          <span className="text-neutral-500">{isRtl ? 'المعاملات المعلقة قيد المراجعة:' : 'Disbursements Held in Queue:'}</span>
          <div className="text-base font-mono font-bold text-neutral-900 dark:text-neutral-100 mt-0.5">
            {blockedItems.filter((i) => i.status === 'HELD').length} Transactions
          </div>
        </div>

        <div>
          <span className="text-neutral-500">{isRtl ? 'قنوات الإشعار الفوري:' : 'Alert Channels:'}</span>
          <div className="flex items-center gap-3 mt-1 text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={notificationSlack}
                onChange={(e) => setNotificationSlack(e.target.checked)}
                className="rounded text-emerald-600"
              />
              <span>#finance-alerts (Slack)</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={notificationEmail}
                onChange={(e) => setNotificationEmail(e.target.checked)}
                className="rounded text-emerald-600"
              />
              <span>CFO Email</span>
            </label>
          </div>
        </div>
      </div>

      {/* Held Transactions Table */}
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-x-auto text-xs">
        <table className="w-full text-left rtl:text-right border-collapse">
          <thead className="bg-neutral-100 dark:bg-neutral-800/80 text-[11px] text-neutral-600 dark:text-neutral-400 uppercase font-semibold">
            <tr>
              <th className="p-2.5">{isRtl ? 'معرف الاعتراض' : 'Intercept ID'}</th>
              <th className="p-2.5">{isRtl ? 'رقم الفاتورة' : 'Invoice #'}</th>
              <th className="p-2.5">{isRtl ? 'المورد' : 'Supplier'}</th>
              <th className="p-2.5 text-right rtl:text-left">{isRtl ? 'المبلغ' : 'Amount'}</th>
              <th className="p-2.5">{isRtl ? 'تاريخ الصرف' : 'Scheduled Date'}</th>
              <th className="p-2.5">{isRtl ? 'سبب الاعتراض والمخاطرة' : 'Detection Risk Reason'}</th>
              <th className="p-2.5 text-center">{isRtl ? 'الحالة' : 'Status'}</th>
              <th className="p-2.5 text-right rtl:text-left">{isRtl ? 'الإجراء' : 'Action'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {blockedItems.map((item) => (
              <tr key={item.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                <td className="p-2.5 font-mono text-neutral-500">{item.id}</td>
                <td className="p-2.5 font-mono font-semibold">{item.invoiceNumber}</td>
                <td className="p-2.5">{item.supplier}</td>
                <td className="p-2.5 font-mono text-right rtl:text-left font-bold text-rose-600 dark:text-rose-400">
                  {formatCurrency(item.amount)}
                </td>
                <td className="p-2.5 font-mono text-neutral-500">{item.scheduledPayDate}</td>
                <td className="p-2.5 text-neutral-600 dark:text-neutral-300 max-w-xs">
                  {item.riskReason}
                </td>
                <td className="p-2.5 text-center">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      item.status === 'HELD'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        : item.status === 'BLOCKED_PERMANENTLY'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    }`}
                  >
                    {item.status}
                  </span>
                </td>
                <td className="p-2.5 text-right rtl:text-left">
                  {item.status === 'HELD' ? (
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleAction(item.id, 'BLOCKED_PERMANENTLY')}
                        className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        {isRtl ? 'تأكيد الحظر' : 'Block & Void'}
                      </button>
                      <button
                        onClick={() => handleAction(item.id, 'RELEASED')}
                        className="px-2 py-1 bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 text-neutral-800 dark:text-neutral-200 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        {isRtl ? 'إفراج بتفويض' : 'Release'}
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-neutral-400 italic">Action Logged</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
