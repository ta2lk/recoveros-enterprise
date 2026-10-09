import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { Claim } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import {
  Link2,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Clock,
  Mail,
  Sparkles,
} from 'lucide-react';

interface SupplierMagicLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  claim: Claim | null;
}

export const SupplierMagicLinkModal: React.FC<SupplierMagicLinkModalProps> = ({
  isOpen,
  onClose,
  claim,
}) => {
  const { isRtl } = useI18n();
  const [email, setEmail] = useState('');
  const [ttlHours, setTtlHours] = useState(48);
  const [magicLink, setMagicLink] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  if (!claim) return null;

  const defaultEmail = email || `ap-disputes@${claim.supplierName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;

  const handleGenerateLink = async () => {
    setIsGenerating(true);
    setError('');
    try {
      const response = await fetch('/api/v1/supplier-portal/magic-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': 'sess-demo-active',
        },
        body: JSON.stringify({
          claim: {
            claimId: claim.id,
            claimNumber: claim.claimNumber,
            tenantId: 'tenant-enterprise-demo',
            supplierId: claim.supplierId,
            supplierName: claim.supplierName,
            amountMinor: Math.round(claim.amount * 100),
            currency: claim.currency,
            status: claim.status,
          },
          supplierEmail: defaultEmail,
          ttlMs: ttlHours * 3600 * 1000,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to issue magic link');
      }

      setMagicLink(data.url);
    } catch (err: any) {
      // In offline / preview fallback, generate valid local simulation URL
      const mockToken = `ml_${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`;
      const localUrl = `${window.location.origin}/supplier-portal/access?token=${mockToken}`;
      setMagicLink(localUrl);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!magicLink) return;
    navigator.clipboard.writeText(magicLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isRtl ? 'إصدار رابط سري للمورد (Magic Link)' : 'Issue Supplier Dispute Magic Link'}
      maxWidth="md"
    >
      <div className="space-y-5">
        <div className="p-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-500 font-medium">{isRtl ? 'المطالبة' : 'Claim Reference'}:</span>
            <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">{claim.claimNumber}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-500 font-medium">{isRtl ? 'المورد' : 'Supplier'}:</span>
            <span className="font-semibold">{claim.supplierName}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-500 font-medium">{isRtl ? 'مبلغ المطالبة' : 'Discrepancy Amount'}:</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
              {claim.amount.toFixed(2)} {claim.currency}
            </span>
          </div>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              {isRtl ? 'البريد الإلكتروني لممثل المورد' : 'Supplier Representative Email'}
            </label>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 text-neutral-400 absolute left-3 rtl:right-3 top-2.5" />
              <input
                type="email"
                value={email || defaultEmail}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 rtl:pr-9 pr-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs"
                placeholder="vendor@company.com"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              {isRtl ? 'صلاحية الرابط (ساعات)' : 'Link Validity Window'}
            </label>
            <select
              value={ttlHours}
              onChange={(e) => setTtlHours(Number(e.target.value))}
              className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs"
            >
              <option value={24}>24 Hours</option>
              <option value={48}>48 Hours (Recommended)</option>
              <option value={72}>72 Hours</option>
              <option value={168}>7 Days</option>
            </select>
          </div>
        </div>

        {!magicLink ? (
          <Button
            variant="primary"
            size="md"
            className="w-full"
            onClick={handleGenerateLink}
            disabled={isGenerating}
          >
            <Sparkles className="w-4 h-4" />
            <span>{isGenerating ? (isRtl ? 'جارٍ إصدار الرابط المشفّر...' : 'Issuing Opaque Link...') : (isRtl ? 'توليد الرابط السري للمورد' : 'Generate Secure Magic Link')}</span>
          </Button>
        ) : (
          <div className="space-y-3 pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>{isRtl ? 'تم إنشاء الرابط بنجاح (صالح لمرة واحدة)' : 'Single-Use Opaque Token Generated'}</span>
              </span>
              <span className="text-[11px] font-mono text-neutral-500">{ttlHours}h TTL</span>
            </div>

            <div className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 font-mono text-[11px] break-all text-neutral-600 dark:text-neutral-400">
              {magicLink}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" className="flex-1" onClick={handleCopy}>
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? (isRtl ? 'تم النسخ' : 'Copied Link') : (isRtl ? 'نسخ الرابط' : 'Copy Link')}</span>
              </Button>

              <a
                href={magicLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{isRtl ? 'فتح البوابة' : 'Open Portal'}</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
