import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { useTenant } from '../../store/TenantContext';
import { Button } from '../ui/Button';
import { Settings, ShieldCheck, Check } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { t, isRtl } = useI18n();
  const { state } = useTenant();

  const [autoThreshold, setAutoThreshold] = useState(state.currentTenant.settings.autonomousThresholdUsd);
  const [highThreshold, setHighThreshold] = useState(state.currentTenant.settings.highValueApprovalThresholdUsd);
  const [confThreshold, setConfThreshold] = useState(state.currentTenant.settings.confidenceThresholdPercent);
  const [currency, setCurrency] = useState(state.currentTenant.settings.defaultCurrency);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSave = () => {
    state.currentTenant.settings.autonomousThresholdUsd = autoThreshold;
    state.currentTenant.settings.highValueApprovalThresholdUsd = highThreshold;
    state.currentTenant.settings.confidenceThresholdPercent = confThreshold;
    state.currentTenant.settings.defaultCurrency = currency;
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {t.appSettings}
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {isRtl ? 'تكوين سياسات الاعتماد البشري والحدود المالية للوكلاء المستقلين' : 'Configure tenant autonomous thresholds, human approval gates, and sovereign currency'}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs space-y-4 text-xs">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 border-b border-neutral-100 dark:border-neutral-800 pb-2">
          Autonomous Operation Policy
        </h3>

        <div>
          <label className="block font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
            Autonomous Claim Dispatch Threshold (USD)
          </label>
          <p className="text-[11px] text-neutral-500 mb-2">
            Claims with verified mathematical proof below this amount are automatically dispatched without human bottleneck.
          </p>
          <input
            type="number"
            value={autoThreshold}
            onChange={(e) => setAutoThreshold(parseFloat(e.target.value) || 0)}
            className="w-full sm:w-64 py-2 px-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg font-mono text-neutral-900 dark:text-neutral-100"
          />
        </div>

        <div>
          <label className="block font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
            High-Value Manager Sign-Off Threshold (USD)
          </label>
          <p className="text-[11px] text-neutral-500 mb-2">
            Discrepancies exceeding this amount strictly mandate explicit Finance Manager or CFO authorization.
          </p>
          <input
            type="number"
            value={highThreshold}
            onChange={(e) => setHighThreshold(parseFloat(e.target.value) || 0)}
            className="w-full sm:w-64 py-2 px-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg font-mono text-neutral-900 dark:text-neutral-100"
          />
        </div>

        <div>
          <label className="block font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
            Minimum Extraction Confidence Threshold (%)
          </label>
          <p className="text-[11px] text-neutral-500 mb-2">
            Discrepancies below this statistical confidence are quarantined for manual auditor review.
          </p>
          <input
            type="number"
            value={confThreshold}
            onChange={(e) => setConfThreshold(parseFloat(e.target.value) || 0)}
            className="w-full sm:w-64 py-2 px-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg font-mono text-neutral-900 dark:text-neutral-100"
          />
        </div>

        <div>
          <label className="block font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
            Default Sovereign Operating Currency
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as any)}
            className="w-full sm:w-64 py-2 px-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100"
          >
            <option value="USD">USD ($) - United States Dollar</option>
            <option value="EUR">EUR (€) - Eurozone</option>
            <option value="GBP">GBP (£) - British Pound</option>
            <option value="SAR">SAR (ر.س) - Saudi Riyal</option>
            <option value="AED">AED (د.إ) - UAE Dirham</option>
            <option value="TRY">TRY (₺) - Turkish Lira</option>
          </select>
        </div>

        <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <div>
            {savedNotice && (
              <span className="text-emerald-600 flex items-center gap-1 font-medium">
                <Check className="w-3.5 h-3.5" />
                <span>Settings updated successfully</span>
              </span>
            )}
          </div>
          <Button variant="primary" size="md" onClick={handleSave}>
            {t.actionSave}
          </Button>
        </div>
      </div>
    </div>
  );
};
