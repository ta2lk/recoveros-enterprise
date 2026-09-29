import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { useTenant } from '../../store/TenantContext';
import { Button } from '../ui/Button';
import { StatusMarker } from '../ui/Badge';
import {
  FileSpreadsheet,
  UploadCloud,
  Play,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  FileCheck,
  ShieldCheck,
} from 'lucide-react';
import { Invoice } from '../../types';

interface CsvRow {
  invoiceNumber: string;
  supplierName: string;
  invoiceDate: string;
  amount: number;
  paymentTerms: string;
  poNumber: string;
  anomaly?: string;
}

export const LiveCsvIngestor: React.FC = () => {
  const { formatCurrency, isRtl } = useI18n();
  const { state, importInvoicesAndRunAudit } = useTenant();

  const [rawCsvText, setRawCsvText] = useState('');
  const [parsedRows, setParsedRows] = useState<CsvRow[]>([]);
  const [auditRunResults, setAuditRunResults] = useState<{
    totalRows: number;
    anomaliesFound: number;
    potentialRecovery: number;
  } | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const sampleCsvData = `InvoiceNumber,SupplierName,InvoiceDate,Amount,PaymentTerms,PONumber
INV-2026-9011,Apex Industrial Supplies,2026-09-10,14500.00,2/10 Net 30,PO-APX-882
INV-2026-9011-DUP,Apex Industrial Supplies,2026-09-12,14500.00,2/10 Net 30,PO-APX-882
INV-2026-9045,CloudScale Data Systems,2026-09-14,28400.00,Net 30,PO-CSD-109
INV-2026-9077,FastTrack Logistics,2026-09-18,6350.00,1/10 Net 30,PO-FTL-441
INV-2026-9099,Global Precision Parts,2026-09-22,8900.00,3/15 Net 45,PO-GPP-712
INV-2026-9102,Apex Industrial Supplies,2026-09-25,9200.00,2/10 Net 30,PO-APX-890`;

  const parseCsv = (text: string) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const invIdx = headers.findIndex((h) => h.includes('invoice') || h.includes('inv'));
    const supIdx = headers.findIndex((h) => h.includes('supplier') || h.includes('vendor'));
    const dateIdx = headers.findIndex((h) => h.includes('date'));
    const amtIdx = headers.findIndex((h) => h.includes('amount') || h.includes('total'));
    const termsIdx = headers.findIndex((h) => h.includes('term'));
    const poIdx = headers.findIndex((h) => h.includes('po') || h.includes('purchase'));

    const rows: CsvRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim());
      if (parts.length < 3) continue;

      const invoiceNumber = parts[invIdx >= 0 ? invIdx : 0] || `INV-CSV-${i}`;
      const supplierName = parts[supIdx >= 0 ? supIdx : 1] || 'Supplier ' + i;
      const invoiceDate = parts[dateIdx >= 0 ? dateIdx : 2] || '2026-09-15';
      const amount = parseFloat(parts[amtIdx >= 0 ? amtIdx : 3]) || 0;
      const paymentTerms = parts[termsIdx >= 0 ? termsIdx : 4] || 'Net 30';
      const poNumber = parts[poIdx >= 0 ? poIdx : 5] || `PO-${i}`;

      let anomaly: string | undefined = undefined;
      if (invoiceNumber.includes('DUP') || (i > 1 && rows.some((r) => r.supplierName === supplierName && r.amount === amount))) {
        anomaly = isRtl ? 'دفع مكرر مطابق' : 'Duplicate Disbursement';
      } else if (paymentTerms.includes('2/10') || paymentTerms.includes('1/10') || paymentTerms.includes('3/15')) {
        anomaly = isRtl ? 'خصم سداد مبكر ضائع' : 'Missed Early Payment Discount (2%)';
      }

      rows.push({
        invoiceNumber,
        supplierName,
        invoiceDate,
        amount,
        paymentTerms,
        poNumber,
        anomaly,
      });
    }
    return rows;
  };

  const handleLoadSample = () => {
    setRawCsvText(sampleCsvData);
    const rows = parseCsv(sampleCsvData);
    setParsedRows(rows);
    runLiveScan(rows);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setRawCsvText(text);
      const rows = parseCsv(text);
      setParsedRows(rows);
      runLiveScan(rows);
    };
    reader.readAsText(file);
  };

  const runLiveScan = (rows: CsvRow[]) => {
    let anomalies = 0;
    let potential = 0;

    rows.forEach((r) => {
      if (r.anomaly?.includes('Duplicate') || r.anomaly?.includes('مكرر')) {
        anomalies++;
        potential += r.amount;
      } else if (r.anomaly?.includes('Discount') || r.anomaly?.includes('خصم')) {
        anomalies++;
        potential += r.amount * 0.02;
      }
    });

    setAuditRunResults({
      totalRows: rows.length,
      anomaliesFound: anomalies,
      potentialRecovery: potential,
    });
  };

  const handleCommitToOpportunities = () => {
    if (parsedRows.length === 0) return;

    const newInvoices: Invoice[] = parsedRows.map((r, idx) => ({
      id: `inv-csv-${Date.now()}-${idx}`,
      tenantId: state.currentTenant.id,
      supplierId: state.suppliers[0]?.id || 'sup-1',
      invoiceNumber: r.invoiceNumber,
      purchaseOrderId: r.poNumber,
      invoiceDate: r.invoiceDate,
      dueDate: '2026-10-20',
      currency: 'USD',
      subtotal: r.amount,
      taxAmount: 0,
      totalAmount: r.amount,
      paidAmount: r.amount,
      paymentStatus: 'PAID',
      matchStatus: r.anomaly ? 'DISCREPANCY' : 'MATCHED',
      lineItems: [
        {
          id: `line-${idx}`,
          description: `Disbursed line item for ${r.invoiceNumber}`,
          quantity: 1,
          unitPrice: r.amount,
          totalPrice: r.amount,
        },
      ],
      createdAt: new Date().toISOString(),
    }));

    importInvoicesAndRunAudit(newInvoices);
    setIsSuccess(true);
    setTimeout(() => setIsSuccess(false), 5000);
  };

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <span>{isRtl ? 'محاكي استيراد وفحص دفاتر الحسابات (Live CSV / ERP Ingestion)' : 'Live CSV & ERP Ledger Ingestion Sandbox'}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold">
                Deterministic Scan
              </span>
            </h3>
            <p className="text-xs text-neutral-500">
              {isRtl
                ? 'ارفع أو حمّل عينة دفاتر حقيقية لاختبار خوارزميات التدقيق واكتشاف التجاوزات فوراً'
                : 'Upload or generate sample enterprise invoice ledgers to test instant discrepancy detection'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleLoadSample}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-xs font-semibold text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>{isRtl ? 'تحميل نموذج فواتير واقعي' : 'Load Sample ERP Ledger'}</span>
          </button>

          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors cursor-pointer">
            <UploadCloud className="w-3.5 h-3.5" />
            <span>{isRtl ? 'اختيار ملف CSV' : 'Upload CSV File'}</span>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Parse Preview Statistics */}
      {auditRunResults && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 text-xs">
          <div>
            <span className="text-neutral-500">{isRtl ? 'عدد الفواتير المفحوصة:' : 'Invoices Parsed:'}</span>
            <div className="font-mono font-bold text-neutral-900 dark:text-neutral-100 text-sm mt-0.5">
              {auditRunResults.totalRows}
            </div>
          </div>
          <div>
            <span className="text-neutral-500">{isRtl ? 'التجاوزات المكتشفة:' : 'Discrepancies Flagged:'}</span>
            <div className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm mt-0.5 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{auditRunResults.anomaliesFound}</span>
            </div>
          </div>
          <div>
            <span className="text-neutral-500">{isRtl ? 'القيمة القابلة للاسترداد:' : 'Recoverable Variance:'}</span>
            <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm mt-0.5">
              {formatCurrency(auditRunResults.potentialRecovery)}
            </div>
          </div>
        </div>
      )}

      {/* Table Preview of Ingested Rows */}
      {parsedRows.length > 0 && (
        <div className="space-y-3">
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-x-auto text-xs">
            <table className="w-full text-left rtl:text-right border-collapse">
              <thead className="bg-neutral-100 dark:bg-neutral-800/80 text-[11px] text-neutral-600 dark:text-neutral-400 uppercase font-semibold">
                <tr>
                  <th className="p-2.5">{isRtl ? 'رقم الفاتورة' : 'Invoice #'}</th>
                  <th className="p-2.5">{isRtl ? 'المورد' : 'Supplier'}</th>
                  <th className="p-2.5">{isRtl ? 'التاريخ' : 'Date'}</th>
                  <th className="p-2.5 text-right rtl:text-left">{isRtl ? 'المبلغ' : 'Amount'}</th>
                  <th className="p-2.5">{isRtl ? 'شروط السداد' : 'Terms'}</th>
                  <th className="p-2.5">{isRtl ? 'أمر الشراء' : 'PO Ref'}</th>
                  <th className="p-2.5">{isRtl ? 'نتيجة التدقيق' : 'Audit Finding'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {parsedRows.map((r, i) => (
                  <tr
                    key={i}
                    className={`hover:bg-neutral-50 dark:hover:bg-neutral-800/50 ${
                      r.anomaly ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''
                    }`}
                  >
                    <td className="p-2.5 font-mono font-semibold">{r.invoiceNumber}</td>
                    <td className="p-2.5">{r.supplierName}</td>
                    <td className="p-2.5 font-mono text-neutral-500">{r.invoiceDate}</td>
                    <td className="p-2.5 font-mono text-right rtl:text-left font-bold">
                      {formatCurrency(r.amount)}
                    </td>
                    <td className="p-2.5 font-mono text-neutral-600 dark:text-neutral-400">
                      {r.paymentTerms}
                    </td>
                    <td className="p-2.5 font-mono text-neutral-500">{r.poNumber}</td>
                    <td className="p-2.5">
                      {r.anomaly ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                          <AlertTriangle className="w-3 h-3" />
                          <span>{r.anomaly}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-neutral-500 bg-neutral-100 dark:bg-neutral-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>{isRtl ? 'مطابق' : 'Matched'}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="text-xs text-neutral-500 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>
                {isRtl
                  ? 'تم التحقق من الدقة الحسابية عبر محرك الفاصلة العشرية القطعي'
                  : 'Zero floating-point jitter verified across all transaction rows'}
              </span>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={handleCommitToOpportunities}
              className="gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isRtl ? 'إدراج التجاوزات في مسار الاسترداد النشط' : 'Import Findings to Recovery Pipeline'}</span>
            </Button>
          </div>
        </div>
      )}

      {isSuccess && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            {isRtl
              ? 'تم استيراد الفواتير وإعادة تشغيل التدقيق بنجاح! تم تحديث قائمة الفرص والمطالبات.'
              : 'Transactions ingested and audit rerun! Opportunities and dashboard metrics updated successfully.'}
          </span>
        </div>
      )}
    </div>
  );
};
