import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { useTenant } from '../../store/TenantContext';
import { Claim, ClaimStatus } from '../../types';
import { StatusMarker } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import {
  FileCheck2,
  Send,
  CheckCircle,
  AlertTriangle,
  Clock,
  DollarSign,
  MessageSquare,
} from 'lucide-react';
import { RbacGuard } from '../../security/rbac';
import { AuditDossierModal } from './AuditDossierModal';
import { VendorDisputePortalModal } from './VendorDisputePortalModal';
import { SupplierMagicLinkModal } from './SupplierMagicLinkModal';
import { SettlementAgreementModal } from './SettlementAgreementModal';
import { Handshake, FileCheck, Link2, FileText } from 'lucide-react';

export const ClaimsView: React.FC = () => {
  const { t, formatCurrency, formatDate, isRtl } = useI18n();
  const { state, approveClaim, submitClaim, resolveRecovery } = useTenant();

  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [dossierClaim, setDossierClaim] = useState<Claim | null>(null);
  const [disputeClaim, setDisputeClaim] = useState<Claim | null>(null);
  const [magicLinkClaim, setMagicLinkClaim] = useState<Claim | null>(null);
  const [settlementClaim, setSettlementClaim] = useState<Claim | null>(null);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [settleRef, setSettleRef] = useState('');
  const [settleDoc, setSettleDoc] = useState('');
  const [settleType, setSettleType] = useState<'CREDIT_MEMO' | 'BANK_TRANSFER' | 'INVOICE_OFFSET' | 'CHECK'>('CREDIT_MEMO');

  const canApprove = RbacGuard.hasPermission(state.currentUser.role, 'APPROVE_CLAIMS');
  const canSubmit = RbacGuard.hasPermission(state.currentUser.role, 'SUBMIT_CLAIMS');

  const handleOpenSettle = (claim: Claim) => {
    setSelectedClaim(claim);
    setSettleAmount(claim.amount);
    setSettleRef(`CM-${claim.supplierName.split(' ')[0]}-${Date.now().toString().slice(-4)}`);
    setSettleDoc(`Settlement_Voucher_${claim.claimNumber}.pdf`);
    setIsSettleModalOpen(true);
  };

  const handleConfirmSettle = () => {
    if (!selectedClaim || !settleRef || settleAmount <= 0) return;
    resolveRecovery({
      claimId: selectedClaim.id,
      amount: settleAmount,
      settlementType: settleType,
      referenceNumber: settleRef,
      proofDocumentName: settleDoc,
    });
    setIsSettleModalOpen(false);
    setSelectedClaim(null);
  };

  const getStatusTone = (status: ClaimStatus) => {
    switch (status) {
      case 'RECOVERED':
        return 'emerald';
      case 'SUBMITTED':
      case 'ACKNOWLEDGED':
      case 'NEGOTIATING':
        return 'blue';
      case 'APPROVAL_REQUIRED':
        return 'amber';
      case 'REJECTED':
      case 'DISPUTED':
        return 'rose';
      default:
        return 'slate';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {t.appClaims}
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {isRtl
              ? 'متابعة مسار المطالبات المالية من الصياغة حتى التحصيل والتسوية المعتمدة'
              : 'End-to-end claim lifecycle from drafting, human managerial approvals, vendor transmission, to verified settlement'}
          </p>
        </div>
      </div>

      {/* Claims List Table */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left rtl:text-right border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-800/40 text-neutral-500 font-semibold">
                <th className="py-3 px-4">{isRtl ? 'رقم المطالبة' : 'Claim Number'}</th>
                <th className="py-3 px-4">{isRtl ? 'المورد' : 'Supplier'}</th>
                <th className="py-3 px-4 text-right rtl:text-left">{isRtl ? 'مبلغ المطالبة' : 'Claim Amount'}</th>
                <th className="py-3 px-4 text-center">{isRtl ? 'الحالة' : 'Status'}</th>
                <th className="py-3 px-4 text-center">{isRtl ? 'سياسة الاعتماد' : 'Approval Policy'}</th>
                <th className="py-3 px-4">{isRtl ? 'تاريخ الإنشاء' : 'Created Date'}</th>
                <th className="py-3 px-4 text-right rtl:text-left">{isRtl ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {state.claims.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-neutral-500">
                    {isRtl
                      ? 'لا توجد مطالبات نشطة حالياً. يمكنك إنشاء مطالبة جديدة من تبويب الفرص.'
                      : 'No active recovery claims. Start one from the Opportunities tab.'}
                  </td>
                </tr>
              ) : (
                state.claims.map((claim) => (
                  <tr
                    key={claim.id}
                    className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/50 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                      {claim.claimNumber}
                    </td>

                    <td className="py-3 px-4 font-medium text-neutral-800 dark:text-neutral-200">
                      {claim.supplierName}
                    </td>

                    <td className="py-3 px-4 text-right rtl:text-left font-mono tabular-nums font-bold text-neutral-900 dark:text-neutral-100">
                      {formatCurrency(claim.amount, claim.currency)}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <StatusMarker
                        label={claim.status.replace(/_/g, ' ')}
                        tone={getStatusTone(claim.status)}
                      />
                    </td>

                    <td className="py-3 px-4 text-center">
                      {claim.approvalRequired ? (
                        claim.approvedBy ? (
                          <span className="text-[11px] text-emerald-600 font-medium">
                            {isRtl ? `معتمد من ${claim.approvedBy}` : `Approved by ${claim.approvedBy}`}
                          </span>
                        ) : (
                          <span className="text-[11px] text-amber-600 font-medium flex items-center justify-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {isRtl ? 'يتطلب توقيع المدير' : 'Manager Sign-off Needed'}
                          </span>
                        )
                      ) : (
                        <span className="text-[11px] text-neutral-400">
                          {isRtl
                            ? `مستقل (<$${state.currentTenant.settings.autonomousThresholdUsd})`
                            : `Autonomous (<$${state.currentTenant.settings.autonomousThresholdUsd})`}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-neutral-500 text-[11px]">
                      {formatDate(claim.createdAt)}
                    </td>

                    <td className="py-3 px-4 text-right rtl:text-left">
                      <div className="flex items-center justify-end gap-1.5">
                        {claim.status === 'APPROVAL_REQUIRED' && (
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={!canApprove}
                            onClick={() => approveClaim(claim.id)}
                            title={!canApprove ? 'Requires Finance Manager or Admin role' : undefined}
                          >
                            <CheckCircle className="w-3 h-3" />
                            <span>{t.actionApprove}</span>
                          </Button>
                        )}

                        {claim.status === 'APPROVED' && (
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={!canSubmit}
                            onClick={() => submitClaim(claim.id)}
                          >
                            <Send className="w-3 h-3" />
                            <span>{isRtl ? 'إرسال للمورد' : 'Dispatch'}</span>
                          </Button>
                        )}

                        {(claim.status === 'SUBMITTED' || claim.status === 'ACKNOWLEDGED' || claim.status === 'NEGOTIATING') && (
                          <>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setDisputeClaim(claim)}
                              title={isRtl ? 'بوابة تفاوض المورد' : 'Vendor Dispute Hub'}
                            >
                              <Handshake className="w-3 h-3 text-amber-500" />
                              <span>{isRtl ? 'تفاوض المورد' : 'Dispute Hub'}</span>
                            </Button>

                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setMagicLinkClaim(claim)}
                              title={isRtl ? 'إصدار رابط سري للمورد' : 'Issue Supplier Magic Link'}
                            >
                              <Link2 className="w-3 h-3 text-sky-500" />
                              <span>{isRtl ? 'رابط المورد' : 'Magic Link'}</span>
                            </Button>

                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleOpenSettle(claim)}
                            >
                              <DollarSign className="w-3 h-3 text-emerald-600" />
                              <span>Record Settlement</span>
                            </Button>
                          </>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSettlementClaim(claim)}
                          title={isRtl ? 'عرض اتفاقية التسوية الرسمية' : 'View Settlement Agreement'}
                        >
                          <FileText className="w-3 h-3 text-emerald-600" />
                          <span>{isRtl ? 'الاتفاقية' : 'Agreement'}</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDossierClaim(claim)}
                          title={isRtl ? 'تصدير ملف التدقيق القانوني' : 'Export Audit Dossier'}
                        >
                          <FileCheck className="w-3 h-3 text-blue-500" />
                          <span>{isRtl ? 'ملف التدقيق' : 'Dossier'}</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedClaim(claim)}
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>View Log</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Claim Detail & Negotiation History Modal */}
      {selectedClaim && !isSettleModalOpen && (
        <Modal
          isOpen={!!selectedClaim}
          onClose={() => setSelectedClaim(null)}
          title={`Claim #${selectedClaim.claimNumber} - ${selectedClaim.supplierName}`}
          subtitle={`Amount: ${formatCurrency(selectedClaim.amount, selectedClaim.currency)}`}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            {selectedClaim.draftSubject && (
              <div className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg text-xs">
                <div className="font-semibold text-neutral-500 mb-1">Notice Subject:</div>
                <div className="font-mono text-neutral-900 dark:text-neutral-100">{selectedClaim.draftSubject}</div>
              </div>
            )}

            {selectedClaim.draftBody && (
              <div className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg text-xs">
                <div className="font-semibold text-neutral-500 mb-1">Notice Body:</div>
                <pre className="font-sans whitespace-pre-wrap text-neutral-700 dark:text-neutral-300 leading-relaxed max-h-48 overflow-y-auto">
                  {selectedClaim.draftBody}
                </pre>
              </div>
            )}

            <div>
              <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 mb-2 uppercase tracking-wider">
                Vendor Communications & Negotiation Trail
              </h4>
              <div className="space-y-2">
                {selectedClaim.negotiationLog.length === 0 ? (
                  <div className="text-neutral-500 text-xs py-4 text-center">
                    No communication messages exchanged yet.
                  </div>
                ) : (
                  selectedClaim.negotiationLog.map((msg, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg text-xs ${
                        msg.sender === 'RECOVEROS_AGENT'
                          ? 'bg-neutral-100 dark:bg-neutral-800/80 text-neutral-900 dark:text-neutral-100'
                          : 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
                        <span>{msg.sender === 'RECOVEROS_AGENT' ? 'RecoverOS Autonomous Agent' : 'Vendor Representative'}</span>
                        <span className="font-normal opacity-70">{formatDate(msg.timestamp)}</span>
                      </div>
                      <p>{msg.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-neutral-200 dark:border-neutral-800">
              <Button variant="outline" size="md" onClick={() => setSelectedClaim(null)}>
                {t.actionClose}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Record Verified Settlement Modal */}
      {isSettleModalOpen && selectedClaim && (
        <Modal
          isOpen={isSettleModalOpen}
          onClose={() => setIsSettleModalOpen(false)}
          title="Verify & Record Settled Recovery"
          subtitle={`Supplier: ${selectedClaim.supplierName} · Claim #${selectedClaim.claimNumber}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-900 dark:text-emerald-200">
              <strong>Strict Recovery Rule:</strong> Only record as verified recovery if funds are deposited into your corporate treasury or a legally binding Credit Memo is issued.
            </div>

            <div>
              <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Settled Amount ({selectedClaim.currency})
              </label>
              <input
                type="number"
                step="0.01"
                value={settleAmount}
                onChange={(e) => setSettleAmount(parseFloat(e.target.value) || 0)}
                className="w-full py-2 px-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg font-mono text-neutral-900 dark:text-neutral-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Settlement Mechanism
              </label>
              <select
                value={settleType}
                onChange={(e) => setSettleType(e.target.value as any)}
                className="w-full py-2 px-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100"
              >
                <option value="CREDIT_MEMO">Credit Memo (Offset against future invoice)</option>
                <option value="BANK_TRANSFER">Direct ACH / Wire Transfer into Treasury</option>
                <option value="INVOICE_OFFSET">Direct AP Open Balance Deduction</option>
                <option value="CHECK">Certified Bank Check</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Credit Memo or Bank Transaction Reference #
              </label>
              <input
                type="text"
                value={settleRef}
                onChange={(e) => setSettleRef(e.target.value)}
                placeholder="E.g. CM-994821 or JPM-TRX-28491"
                className="w-full py-2 px-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg font-mono text-neutral-900 dark:text-neutral-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Proof Document Name
              </label>
              <input
                type="text"
                value={settleDoc}
                onChange={(e) => setSettleDoc(e.target.value)}
                className="w-full py-2 px-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
              <Button variant="outline" size="md" onClick={() => setIsSettleModalOpen(false)}>
                {t.actionCancel}
              </Button>
              <Button variant="primary" size="md" onClick={handleConfirmSettle}>
                <CheckCircle className="w-4 h-4" />
                <span>Verify & Record Recovery</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Certified Legal Audit Dossier Modal */}
      <AuditDossierModal
        isOpen={!!dossierClaim}
        onClose={() => setDossierClaim(null)}
        claim={dossierClaim}
      />

      {/* Vendor Dispute & Settlement Portal */}
      <VendorDisputePortalModal
        isOpen={!!disputeClaim}
        onClose={() => setDisputeClaim(null)}
        claim={disputeClaim}
        onResolveSettlement={(c) => {
          handleOpenSettle(c);
        }}
      />

      {/* Supplier Magic Link Generator Modal */}
      <SupplierMagicLinkModal
        isOpen={!!magicLinkClaim}
        onClose={() => setMagicLinkClaim(null)}
        claim={magicLinkClaim}
      />

      {/* Official Mutual Settlement Agreement Modal */}
      <SettlementAgreementModal
        isOpen={!!settlementClaim}
        onClose={() => setSettlementClaim(null)}
        claim={settlementClaim}
      />
    </div>
  );
};
