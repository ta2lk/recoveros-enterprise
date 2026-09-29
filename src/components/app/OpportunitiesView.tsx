import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { useTenant } from '../../store/TenantContext';
import { Opportunity, Evidence } from '../../types';
import { StatusMarker } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { AuditDossierModal } from './AuditDossierModal';
import {
  Search,
  FileCheck2,
  CheckCircle,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  Calculator,
  ExternalLink,
  FileCheck,
} from 'lucide-react';

export const OpportunitiesView: React.FC = () => {
  const { t, formatCurrency, formatDate, isRtl } = useI18n();
  const { state, startClaimFromOpportunity } = useTenant();

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [dossierOpp, setDossierOpp] = useState<Opportunity | null>(null);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  const filteredOpps = state.opportunities.filter((opp) => {
    const matchesSearch =
      opp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      opp.supplierName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      categoryFilter === 'ALL' || opp.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleStartClaim = async (opp: Opportunity) => {
    setIsClaiming(true);
    try {
      await startClaimFromOpportunity(opp);
      setIsClaimModalOpen(false);
      setSelectedOpp(null);
    } catch (err) {
      console.error('Failed to create claim:', err);
    } finally {
      setIsClaiming(false);
    }
  };

  const categories = [
    { id: 'ALL', label: isRtl ? 'الكل' : 'All Categories' },
    { id: 'DUPLICATE_PAYMENT', label: t.catDuplicatePayment },
    { id: 'SUPPLIER_OVERPAYMENT', label: t.catSupplierOverpayment },
    { id: 'MISSED_DISCOUNT', label: t.catMissedDiscount },
    { id: 'CONTRACT_REBATE', label: t.catContractRebate },
    { id: 'FREIGHT_OVERCHARGE', label: t.catFreightOvercharge },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {t.appOpportunities}
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {isRtl
              ? 'الفرص المستقلة المكتشفة مع سلسلة الأدلة غير القابلة للدحض'
              : 'Verifiable leakage discoveries backed by deterministic code calculations and document evidence'}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-neutral-900 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800">
        <div className="relative w-full sm:w-72">
          <Search className={`w-4 h-4 text-neutral-400 absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'}`} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t.actionSearch}
            className={`w-full py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
              isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'
            }`}
          />
        </div>

        {/* Interactive Segmented Filter (Allowed by Zero-Pill Discipline as functional buttons) */}
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryFilter(c.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                categoryFilter === c.id
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Opportunities Table */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left rtl:text-right border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-800/40 text-neutral-500 font-semibold">
                <th className="py-3 px-4">{isRtl ? 'فرصة الاسترداد' : 'Opportunity'}</th>
                <th className="py-3 px-4">{isRtl ? 'التصنيف' : 'Category'}</th>
                <th className="py-3 px-4">{isRtl ? 'المورد' : 'Supplier'}</th>
                <th className="py-3 px-4 text-right rtl:text-left">{isRtl ? 'المبلغ القابل للاسترداد' : 'Recoverable Amount'}</th>
                <th className="py-3 px-4 text-center">{isRtl ? 'نسبة الثقة' : 'Confidence'}</th>
                <th className="py-3 px-4 text-center">{isRtl ? 'الحالة' : 'Status'}</th>
                <th className="py-3 px-4 text-right rtl:text-left">{isRtl ? 'الإجراء' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {filteredOpps.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-neutral-500">
                    {isRtl ? 'لم يتم العثور على أي فرص مطابقة للبحث أو التصفية.' : 'No matching opportunities found.'}
                  </td>
                </tr>
              ) : (
                filteredOpps.map((opp) => (
                  <tr
                    key={opp.id}
                    className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {opp.title}
                      </div>
                      <div className="text-[11px] text-neutral-500 mt-0.5">
                        {isRtl ? `اكتشف بواسطة ${opp.discoveredByAgent}` : `Discovered by ${opp.discoveredByAgent}`} &bull; {formatDate(opp.createdAt)}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <StatusMarker
                        label={opp.category.replace(/_/g, ' ')}
                        tone="blue"
                      />
                    </td>

                    <td className="py-3 px-4 font-medium text-neutral-800 dark:text-neutral-200">
                      {opp.supplierName}
                    </td>

                    <td className="py-3 px-4 text-right rtl:text-left font-mono tabular-nums font-bold text-neutral-900 dark:text-neutral-100">
                      {formatCurrency(opp.recoverableAmount, opp.currency)}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span className="font-mono tabular-nums font-semibold text-emerald-600">
                        {opp.confidence}%
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <StatusMarker
                        label={opp.status}
                        tone={opp.status === 'VERIFIED' ? 'emerald' : 'amber'}
                      />
                    </td>

                    <td className="py-3 px-4 text-right rtl:text-left">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedOpp(opp)}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>{t.actionReview}</span>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Evidence Drawer / Modal: "Why did the AI think this money is recoverable?" */}
      {selectedOpp && (
        <Modal
          isOpen={!!selectedOpp}
          onClose={() => setSelectedOpp(null)}
          title={selectedOpp.title}
          subtitle={`Opportunity #${selectedOpp.id} · ${selectedOpp.supplierName}`}
          maxWidth="2xl"
        >
          <div className="space-y-6">
            {/* Why AI Thought Recoverable Banner */}
            <div className="p-4 rounded-xl bg-neutral-900 text-neutral-100">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 mb-1">
                <ShieldCheck className="w-4 h-4" />
                <span>{t.whyAiThoughtRecoverable}</span>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                RecoverOS executed deterministic 3-way reconciliation against certified ledger files.
                All calculations below are verified by pure code without relying on LLM estimation.
              </p>
            </div>

            {/* Financial Ledger Comparison */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-neutral-50 dark:bg-neutral-800/60 rounded-xl border border-neutral-200 dark:border-neutral-700 text-center">
              <div>
                <div className="text-[11px] text-neutral-500 mb-1">{t.expectedAmountLabel}</div>
                <div className="text-base font-bold text-neutral-900 dark:text-neutral-100 font-mono tabular-nums">
                  {formatCurrency(selectedOpp.expectedAmount, selectedOpp.currency)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-neutral-500 mb-1">{t.actualAmountLabel}</div>
                <div className="text-base font-bold text-rose-600 font-mono tabular-nums">
                  {formatCurrency(selectedOpp.actualAmount, selectedOpp.currency)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-emerald-600 font-semibold mb-1">{t.recoverableAmountLabel}</div>
                <div className="text-base font-bold text-emerald-600 font-mono tabular-nums">
                  {formatCurrency(selectedOpp.recoverableAmount, selectedOpp.currency)}
                </div>
              </div>
            </div>

            {/* Deterministic Mathematical Formula */}
            <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-xs font-mono text-neutral-800 dark:text-neutral-200">
              <div className="flex items-center gap-1.5 text-neutral-500 text-[11px] mb-1">
                <Calculator className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t.calculationFormula}</span>
              </div>
              <div>{selectedOpp.calculation.formula}</div>
              <div className="text-[11px] text-emerald-600 mt-1">
                &bull; {t.codeVerifiedBadge}
              </div>
            </div>

            {/* Evidence Chain of Custody */}
            <div>
              <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 mb-2 uppercase tracking-wider">
                Verifiable Chain of Evidence ({selectedOpp.evidenceList.length} items)
              </h4>
              <div className="space-y-2">
                {selectedOpp.evidenceList.map((ev, idx) => (
                  <div
                    key={ev.id}
                    className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {idx + 1}. {ev.documentTitle}
                      </span>
                      <span className="text-[11px] font-mono text-neutral-500">
                        Ref: {ev.referenceNumber} &bull; {ev.confidence}% fidelity
                      </span>
                    </div>
                    <p className="text-neutral-600 dark:text-neutral-300 italic text-[11px] mt-1 bg-neutral-50 dark:bg-neutral-800/40 p-2 rounded">
                      "{ev.relevantExcerpt}"
                    </p>
                    {ev.specificClause && (
                      <div className="text-[10px] text-emerald-600 mt-1 font-medium">
                        Governing Clause: {ev.specificClause}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setDossierOpp(selectedOpp)}
                className="gap-1.5"
              >
                <FileCheck className="w-4 h-4 text-blue-500" />
                <span>{isRtl ? 'تصدير ملف التدقيق' : 'Export Audit Dossier'}</span>
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setSelectedOpp(null)}
                >
                  {t.actionClose}
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  disabled={isClaiming || selectedOpp.status === 'CLAIM_SUBMITTED' || selectedOpp.status === 'RECOVERED'}
                  onClick={() => handleStartClaim(selectedOpp)}
                >
                  <FileCheck2 className="w-4 h-4" />
                  <span>
                    {selectedOpp.status === 'CLAIM_SUBMITTED'
                      ? 'Claim Already Initiated'
                      : t.actionSubmitClaim}
                  </span>
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Certified Legal Audit Dossier */}
      <AuditDossierModal
        isOpen={!!dossierOpp}
        onClose={() => setDossierOpp(null)}
        opportunity={dossierOpp}
      />
    </div>
  );
};
