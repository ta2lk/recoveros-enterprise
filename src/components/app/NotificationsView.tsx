import React from 'react';
import { useI18n } from '../../i18n';
import { useTenant } from '../../store/TenantContext';
import { Bell, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Button } from '../ui/Button';

export const NotificationsView: React.FC = () => {
  const { t, formatDate, isRtl } = useI18n();
  const { state, approveClaim } = useTenant();

  const pendingClaims = state.claims.filter((c) => c.status === 'APPROVAL_REQUIRED');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {t.appNotifications}
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {isRtl ? 'التنبيهات المباشرة وطلبات اعتماد المدفوعات والمطالبات' : 'Actionable alerts, human approval requests, and supplier dispute notifications'}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {pendingClaims.map((claim) => (
          <div
            key={claim.id}
            className="p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20 flex items-center justify-between gap-4 text-xs"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-amber-950 dark:text-amber-200">
                  Manager Sign-off Required: Claim #{claim.claimNumber}
                </div>
                <p className="text-amber-800 dark:text-amber-300/90 mt-0.5">
                  Overpayment of ${claim.amount.toFixed(2)} against {claim.supplierName} exceeds autonomous limit (${state.currentTenant.settings.autonomousThresholdUsd}).
                </p>
                <div className="text-[11px] text-amber-700/80 dark:text-amber-400 mt-1">
                  Created {formatDate(claim.createdAt)}
                </div>
              </div>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => approveClaim(claim.id)}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Approve Notice</span>
            </Button>
          </div>
        ))}

        <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-between gap-4 text-xs">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                Continuous Ledger Re-Audit Finished
              </div>
              <p className="text-neutral-500 mt-0.5">
                Processed all invoices with 0 fatal integrity exceptions.
              </p>
            </div>
          </div>
          <span className="text-[11px] text-neutral-400">Today</span>
        </div>
      </div>
    </div>
  );
};
