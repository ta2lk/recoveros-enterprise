import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { Claim, ClaimStatus } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { StatusMarker } from '../ui/Badge';
import {
  MessageSquare,
  Send,
  Building,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  DollarSign,
  ShieldCheck,
  CheckCheck,
} from 'lucide-react';

interface VendorDisputePortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  claim: Claim | null;
  onResolveSettlement: (claim: Claim) => void;
}

interface MessageItem {
  id: string;
  sender: 'BUYER' | 'VENDOR' | 'SYSTEM';
  name: string;
  text: string;
  timestamp: string;
}

export const VendorDisputePortalModal: React.FC<VendorDisputePortalModalProps> = ({
  isOpen,
  onClose,
  claim,
  onResolveSettlement,
}) => {
  const { formatCurrency, formatDate, isRtl } = useI18n();
  const [inputText, setInputText] = useState('');
  const [activeStep, setActiveStep] = useState<number>(3); // 1 to 5
  const [messages, setMessages] = useState<MessageItem[]>(() => [
    {
      id: 'm1',
      sender: 'SYSTEM',
      name: 'RecoverOS Protocol Node',
      text: 'Formal Audit Discrepancy Notice dispatched via automated secure EDI/API channel.',
      timestamp: '2 days ago',
    },
    {
      id: 'm2',
      sender: 'BUYER',
      name: 'AP Recovery Desk (RecoverOS)',
      text: `Notice of Claim ${claim?.claimNumber || 'CLM-101'}: A mathematical audit detected an unearned balance of $${claim?.amount.toFixed(2) || '0.00'}. Attached is the 3-Way Match dossier and PO confirmation.`,
      timestamp: '2 days ago',
    },
    {
      id: 'm3',
      sender: 'VENDOR',
      name: `${claim?.supplierName || 'Vendor'} Accounts Receivable`,
      text: `We acknowledge receipt of the variance notification. Our billing team is reviewing invoice records and PO tolerances.`,
      timestamp: 'Yesterday at 3:15 PM',
    },
    {
      id: 'm4',
      sender: 'VENDOR',
      name: `${claim?.supplierName || 'Vendor'} Billing Manager`,
      text: `After reviewing the contractual 2/10 discount terms, we verify the early payment was completed within window. We are prepared to grant a Credit Memo for the full amount.`,
      timestamp: 'Today at 09:42 AM',
    },
  ]);

  if (!isOpen || !claim) return null;

  const steps = [
    { step: 1, label: isRtl ? 'إشعار النزاع' : 'Dispatched' },
    { step: 2, label: isRtl ? 'إقرار الاستلام' : 'Acknowledged' },
    { step: 3, label: isRtl ? 'مراجعة الأدلة' : 'Evidence Review' },
    { step: 4, label: isRtl ? 'الموافقة على الخصم' : 'Agreed Offset' },
    { step: 5, label: isRtl ? 'تمت التسوية' : 'Settled' },
  ];

  const handleSendMessage = () => {
    if (!inputText.trim()) return;
    const newMsg: MessageItem = {
      id: `msg-${Date.now()}`,
      sender: 'BUYER',
      name: 'AP Controller (You)',
      text: inputText.trim(),
      timestamp: 'Just now',
    };
    setMessages((prev) => [...prev, newMsg]);
    setInputText('');

    // Simulate instant vendor acknowledgment
    setTimeout(() => {
      const vendorAck: MessageItem = {
        id: `msg-${Date.now() + 1}`,
        sender: 'VENDOR',
        name: `${claim.supplierName} AR Desk`,
        text: 'Confirmation noted and logged in our enterprise ledger. Ready to issue official credit memo.',
        timestamp: 'Just now',
      };
      setMessages((prev) => [...prev, vendorAck]);
      setActiveStep(4);
    }, 1000);
  };

  const handleQuickResponse = (preset: string) => {
    setInputText(preset);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isRtl ? 'بوابة تفاوض وحل نزاعات الموردين' : 'Vendor Dispute & Settlement Portal'}
      maxWidth="3xl"
    >
      <div className="space-y-6">
        {/* Top Summary Banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-neutral-500 uppercase">
                {claim.claimNumber}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                {claim.supplierName}
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              {isRtl ? 'قناة اتصال مشفرة ومسجلة في دفاتر التدقيق' : 'Cryptographically logged dispute channel with full audit trail'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right rtl:text-left">
              <div className="text-[11px] text-neutral-500">{isRtl ? 'قيمة الاسترداد المتنازع عليها' : 'Claim Amount'}</div>
              <div className="text-lg font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(claim.amount)}
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                onClose();
                onResolveSettlement(claim);
              }}
              className="gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isRtl ? 'تسوية وقبول الإشعار الدائن' : 'Accept Settlement & Log Cash'}</span>
            </Button>
          </div>
        </div>

        {/* Dispute Resolution Stage Progress Bar */}
        <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
          <div className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-3">
            {isRtl ? 'مراحل تسوية النزاع المالي:' : 'Dispute Resolution Progress:'}
          </div>
          <div className="grid grid-cols-5 gap-2">
            {steps.map((s) => {
              const isPastOrCurrent = activeStep >= s.step;
              const isCurrent = activeStep === s.step;
              return (
                <div key={s.step} className="flex flex-col items-center text-center space-y-1.5">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isPastOrCurrent
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'
                    } ${isCurrent ? 'ring-2 ring-emerald-400 ring-offset-2 dark:ring-offset-neutral-900' : ''}`}
                  >
                    {isPastOrCurrent ? <CheckCheck className="w-3.5 h-3.5" /> : s.step}
                  </div>
                  <span
                    className={`text-[11px] font-medium leading-tight ${
                      isPastOrCurrent ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-400'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Messaging History Container */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden flex flex-col h-72">
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
            {messages.map((m) => {
              if (m.sender === 'SYSTEM') {
                return (
                  <div key={m.id} className="flex items-center justify-center">
                    <span className="px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 font-mono text-[10px]">
                      {m.text}
                    </span>
                  </div>
                );
              }

              const isBuyer = m.sender === 'BUYER';
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isBuyer ? 'items-end text-right' : 'items-start text-left'}`}
                >
                  <div className="flex items-center gap-2 mb-1 text-[11px] text-neutral-500">
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                      {m.name}
                    </span>
                    <span className="text-[10px]">{m.timestamp}</span>
                  </div>
                  <div
                    className={`max-w-[80%] rounded-xl p-3 leading-relaxed ${
                      isBuyer
                        ? 'bg-emerald-600 text-white rounded-br-xs'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-bl-xs'
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick presets */}
          <div className="px-4 py-2 bg-neutral-50 dark:bg-neutral-800/40 border-t border-neutral-200 dark:border-neutral-800 flex items-center gap-2 overflow-x-auto text-[11px]">
            <span className="text-neutral-400 shrink-0">{isRtl ? 'ردود سريعة:' : 'Quick Presets:'}</span>
            <button
              onClick={() => handleQuickResponse(
                isRtl
                  ? 'يرجى إجراء مقاصة بقيمة هذا الإشعار الدائن على الفاتورة القادمة مباشرة.'
                  : 'Please apply this credit memo directly to invoice #INV-OCT-01.'
              )}
              className="px-2.5 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 text-neutral-700 dark:text-neutral-300 shrink-0 cursor-pointer"
            >
              {isRtl ? 'مقاصة على الفاتورة القادمة' : 'Apply to Next Invoice'}
            </button>
            <button
              onClick={() => handleQuickResponse(
                isRtl
                  ? 'البند التعاقدي 4.2 يؤكد استحقاق خصم 2/10. يرجى تزويدنا بسند إشعار دائن رسمي.'
                  : 'Contract clause 4.2 confirms 2/10 discount validity. Please issue formal Credit Memo voucher.'
              )}
              className="px-2.5 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 text-neutral-700 dark:text-neutral-300 shrink-0 cursor-pointer"
            >
              {isRtl ? 'الاستشهاد بالبند التعاقدي' : 'Quote Clause 4.2'}
            </button>
            <button
              onClick={() => handleQuickResponse(
                isRtl
                  ? 'تم الاتفاق. نؤكد استلام إشعار الدائن وسيتم تسجيل التسوية وإغلاق ملف التدقيق.'
                  : 'Agreed. We confirm receipt of Credit Memo reference and will close the audit inquiry.'
              )}
              className="px-2.5 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 text-neutral-700 dark:text-neutral-300 shrink-0 cursor-pointer"
            >
              {isRtl ? 'تأكيد التسوية وإغلاق الملف' : 'Confirm Settlement'}
            </button>
          </div>

          {/* Message Input Box */}
          <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={isRtl ? 'اكتب رداً أو توضيحاً لمسؤول حسابات المورد...' : 'Write a response or counter-offer to vendor...'}
              className="flex-1 bg-neutral-100 dark:bg-neutral-800 border-none rounded-lg px-3 py-2 text-xs text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <Button variant="primary" size="sm" onClick={handleSendMessage} disabled={!inputText.trim()}>
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
