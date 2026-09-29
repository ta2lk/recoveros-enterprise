import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { useTenant } from '../../store/TenantContext';
import { StatusMarker } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Activity, Bot, ChevronRight, CheckCircle2, Clock } from 'lucide-react';
import { AgentRun } from '../../types';

export const AiActivityView: React.FC = () => {
  const { t, formatCurrency, formatDate, isRtl } = useI18n();
  const { state } = useTenant();
  const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {t.appAiActivity}
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {isRtl ? 'سجل العمليات والقرارات التي نفذتها الوكلاء الذكية لحظة بلحظة' : 'Live stream of multi-agent ledger scans, contract interpretations, mathematical verifications, and notice drafting'}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            <span>Agent Execution Pipeline Runs ({state.agentRuns.length})</span>
          </div>
        </div>

        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {state.agentRuns.length === 0 ? (
            <div className="text-center py-12 text-neutral-500 text-xs">
              No recent agent executions recorded. Run an audit to trigger autonomous workflows.
            </div>
          ) : (
            state.agentRuns.map((run) => (
              <div
                key={run.id}
                onClick={() => setSelectedRun(run)}
                className="p-4 hover:bg-neutral-50/80 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer flex items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                        {run.agentName}
                      </span>
                      <span aria-hidden="true">&bull;</span>
                      <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                        {run.workflow}
                      </span>
                      <StatusMarker label={run.status} tone="emerald" />
                    </div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 truncate">
                      {run.summary}
                    </p>
                    <div className="text-[11px] text-neutral-400 mt-1 flex items-center gap-2">
                      <span>Started: {formatDate(run.startedAt)}</span>
                      {run.completedAt && (
                        <>
                          <span aria-hidden="true">&bull;</span>
                          <span>Completed in 2.1s</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  {run.amountIdentified > 0 && (
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-emerald-600 tabular-nums">
                        {formatCurrency(run.amountIdentified)}
                      </div>
                      <div className="text-[10px] text-neutral-400">
                        {run.findingsCount} discrepancies
                      </div>
                    </div>
                  )}
                  <ChevronRight className={`w-4 h-4 text-neutral-400 ${isRtl ? 'rotate-180' : ''}`} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Agent Run Detail Modal */}
      {selectedRun && (
        <Modal
          isOpen={!!selectedRun}
          onClose={() => setSelectedRun(null)}
          title={`${selectedRun.agentName} - ${selectedRun.workflow}`}
          subtitle={`Execution ID: ${selectedRun.id}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
              <div className="font-semibold text-neutral-900 dark:text-neutral-100 mb-1">Summary</div>
              <p className="text-neutral-600 dark:text-neutral-400">{selectedRun.summary}</p>
            </div>

            <div>
              <div className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2 uppercase tracking-wider text-[11px]">
                Execution Telemetry & Tool Calls
              </div>
              <div className="bg-neutral-950 text-neutral-300 p-3 rounded-lg font-mono text-[11px] space-y-1 max-h-48 overflow-y-auto">
                {selectedRun.logs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-neutral-500">[{idx + 1}]</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-neutral-200 dark:border-neutral-800">
              <Button variant="outline" size="md" onClick={() => setSelectedRun(null)}>
                {t.actionClose}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
