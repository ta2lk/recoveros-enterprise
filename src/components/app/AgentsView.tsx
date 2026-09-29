import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { useTenant } from '../../store/TenantContext';
import { StatusMarker } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Bot, Shield, CheckCircle, Ban, DollarSign, Activity } from 'lucide-react';
import { AgentDef } from '../../types';

export const AgentsView: React.FC = () => {
  const { t, isRtl, formatCurrency, formatNumber } = useI18n();
  const { state } = useTenant();
  const [selectedAgent, setSelectedAgent] = useState<AgentDef | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {t.appAgents}
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {isRtl
              ? 'مركز قيادة الوكلاء الأذكياء المتخصصين مع حدود الصلاحيات والتعرض المالي'
              : 'Multi-agent command center with explicit tool boundaries, denied actions, and maximum exposure caps'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {state.agents.map((agent) => (
          <div
            key={agent.id}
            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-emerald-600">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                      {isRtl ? agent.arabicName : agent.name}
                    </h3>
                    <span className="text-[11px] text-neutral-500 font-mono">
                      {isRtl ? 'الدور: ' : 'Role: '}{agent.role}
                    </span>
                  </div>
                </div>

                <StatusMarker label={agent.status} tone="emerald" />
              </div>

              <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-3">
                {agent.description}
              </p>

              <div className="space-y-2 text-[11px] bg-neutral-50 dark:bg-neutral-800/60 p-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">
                    {isRtl ? 'سقف التعرض المالي المستقل:' : 'Autonomous Financial Exposure:'}
                  </span>
                  <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                    {formatCurrency(agent.maxFinancialExposureUsd)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">
                    {isRtl ? 'العمليات المنجزة:' : 'Completed Operations:'}
                  </span>
                  <span className="font-mono text-neutral-900 dark:text-neutral-100 font-semibold">
                    {formatNumber(agent.tasksCompleted)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">
                    {isRtl ? 'آخر نشاط:' : 'Last Active:'}
                  </span>
                  <span className="text-neutral-600 dark:text-neutral-400">{agent.lastActive}</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <span className="text-[11px] text-neutral-400">
                {isRtl
                  ? `${agent.allowedTools.length} أدوات مصرحة • ${agent.deniedTools.length} محظورة`
                  : `${agent.allowedTools.length} allowed tools • ${agent.deniedTools.length} blocked`}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedAgent(agent)}
              >
                <Shield className="w-3 h-3" />
                <span>{isRtl ? 'الصلاحيات' : 'Permissions'}</span>
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Agent Permission & Policy Boundary Modal */}
      {selectedAgent && (
        <Modal
          isOpen={!!selectedAgent}
          onClose={() => setSelectedAgent(null)}
          title={`${isRtl ? selectedAgent.arabicName : selectedAgent.name} - ${isRtl ? 'حدود السياسات' : 'Policy Boundaries'}`}
          subtitle={isRtl ? 'الحواجز الدستورية والقيود الصارمة على الأدوات' : 'Constitutional Guardrails & Enforced Tool Restrictions'}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div>
              <h4 className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 mb-2">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>{isRtl ? 'الأدوات المصرح بها حصراً' : 'Explicitly Allowed Tools'}</span>
              </h4>
              <div className="space-y-1">
                {selectedAgent.allowedTools.map((tool) => (
                  <div
                    key={tool}
                    className="p-2 rounded bg-neutral-50 dark:bg-neutral-800 font-mono text-[11px] text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700"
                  >
                    + {tool}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5 mb-2">
                <Ban className="w-3.5 h-3.5" />
                <span>Strictly Denied Actions (Hard System Boundary)</span>
              </h4>
              <div className="space-y-1">
                {selectedAgent.deniedTools.map((tool) => (
                  <div
                    key={tool}
                    className="p-2 rounded bg-rose-50/50 dark:bg-rose-950/20 font-mono text-[11px] text-rose-800 dark:text-rose-300 border border-rose-200/60 dark:border-rose-900/40"
                  >
                    &times; {tool}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-neutral-600 dark:text-neutral-300 text-[11px]">
              <strong>Constitutional Invariant:</strong> No AI agent can initiate bank transfers, modify contracts, or alter financial ledgers. All sensitive actions require human manager authorization.
            </div>

            <div className="flex justify-end pt-3 border-t border-neutral-200 dark:border-neutral-800">
              <Button variant="outline" size="md" onClick={() => setSelectedAgent(null)}>
                {t.actionClose}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
