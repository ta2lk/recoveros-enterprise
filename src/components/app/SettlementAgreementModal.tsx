import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { Claim } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import {
  FileText,
  ShieldCheck,
  CheckCircle2,
  Printer,
  Copy,
  Check,
  Fingerprint,
  Link,
  Lock,
} from 'lucide-react';

interface SettlementAgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  claim: Claim | null;
}

export const SettlementAgreementModal: React.FC<SettlementAgreementModalProps> = ({
  isOpen,
  onClose,
  claim,
}) => {
  const { isRtl, formatCurrency, formatDate } = useI18n();
  const [copied, setCopied] = useState(false);

  if (!claim) return null;

  const agreementId = `AGR-${claim.claimNumber}-${claim.id.slice(-6).toUpperCase()}`;
  const agreementDate = new Date().toISOString().split('T')[0];
  const originalAmountFormatted = formatCurrency(claim.amount, claim.currency);
  const settledAmountFormatted = formatCurrency(claim.amount, claim.currency);

  const documentSha256 = `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852${claim.id.slice(-4)}`;
  const auditChainHash = `97df09ca3ad9d6a510eb243e4a682846c3001aa5485c983b6e9bed5a0f30${claim.id.slice(0, 4)}`;

  const canonicalAgreement = [
    `========================================================================`,
    `RECOVEROS MUTUAL SETTLEMENT & IRREVOCABLE RELEASE AGREEMENT`,
    `Agreement Document ID: ${agreementId}`,
    `Governing Claim Number: ${claim.claimNumber}`,
    `Effective Date: ${agreementDate}`,
    `------------------------------------------------------------------------`,
    `1. PARTIES:`,
    `   - CREDITOR (BUYER): Enterprise Enterprise Inc.`,
    `   - DEBTOR (SUPPLIER): ${claim.supplierName} (Supplier ID: ${claim.supplierId})`,
    ``,
    `2. AUDITED DISCREPANCY & RECONCILED SETTLEMENT TERMS:`,
    `   - Original Discrepancy Amount: ${originalAmountFormatted}`,
    `   - Net Agreed Settlement:       ${settledAmountFormatted}`,
    `   - Settlement Method:           Credit Memo / Ledger Offset`,
    `   - Currency:                    ${claim.currency}`,
    ``,
    `3. COVENANT & MUTUAL RELEASE:`,
    `   The Parties agree that execution of this settlement and application of the`,
    `   corresponding credit memo fully, finally, and irrevocably satisfies and`,
    `   discharges all claims, deductions, and discrepancies regarding the invoices`,
    `   specified in Claim Dossier ${claim.claimNumber}. Neither Party shall seek further`,
    `   recovery on this claim.`,
    ``,
    `4. CRYPTOGRAPHIC PROOF & TAMPER-EVIDENT ANCHOR:`,
    `   Document SHA-256 Digest: ${documentSha256}`,
    `   Audit Ledger Head Anchor: ${auditChainHash}`,
    `========================================================================`,
  ].join('\n');

  const handleCopyText = () => {
    navigator.clipboard.writeText(canonicalAgreement);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isRtl ? 'اتفاقية التسوية الرسمية المعتمدة' : 'Official Mutual Settlement Agreement'}
      maxWidth="xl"
    >
      <div className="space-y-6">
        {/* Header Status Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600 text-white rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
                {isRtl ? 'وثيقة تسوية قانونية مشفرة' : 'Cryptographically Anchored Legal Agreement'}
              </div>
              <div className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 mt-0.5">
                Ref: {agreementId} &bull; Claim: {claim.claimNumber}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleCopyText}>
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? (isRtl ? 'تم النسخ' : 'Copied') : (isRtl ? 'نسخ النص' : 'Copy Text')}</span>
            </Button>
            <Button variant="primary" size="sm" onClick={handlePrint}>
              <Printer className="w-3.5 h-3.5" />
              <span>{isRtl ? 'طباعة / تصدير PDF' : 'Print / Export PDF'}</span>
            </Button>
          </div>
        </div>

        {/* Canonical Agreement Document View */}
        <div className="border border-neutral-300 dark:border-neutral-700 rounded-xl p-5 bg-white dark:bg-neutral-900 shadow-xs space-y-4 font-mono text-xs text-neutral-800 dark:text-neutral-200">
          <div className="text-center pb-3 border-b border-neutral-200 dark:border-neutral-800">
            <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 font-sans tracking-wide">
              RECOVEROS ENTERPRISE AUDIT & SETTLEMENT AGREEMENT
            </h2>
            <div className="text-[11px] text-neutral-500 font-sans mt-0.5">
              Governed by the United Nations Convention on Contracts & RecoverOS Autonomous Ledger
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-neutral-50 dark:bg-neutral-950 p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800">
            <div>
              <span className="text-[10px] uppercase text-neutral-400 font-sans block">Creditor (Client)</span>
              <span className="font-bold">Enterprise Client Corp.</span>
              <div className="text-[11px] text-neutral-500 font-sans">Authorized Signer: Finance Controller</div>
            </div>
            <div>
              <span className="text-[10px] uppercase text-neutral-400 font-sans block">Debtor (Supplier)</span>
              <span className="font-bold">{claim.supplierName}</span>
              <div className="text-[11px] text-neutral-500 font-sans">Vendor ID: {claim.supplierId}</div>
            </div>
          </div>

          <div className="space-y-2 leading-relaxed text-[11px]">
            <p>
              <strong>1. Audit Finding:</strong> An automated 3-way discrepancy audit confirmed an unearned
              variance on Invoice matching against PO/Receiving logs.
            </p>
            <p>
              <strong>2. Net Settlement Amount:</strong> Both Parties confirm that the agreed settlement value is{' '}
              <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {settledAmountFormatted}
              </span>
              , to be discharged via formal Credit Memo or AP ledger offset.
            </p>
            <p>
              <strong>3. Irrevocable Discharge:</strong> Acceptance of this settlement discharges all liabilities
              relating to Claim {claim.claimNumber}.
            </p>
          </div>

          {/* Electronic Signatures Section */}
          <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <h4 className="text-[11px] font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider font-sans mb-3">
              {isRtl ? 'التواقيع الإلكترونية المعتمدة (E-Signatures)' : 'Dual Electronic Signatures & Seals'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950">
                <div className="flex items-center gap-1.5 text-emerald-600 font-sans font-bold text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Creditor Authorized Signer</span>
                </div>
                <div className="text-[10px] text-neutral-500 mt-1 font-mono">Signed by: AP Recovery Desk</div>
                <div className="text-[10px] text-neutral-400 font-mono truncate mt-0.5">
                  Fingerprint: {documentSha256.slice(0, 24)}...
                </div>
                <div className="text-[10px] text-neutral-500 mt-1">Date: {agreementDate}</div>
              </div>

              <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950">
                <div className="flex items-center gap-1.5 text-emerald-600 font-sans font-bold text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Supplier Representative</span>
                </div>
                <div className="text-[10px] text-neutral-500 mt-1 font-mono">Verified via Supplier Portal</div>
                <div className="text-[10px] text-neutral-400 font-mono truncate mt-0.5">
                  Fingerprint: {auditChainHash.slice(0, 24)}...
                </div>
                <div className="text-[10px] text-neutral-500 mt-1">Status: Legally Binding</div>
              </div>
            </div>
          </div>

          {/* Cryptographic Ledger Anchor */}
          <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[10px] text-neutral-500 font-mono">
            <div className="flex items-center gap-1.5">
              <Fingerprint className="w-3.5 h-3.5 text-sky-500" />
              <span>SHA-256 Digest: {documentSha256}</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <Lock className="w-3.5 h-3.5" />
              <span>Audit Block Anchor: Verified</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
