import React from 'react';
import { useI18n } from '../../i18n';
import { ROLE_PERMISSIONS, AppPermission } from '../../security/rbac';
import { UserRole } from '../../types';
import { Check, X } from 'lucide-react';

export const RolesPermissionsView: React.FC = () => {
  const { t, isRtl } = useI18n();

  const roles: UserRole[] = [
    'Owner',
    'Admin',
    'Finance Manager',
    'Analyst',
    'Viewer',
    'Auditor',
    'AI Agent',
  ];

  const allPermissions: AppPermission[] = [
    'VIEW_DASHBOARD',
    'VIEW_OPPORTUNITIES',
    'MANAGE_OPPORTUNITIES',
    'APPROVE_CLAIMS',
    'SUBMIT_CLAIMS',
    'MANAGE_INTEGRATIONS',
    'MANAGE_TEAM',
    'VIEW_AUDIT_LOGS',
    'CONFIGURE_SETTINGS',
    'MANAGE_BILLING',
    'EXECUTE_AGENTS',
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {t.appRolesPermissions}
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {isRtl ? 'مصفوفة التحكم في الوصول المبنية على الأدوار والحدود الأمنية' : 'Role-Based Access Control (RBAC) matrix defining permissions across humans and autonomous AI agents'}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left rtl:text-right border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-800/40 text-neutral-500 font-semibold">
                <th className="py-3 px-4">Permission Scope</th>
                {roles.map((r) => (
                  <th key={r} className="py-3 px-3 text-center font-mono">
                    {r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {allPermissions.map((perm) => (
                <tr key={perm} className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/50">
                  <td className="py-3 px-4 font-mono font-medium text-neutral-800 dark:text-neutral-200">
                    {perm}
                  </td>
                  {roles.map((r) => {
                    const has = ROLE_PERMISSIONS[r]?.includes(perm);
                    return (
                      <td key={r} className="py-3 px-3 text-center">
                        {has ? (
                          <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                        ) : (
                          <X className="w-4 h-4 text-neutral-300 dark:text-neutral-700 mx-auto" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
