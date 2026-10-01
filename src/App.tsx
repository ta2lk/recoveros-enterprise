import React, { useState } from 'react';
import { I18nProvider, useI18n } from './i18n';
import { TenantProvider, useTenant } from './store/TenantContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { Home } from './components/website/Home';
import { HowItWorks, RecoveryTypes } from './components/website/PublicPages';
import { SecurityPage, PricingPage, ContactPage, IntegrationsPage } from './components/website/PublicOtherPages';

import { DashboardView } from './components/app/DashboardView';
import { OpportunitiesView } from './components/app/OpportunitiesView';
import { ClaimsView } from './components/app/ClaimsView';
import { RecoveriesView } from './components/app/RecoveriesView';
import { SuppliersView } from './components/app/SuppliersView';
import { ContractsView } from './components/app/ContractsView';
import { InvoicesView } from './components/app/InvoicesView';
import { TransactionsView } from './components/app/TransactionsView';
import { DocumentsView } from './components/app/DocumentsView';
import { IntegrationsView } from './components/app/IntegrationsView';
import { AgentsView } from './components/app/AgentsView';
import { AiActivityView } from './components/app/AiActivityView';
import { ReportsView } from './components/app/ReportsView';
import { AnalyticsView } from './components/app/AnalyticsView';
import { NotificationsView } from './components/app/NotificationsView';
import { AuditLogView } from './components/app/AuditLogView';
import { TeamView } from './components/app/TeamView';
import { RolesPermissionsView } from './components/app/RolesPermissionsView';
import { BillingView } from './components/app/BillingView';
import { SettingsView } from './components/app/SettingsView';
import { SecurityView } from './components/app/SecurityView';
import { InfrastructureView } from './components/app/InfrastructureView';
import { BenchmarkView } from './components/app/BenchmarkView';
import { SupplierPortalPage } from './components/portal/SupplierPortalPage';

function AppContent() {
  const { isRtl } = useI18n();
  const [isAppView, setIsAppView] = useState(true); // default to console to immediately showcase functionality
  const [publicView, setPublicView] = useState('home');
  const [appTab, setAppTab] = useState('dashboard');
  if (window.location.pathname === '/supplier-portal/access') {
    return <SupplierPortalPage />;
  }

  const renderPublicView = () => {
    switch (publicView) {
      case 'howItWorks':
        return <HowItWorks onLaunchConsole={() => setIsAppView(true)} />;
      case 'recoveryTypes':
        return <RecoveryTypes onLaunchConsole={() => setIsAppView(true)} />;
      case 'security':
        return <SecurityPage onLaunchConsole={() => setIsAppView(true)} />;
      case 'integrations':
        return <IntegrationsPage onLaunchConsole={() => setIsAppView(true)} />;
      case 'pricing':
        return <PricingPage onLaunchConsole={() => setIsAppView(true)} />;
      case 'contact':
        return <ContactPage />;
      case 'home':
      default:
        return (
          <Home
            onLaunchConsole={() => setIsAppView(true)}
            onNavigate={(v) => setPublicView(v)}
          />
        );
    }
  };

  const renderAppView = () => {
    switch (appTab) {
      case 'opportunities':
        return <OpportunitiesView />;
      case 'claims':
        return <ClaimsView />;
      case 'recoveries':
        return <RecoveriesView />;
      case 'suppliers':
        return <SuppliersView />;
      case 'contracts':
        return <ContractsView />;
      case 'invoices':
        return <InvoicesView />;
      case 'transactions':
        return <TransactionsView />;
      case 'documents':
        return <DocumentsView />;
      case 'integrations':
        return <IntegrationsView />;
      case 'agents':
        return <AgentsView />;
      case 'aiActivity':
        return <AiActivityView />;
      case 'reports':
        return <ReportsView />;
      case 'analytics':
        return <AnalyticsView />;
      case 'notifications':
        return <NotificationsView />;
      case 'auditLog':
        return <AuditLogView />;
      case 'team':
        return <TeamView />;
      case 'roles':
        return <RolesPermissionsView />;
      case 'billing':
        return <BillingView />;
      case 'settings':
        return <SettingsView />;
      case 'security':
        return <SecurityView />;
      case 'infrastructure':
        return <InfrastructureView />;
      case 'benchmark':
        return <BenchmarkView />;
      case 'dashboard':
      default:
        return <DashboardView onNavigate={(tab) => setAppTab(tab)} />;
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col font-sans transition-colors">
      <Navbar
        currentView={isAppView ? appTab : publicView}
        onNavigate={(view) => {
          setIsAppView(false);
          setPublicView(view);
        }}
        isAppView={isAppView}
        onToggleAppView={(toApp) => setIsAppView(toApp)}
      />

      {isAppView ? (
        <div className="flex flex-1 overflow-hidden">
          <Sidebar currentTab={appTab} onSelectTab={(tab) => setAppTab(tab)} />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
            {renderAppView()}
          </main>
        </div>
      ) : (
        <main className="flex-1 overflow-y-auto">
          {renderPublicView()}

          {/* Clean enterprise footer per constitution */}
          <footer className="border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 py-8 px-4 sm:px-6 text-xs text-neutral-500">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                &copy; {new Date().getFullYear()} RecoverOS Inc. All rights reserved.
                {' '}&bull; {isRtl ? 'منصة استرداد الأموال للشركات' : 'Autonomous Enterprise Revenue Recovery'}
              </div>
              <div className="flex items-center gap-4">
                <button onClick={() => setPublicView('security')} className="hover:underline cursor-pointer">
                  Security
                </button>
                <button onClick={() => setPublicView('pricing')} className="hover:underline cursor-pointer">
                  Pricing
                </button>
                <button onClick={() => setPublicView('contact')} className="hover:underline cursor-pointer">
                  Contact
                </button>
              </div>
            </div>
          </footer>
        </main>
      )}
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <TenantProvider>
        <AppContent />
      </TenantProvider>
    </I18nProvider>
  );
}
