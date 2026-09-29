import React from 'react';
import { useI18n } from '../../i18n';
import { useTenant } from '../../store/TenantContext';
import {
  LayoutDashboard,
  SearchCheck,
  FileCheck2,
  DollarSign,
  Building2,
  FileText,
  Receipt,
  CreditCard,
  FileUp,
  Link2,
  Bot,
  Activity,
  BarChart3,
  TrendingUp,
  Bell,
  History,
  Users,
  Shield,
  CreditCard as BillingIcon,
  Settings,
  Lock,
  Target,
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const { t, isRtl } = useI18n();
  const { state } = useTenant();

  const navGroups = [
    {
      title: isRtl ? 'العمليات الأساسية' : 'Core Recovery',
      items: [
        { id: 'dashboard', label: t.appDashboard, icon: LayoutDashboard },
        { id: 'opportunities', label: t.appOpportunities, icon: SearchCheck, count: state.opportunities.length },
        { id: 'claims', label: t.appClaims, icon: FileCheck2, count: state.claims.length },
        { id: 'recoveries', label: t.appRecoveries, icon: DollarSign, count: state.recoveries.length },
      ],
    },
    {
      title: isRtl ? 'الدفاتر والوثائق' : 'Ledgers & Documents',
      items: [
        { id: 'suppliers', label: t.appSuppliers, icon: Building2, count: state.suppliers.length },
        { id: 'contracts', label: t.appContracts, icon: FileText, count: state.contracts.length },
        { id: 'invoices', label: t.appInvoices, icon: Receipt, count: state.invoices.length },
        { id: 'transactions', label: t.appTransactions, icon: CreditCard, count: state.payments.length },
        { id: 'documents', label: t.appDocuments, icon: FileUp, count: state.documents.length },
        { id: 'integrations', label: t.appIntegrations, icon: Link2 },
      ],
    },
    {
      title: isRtl ? 'الذكاء الاصطناعي المستقل' : 'Autonomous AI',
      items: [
        { id: 'agents', label: t.appAgents, icon: Bot },
        { id: 'aiActivity', label: t.appAiActivity, icon: Activity },
        { id: 'benchmark', label: t.benchmarkTitle, icon: Target },
      ],
    },
    {
      title: isRtl ? 'الحوكمة والرقابة' : 'Governance & Audit',
      items: [
        { id: 'reports', label: t.appReports, icon: BarChart3 },
        { id: 'analytics', label: t.appAnalytics, icon: TrendingUp },
        { id: 'notifications', label: t.appNotifications, icon: Bell },
        { id: 'auditLog', label: t.appAuditLog, icon: History, count: state.auditLogs.length },
        { id: 'team', label: t.appTeam, icon: Users },
        { id: 'roles', label: t.appRolesPermissions, icon: Shield },
        { id: 'billing', label: t.appBilling, icon: BillingIcon },
        { id: 'settings', label: t.appSettings, icon: Settings },
        { id: 'security', label: t.appSecurity, icon: Lock },
      ],
    },
  ];

  return (
    <aside className="w-64 shrink-0 bg-neutral-900 text-neutral-300 border-r rtl:border-r-0 rtl:border-l border-neutral-800 flex flex-col h-[calc(100vh-3.5rem)] sticky top-14 select-none">
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navGroups.map((group, gIdx) => (
          <div key={gIdx}>
            <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider px-3 mb-1.5">
              {group.title}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectTab(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-neutral-800 text-white font-semibold shadow-xs'
                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-400' : 'text-neutral-500'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.count !== undefined && item.count > 0 && (
                      <span className="text-[11px] font-mono tabular-nums text-neutral-400">
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Profile & Status */}
      <div className="p-3 border-t border-neutral-800 bg-neutral-950/60 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full overflow-hidden bg-neutral-800 shrink-0">
          <img
            src={state.currentUser.avatarUrl || '/src/assets/images/avatar_cfo_director_1790534430873.jpg'}
            alt={state.currentUser.name}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="truncate flex-1">
          <div className="text-xs font-semibold text-neutral-200 truncate">
            {state.currentUser.name}
          </div>
          <div className="text-[11px] text-neutral-500 truncate flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>{state.currentUser.role}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
