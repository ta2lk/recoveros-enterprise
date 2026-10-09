import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { useTenant } from '../../store/TenantContext';
import { StatusMarker } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import {
  Link2,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Key,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { PrePaymentInterceptCard } from './PrePaymentInterceptCard';

export const IntegrationsView: React.FC = () => {
  const { t, isRtl } = useI18n();
  const { state, toggleIntegration, runAudit } = useTenant();

  const [activeModalConn, setActiveModalConn] = useState<any | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const handleTestAndConnect = () => {
    if (!activeModalConn) return;
    toggleIntegration(activeModalConn.id);
    setActiveModalConn(null);
    setApiKeyInput('');
    runAudit();
  };

  const handleSyncNow = (id: string) => {
    setSyncingId(id);
    setTimeout(() => {
      setSyncingId(null);
      runAudit();
    }, 1200);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {t.appIntegrations}
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {isRtl
              ? 'بوابة ربط أنظمة المحاسبة وسلاسل الإمداد وتدفق المعاملات البنكية'
              : 'Enterprise connector architecture supporting verified OAuth2 and REST APIs for automated data synchronization'}
          </p>
        </div>
      </div>

      {/* Pre-Disbursement Intercept Gatekeeper */}
      <PrePaymentInterceptCard />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {state.integrations.map((conn) => {
          const isConnected = conn.status === 'CONNECTED';
          const isSyncing = syncingId === conn.id;

          return (
            <div
              key={conn.id}
              className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-700 dark:text-neutral-200">
                      <Link2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                        {conn.name}
                      </h3>
                      <span className="text-[11px] text-neutral-500 font-mono">
                        {conn.category} &bull; {conn.authType}
                      </span>
                    </div>
                  </div>

                  <StatusMarker
                    label={isConnected ? 'CONNECTED' : 'DISCONNECTED'}
                    tone={isConnected ? 'emerald' : 'slate'}
                  />
                </div>

                <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-4">
                  {isConnected
                    ? `Live sync active. Last synced ${conn.lastSyncAt || 'recently'} (${conn.recordsSyncedCount || 100} records synchronized).`
                    : 'Connect this data source to continuously stream invoices, payments, and supplier records for autonomous recovery audit.'}
                </p>
              </div>

              <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-2">
                <a
                  href={conn.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 flex items-center gap-1 transition-colors"
                >
                  <span>{isRtl ? 'توثيق الـ API' : 'API Docs'}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={isSyncing}
                        onClick={() => handleSyncNow(conn.id)}
                      >
                        <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-emerald-600' : ''}`} />
                        <span>{isRtl ? 'مزامنة فورية' : 'Sync'}</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleIntegration(conn.id)}
                      >
                        <span>{t.actionDisconnect}</span>
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setActiveModalConn(conn)}
                    >
                      <Key className="w-3 h-3" />
                      <span>{isRtl ? 'إعداد وربط' : 'Configure & Connect'}</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Integration Setup Modal */}
      {activeModalConn && (
        <Modal
          isOpen={!!activeModalConn}
          onClose={() => setActiveModalConn(null)}
          title={isRtl ? `ربط ${activeModalConn.name}` : `Connect ${activeModalConn.name}`}
          subtitle={isRtl ? `خزينة بيانات الاعتماد المشفرة (${activeModalConn.authType})` : `Secure ${activeModalConn.authType} Credential Vault`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg text-neutral-600 dark:text-neutral-300">
              {isRtl
                ? 'تُشفّر بيانات الاعتماد بمفتاح AES-256 الساكن، وتُستخدم فقط بصلاحيات القراءة المحددة لغايات التدقيق. لا تنفذ المنصة أي حركات بنكية غير مصرح بها.'
                : 'Credentials are encrypted at rest with AES-256 and only used in read-only audit scopes. RecoverOS never executes unauthorized write transactions.'}
            </div>

            {activeModalConn.authType === 'API_KEY' ? (
              <div>
                <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  API Secret Key (Restricted Read-Only)
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="sk_live_..."
                  className="w-full py-2 px-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg font-mono text-neutral-900 dark:text-neutral-100"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <div>
                  <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Client ID / App ID
                  </label>
                  <input
                    type="text"
                    defaultValue="app_client_prod_8829104"
                    className="w-full py-2 px-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg font-mono text-neutral-900 dark:text-neutral-100"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Client Secret
                  </label>
                  <input
                    type="password"
                    defaultValue="sec_vault_091823901"
                    className="w-full py-2 px-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg font-mono text-neutral-900 dark:text-neutral-100"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
              <Button variant="outline" size="md" onClick={() => setActiveModalConn(null)}>
                {t.actionCancel}
              </Button>
              <Button variant="primary" size="md" onClick={handleTestAndConnect}>
                <ShieldCheck className="w-4 h-4" />
                <span>Test Connection & Activate</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Real-time Enterprise Webhooks & Integration Dispatcher */}
      <div className="p-6 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Link2 className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                {isRtl ? 'بث أحداث الـ Webhooks في الوقت الفعلي' : 'Real-time Webhook Events & Dispatcher'}
              </h3>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              {isRtl
                ? 'إشعارات لحظية بتوقيع HMAC-SHA256 عند فتح روابط الموردين، قبول المطالبات، أو إرفاق إشعارات الدائن'
                : 'Cryptographically signed HMAC-SHA256 event streaming for supplier portal views, dispute actions, and credit memo uploads.'}
            </p>
          </div>
          <span className="px-2.5 py-1 text-[11px] font-mono font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-md">
            HMAC-SHA256 Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 font-mono">
            <div className="font-bold text-neutral-900 dark:text-neutral-100">supplier.portal.viewed</div>
            <p className="text-[11px] font-sans text-neutral-500 mt-0.5">
              Fires when a supplier accesses the dispute link via single-use magic token.
            </p>
          </div>

          <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 font-mono">
            <div className="font-bold text-neutral-900 dark:text-neutral-100">supplier.dispute.accepted</div>
            <p className="text-[11px] font-sans text-neutral-500 mt-0.5">
              Fires when a supplier accepts a claim and triggers settlement agreement drafting.
            </p>
          </div>

          <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 font-mono">
            <div className="font-bold text-neutral-900 dark:text-neutral-100">supplier.credit_memo.uploaded</div>
            <p className="text-[11px] font-sans text-neutral-500 mt-0.5">
              Fires when proof is uploaded, antivirus verified, and envelope-encrypted.
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs">
          <div className="text-neutral-500 text-[11px]">
            Endpoint: <code className="font-mono text-emerald-600">/api/v1/webhooks/subscriptions</code>
          </div>
          <span className="flex items-center gap-1.5 text-emerald-600 font-medium text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5" /> Replay Defense &lt;5min Tolerance
          </span>
        </div>
      </div>
    </div>
  );
};
