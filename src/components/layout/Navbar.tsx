import React, { useState } from 'react';
import { useI18n, Language } from '../../i18n';
import { useTenant } from '../../store/TenantContext';
import { UserRole } from '../../types';
import { Button } from '../ui/Button';
import {
  Globe,
  SlidersHorizontal,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  isAppView: boolean;
  onToggleAppView: (toApp: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  isAppView,
  onToggleAppView,
}) => {
  const { lang, setLang, isRtl, t } = useI18n();
  const { state, switchRole, switchMode } = useTenant();
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);

  const availableRoles: UserRole[] = [
    'Owner',
    'Admin',
    'Finance Manager',
    'Analyst',
    'Viewer',
    'Auditor',
    'AI Agent',
  ];

  const isDemo = state.currentTenant.mode === 'DEMO';

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800 transition-colors">
      {/* Zone 1, 2, 3: Strict Top Bar Contract */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onToggleAppView(false)}
            className="text-base font-bold tracking-tight text-neutral-900 dark:text-neutral-50 hover:text-emerald-600 transition-colors cursor-pointer"
          >
            {isRtl ? 'RecoverOS · ريكفر أو إس' : 'RecoverOS'}
          </button>

          {/* Mode Pill Notice */}
          <div className="relative">
            <button
              onClick={() => setModeMenuOpen(!modeMenuOpen)}
              className={`text-xs font-medium px-2 py-0.5 rounded flex items-center gap-1.5 transition-colors cursor-pointer ${
                isDemo
                  ? 'bg-amber-100/80 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'bg-emerald-100/80 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isDemo ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              <span>{isDemo ? (isRtl ? 'الوضع التجريبي' : 'DEMO MODE') : (isRtl ? 'وضع الإنتاج' : 'PRODUCTION')}</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {modeMenuOpen && (
              <div className={`absolute top-full mt-1.5 ${isRtl ? 'right-0' : 'left-0'} w-56 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg py-1 z-50 text-xs`}>
                <div className="px-3 py-1.5 border-b border-neutral-100 dark:border-neutral-700 font-semibold text-neutral-500">
                  {isRtl ? 'تبديل بيئة العمل' : 'Switch Environment'}
                </div>
                <button
                  onClick={() => {
                    switchMode('DEMO');
                    setModeMenuOpen(false);
                  }}
                  className="w-full text-left rtl:text-right px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-700 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-neutral-900 dark:text-neutral-100">
                      {isRtl ? 'الوضع التجريبي (Demo)' : 'Demo Mode'}
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      {isRtl ? 'بيانات اصطناعية لاختبار الدقة والمعمارية' : 'Synthetic Ground-Truth Dataset'}
                    </div>
                  </div>
                  {isDemo && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                </button>
                <button
                  onClick={() => {
                    switchMode('PRODUCTION');
                    setModeMenuOpen(false);
                  }}
                  className="w-full text-left rtl:text-right px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-700 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-neutral-900 dark:text-neutral-100">
                      {isRtl ? 'وضع الإنتاج الحي (Production)' : 'Production Mode'}
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      {isRtl ? 'ربط حقيقي مباشر بدون بيانات تجريبية' : 'Strict Live Integrations & Zero Mock Data'}
                    </div>
                  </div>
                  {!isDemo && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Zone 2: Navigation Links (4-6 single-line links with quiet hover underlines) */}
        {!isAppView ? (
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-neutral-600 dark:text-neutral-400">
            <button
              onClick={() => onNavigate('home')}
              className={`hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors whitespace-nowrap cursor-pointer ${
                currentView === 'home' ? 'text-neutral-950 dark:text-white font-semibold' : ''
              }`}
            >
              {t.navProduct}
            </button>
            <button
              onClick={() => onNavigate('howItWorks')}
              className={`hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors whitespace-nowrap cursor-pointer ${
                currentView === 'howItWorks' ? 'text-neutral-950 dark:text-white font-semibold' : ''
              }`}
            >
              {t.navHowItWorks}
            </button>
            <button
              onClick={() => onNavigate('recoveryTypes')}
              className={`hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors whitespace-nowrap cursor-pointer ${
                currentView === 'recoveryTypes' ? 'text-neutral-950 dark:text-white font-semibold' : ''
              }`}
            >
              {t.navRecoveryTypes}
            </button>
            <button
              onClick={() => onNavigate('security')}
              className={`hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors whitespace-nowrap cursor-pointer ${
                currentView === 'security' ? 'text-neutral-950 dark:text-white font-semibold' : ''
              }`}
            >
              {t.navSecurity}
            </button>
            <button
              onClick={() => onNavigate('integrations')}
              className={`hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors whitespace-nowrap cursor-pointer ${
                currentView === 'integrations' ? 'text-neutral-950 dark:text-white font-semibold' : ''
              }`}
            >
              {t.navIntegrations}
            </button>
            <button
              onClick={() => onNavigate('pricing')}
              className={`hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors whitespace-nowrap cursor-pointer ${
                currentView === 'pricing' ? 'text-neutral-950 dark:text-white font-semibold' : ''
              }`}
            >
              {t.navPricing}
            </button>
          </nav>
        ) : (
          <div className="hidden lg:flex items-center gap-2 text-xs text-neutral-500">
            <span>{state.currentTenant.name}</span>
            <span aria-hidden="true">·</span>
            <span>{state.currentUser.email}</span>
          </div>
        )}

        {/* Zone 3: Primary Actions & Utilities */}
        <div className="flex items-center gap-2.5">
          {/* RBAC Role Switcher */}
          <div className="relative">
            <button
              onClick={() => setRoleMenuOpen(!roleMenuOpen)}
              className="text-xs text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white px-2 py-1 border border-neutral-200 dark:border-neutral-700 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Test RBAC roles"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span className="hidden sm:inline font-mono">{state.currentUser.role}</span>
              <ChevronDown className="w-2.5 h-2.5 opacity-60" />
            </button>

            {roleMenuOpen && (
              <div className={`absolute top-full mt-1.5 ${isRtl ? 'left-0' : 'right-0'} w-44 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg py-1 z-50 text-xs`}>
                <div className="px-3 py-1 text-[11px] font-semibold text-neutral-400">
                  {isRtl ? 'تبديل الصلاحية النشطة (RBAC)' : 'Switch Active Role'}
                </div>
                {availableRoles.map((r) => {
                  const roleLabelAr: Record<string, string> = {
                    Owner: 'المالك (Owner)',
                    Admin: 'المشرف (Admin)',
                    'Finance Manager': 'مدير المالية (Finance Mgr)',
                    Analyst: 'محلل التدقيق (Analyst)',
                    Viewer: 'مشاهد (Viewer)',
                    Auditor: 'مدقق حسابات (Auditor)',
                    'AI Agent': 'وكيل ذكاء (AI Agent)',
                  };
                  return (
                    <button
                      key={r}
                      onClick={() => {
                        switchRole(r);
                        setRoleMenuOpen(false);
                      }}
                      className="w-full text-left rtl:text-right px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-700 flex items-center justify-between text-neutral-800 dark:text-neutral-200"
                    >
                      <span>{isRtl ? (roleLabelAr[r] || r) : r}</span>
                      {state.currentUser.role === r && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Language Switcher (EN / AR) */}
          <button
            onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
            className="text-xs font-semibold px-2 py-1 text-neutral-700 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white border border-neutral-200 dark:border-neutral-700 rounded-md flex items-center gap-1 transition-colors cursor-pointer"
            aria-label="Toggle language"
          >
            <Globe className="w-3 h-3 text-emerald-600" />
            <span>{lang === 'en' ? 'العربية' : 'English'}</span>
          </button>

          {/* Console / Launch Action */}
          {!isAppView ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onToggleAppView(true)}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{t.navConsole}</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onToggleAppView(false)}
            >
              <span>{t.navProduct}</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};
