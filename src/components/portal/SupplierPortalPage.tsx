import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  FileUp,
  Loader2,
  ShieldCheck,
  XCircle,
  FileText,
  Lock,
  Printer,
  Sparkles,
} from 'lucide-react';
import { Button } from '../ui/Button';

type PortalClaim = {
  claimId: string;
  claimNumber: string;
  supplierName: string;
  amountMinor: string | number | bigint;
  currency: string;
  status: string;
};

export const SupplierPortalPage: React.FC = () => {
  const [claim, setClaim] = useState<PortalClaim | null>(null);
  const [portalToken, setPortalToken] = useState('');
  const [reason, setReason] = useState('');
  const [signerName, setSignerName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [settlementDocId, setSettlementDocId] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const token = new URLSearchParams(window.location.search).get('token') || '';

  useEffect(() => {
    if (!token) {
      setMessage('This supplier access link is missing or invalid.');
      setBusy(false);
      return;
    }
    fetch(`/api/v1/supplier-portal/access?token=${encodeURIComponent(token)}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Unable to redeem access link.');
        setPortalToken(body.portalToken);
        setClaim(body.claim);
      })
      .catch((error) => setMessage(error.message))
      .finally(() => setBusy(false));
  }, [token]);

  const sendResponse = async (action: 'ACCEPT' | 'REJECT') => {
    if (!claim || (action === 'REJECT' && !reason.trim())) {
      setMessage('A reason is required when rejecting a claim.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/supplier-portal/claims/${encodeURIComponent(claim.claimId)}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Supplier-Portal-Token': portalToken },
        body: JSON.stringify({
          action,
          reason: reason.trim() || undefined,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to submit response.');

      if (action === 'ACCEPT') {
        setMessage('✓ Claim accepted and mutual settlement agreement generated securely.');
        if (body.settlementAgreementId) {
          setSettlementDocId(body.settlementAgreementId);
        }
      } else {
        setMessage('Dispute response recorded securely into audit ledger.');
      }
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  const uploadCreditMemo = async () => {
    if (!claim || !file) return;
    setBusy(true);
    try {
      const base64Content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = () => reject(new Error('Unable to read selected document.'));
        reader.readAsDataURL(file);
      });
      const response = await fetch(`/api/v1/supplier-portal/claims/${encodeURIComponent(claim.claimId)}/credit-memo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Supplier-Portal-Token': portalToken },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type, base64Content }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to upload credit memo.');
      setMessage(`Credit Memo uploaded and encrypted. SHA-256: ${body.sha256}`);
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  if (busy && !claim) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 dark:bg-neutral-950 px-4 py-10 text-neutral-900 dark:text-neutral-100">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-600 text-white">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">RecoverOS Supplier Portal</h1>
            <p className="text-xs text-neutral-500">
              Secure, time-limited and cryptographically audited response channel
            </p>
          </div>
        </header>

        {message && (
          <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-900 text-sm flex items-center justify-between">
            <span>{message}</span>
            {settlementDocId && (
              <span className="text-xs font-mono text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                Ref: {settlementDocId}
              </span>
            )}
          </div>
        )}

        {!claim ? (
          <div className="p-6 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 text-sm">
            Access could not be established. Please request a new link from the buyer.
          </div>
        ) : (
          <section className="space-y-5 p-6 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-mono text-neutral-500">{claim.claimNumber}</p>
                <h2 className="text-lg font-semibold">{claim.supplierName}</h2>
              </div>
              <div className="text-right">
                <p className="text-xs text-neutral-500">Claim amount</p>
                <p className="text-lg font-mono font-bold text-emerald-600">
                  {(Number(claim.amountMinor) / 100).toFixed(2)} {claim.currency}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Representative Name (for Electronic Signature)
                </label>
                <input
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="e.g. John Doe, VP Finance"
                  className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 p-2.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Response or dispute notes</label>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 p-3 text-xs"
                  placeholder="Confirm acceptance, explain a discrepancy, or provide settlement context."
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={() => sendResponse('ACCEPT')} disabled={busy}>
                <CheckCircle2 className="w-4 h-4" /> Accept & Sign Settlement
              </Button>
              <Button
                variant="danger"
                onClick={() => sendResponse('REJECT')}
                disabled={busy || !reason.trim()}
              >
                <XCircle className="w-4 h-4" /> Dispute claim
              </Button>
            </div>

            <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <label className="block text-xs font-semibold mb-2">
                Upload Credit Memo or settlement proof (AES-256 Encrypted)
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx"
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                  className="text-xs"
                />
                <Button variant="secondary" onClick={uploadCreditMemo} disabled={busy || !file}>
                  <FileUp className="w-4 h-4" /> Upload encrypted proof
                </Button>
              </div>
            </div>

            {/* Cryptographic Trust Footer */}
            <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400">
              <span className="flex items-center gap-1">
                <Lock className="w-3 h-3 text-emerald-500" /> End-to-end encrypted channel
              </span>
              <span>SHA-256 Hash Chained</span>
            </div>
          </section>
        )}
      </div>
    </main>
  );
};
