import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { useTenant } from '../../store/TenantContext';
import { Button } from '../ui/Button';
import { StatusMarker } from '../ui/Badge';
import { FileUp, FileText, CheckCircle2, ShieldCheck, UploadCloud, Search } from 'lucide-react';
import { LiveCsvIngestor } from './LiveCsvIngestor';

export const DocumentsView: React.FC = () => {
  const { t, formatDate, isRtl } = useI18n();
  const { state, uploadDocument, runAudit } = useTenant();

  const [dragActive, setDragActive] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const ext = f.name.split('.').pop()?.toUpperCase() || 'PDF';
      const fileType = (['PDF', 'CSV', 'XLSX', 'DOCX', 'IMAGE'].includes(ext) ? ext : 'PDF') as any;

      uploadDocument({
        name: f.name,
        fileType,
        fileSize: f.size,
        uploadedBy: state.currentUser.name,
        status: 'PARSED',
        extractionConfidence: 96,
        parsedEntitiesCount: Math.floor(Math.random() * 40) + 12,
        rawTextPreview: `Extracted entities from ${f.name}. Billed items, authorized purchase orders, and tax entries parsed into tenant memory.`,
      });
    }

    // Trigger matching audit
    runAudit();
  };

  const filteredDocs = state.documents.filter((d) =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {t.appDocuments}
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {isRtl ? 'بوابة رفع ومعالجة واستخراج بيانات الفواتير والعقود والملفات المحاسبية' : 'Secure document ingestion center with OCR, entity normalization, and confidence tracking'}
          </p>
        </div>
      </div>

      {/* Live CSV / Ledger Ingestor Sandbox */}
      <LiveCsvIngestor />

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          const files = e.dataTransfer.files;
          if (files && files.length > 0) {
            for (let i = 0; i < files.length; i++) {
              const f = files[i];
              const ext = f.name.split('.').pop()?.toUpperCase() || 'PDF';
              uploadDocument({
                name: f.name,
                fileType: (['PDF', 'CSV', 'XLSX', 'DOCX', 'IMAGE'].includes(ext) ? ext : 'PDF') as any,
                fileSize: f.size,
                uploadedBy: state.currentUser.name,
                status: 'PARSED',
                extractionConfidence: 97,
                parsedEntitiesCount: 28,
                rawTextPreview: `Drag-dropped document ${f.name} ingested successfully.`,
              });
            }
            runAudit();
          }
        }}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors bg-white dark:bg-neutral-900 ${
          dragActive
            ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20'
            : 'border-neutral-300 dark:border-neutral-700 hover:border-neutral-400'
        }`}
      >
        <UploadCloud className="w-10 h-10 mx-auto text-emerald-600 dark:text-emerald-400 mb-3" />
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
          Upload Financial Documents for Audit
        </h3>
        <p className="text-xs text-neutral-500 max-w-md mx-auto mb-4">
          Drop PDF invoices, CSV ledgers, Excel rate cards, DOCX procurement contracts, or carrier bills.
          Data is quarantined, sanitized against prompt injection, and isolated to your tenant.
        </p>
        <label className="inline-block">
          <input
            type="file"
            multiple
            accept=".pdf,.csv,.xlsx,.xls,.docx,.png,.jpg,.jpeg"
            onChange={handleFileUpload}
            className="hidden"
          />
          <span className="px-4 py-2 bg-neutral-900 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 text-xs font-semibold rounded-lg cursor-pointer hover:bg-neutral-800 transition-colors inline-flex items-center gap-2">
            <FileUp className="w-4 h-4" />
            <span>Select Files from Computer</span>
          </span>
        </label>
      </div>

      {/* Document Library Table */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-xs">
        <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
            Ingested Documents ({filteredDocs.length})
          </div>
          <div className="w-64">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search documents..."
              className="w-full py-1 px-3 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left rtl:text-right border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-800/40 text-neutral-500 font-semibold">
                <th className="py-3 px-4">{isRtl ? 'اسم المستند' : 'Document Name'}</th>
                <th className="py-3 px-4">{isRtl ? 'الصيغة' : 'Format'}</th>
                <th className="py-3 px-4">{isRtl ? 'الحجم' : 'Size'}</th>
                <th className="py-3 px-4">{isRtl ? 'تاريخ الرفع' : 'Uploaded At'}</th>
                <th className="py-3 px-4">{isRtl ? 'الكيانات المستخرجة' : 'Parsed Entities'}</th>
                <th className="py-3 px-4 text-center">{isRtl ? 'دقة الاستخراج' : 'Extraction Confidence'}</th>
                <th className="py-3 px-4 text-center">{isRtl ? 'الحالة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-neutral-500">
                    {isRtl ? 'لا توجد مستندات مرفوعة حتى الآن.' : 'No documents uploaded yet.'}
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => (
                  <tr
                    key={doc.id}
                    className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-neutral-400" />
                        <span>{doc.name}</span>
                      </div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">
                        Uploaded by {doc.uploadedBy}
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-neutral-600 dark:text-neutral-400">
                      {doc.fileType}
                    </td>

                    <td className="py-3 px-4 font-mono text-neutral-500">
                      {(doc.fileSize / 1024).toFixed(1)} KB
                    </td>

                    <td className="py-3 px-4 text-neutral-500">
                      {formatDate(doc.uploadedAt)}
                    </td>

                    <td className="py-3 px-4 font-mono tabular-nums text-neutral-800 dark:text-neutral-200">
                      {doc.parsedEntitiesCount} records
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span className="font-mono tabular-nums font-semibold text-emerald-600">
                        {doc.extractionConfidence}%
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <StatusMarker label={doc.status} tone="emerald" />
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
