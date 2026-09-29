import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { useTenant } from '../../store/TenantContext';
import { StatusMarker } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Users, UserPlus, Mail, Shield } from 'lucide-react';
import { UserRole } from '../../types';

export const TeamView: React.FC = () => {
  const { t, formatDate, isRtl } = useI18n();
  const { state } = useTenant();

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('Analyst');

  const teamMembers = [
    {
      id: 'usr-1',
      name: 'Sarah Jenkins, CPA',
      email: 'cfo@acme-enterprise.example',
      role: 'Owner' as UserRole,
      status: 'ACTIVE' as const,
      joinedAt: '2025-01-01',
    },
    {
      id: 'usr-2',
      name: 'Marcus Vance',
      email: 'finance.lead@acme-enterprise.example',
      role: 'Finance Manager' as UserRole,
      status: 'ACTIVE' as const,
      joinedAt: '2025-02-15',
    },
    {
      id: 'usr-3',
      name: 'Elena Rostova',
      email: 'erostova@acme-enterprise.example',
      role: 'Analyst' as UserRole,
      status: 'ACTIVE' as const,
      joinedAt: '2025-03-01',
    },
    {
      id: 'usr-4',
      name: 'PwC Forensic Engagement Team',
      email: 'external-audit@pwc.example',
      role: 'Auditor' as UserRole,
      status: 'ACTIVE' as const,
      joinedAt: '2025-04-10',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {t.appTeam}
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {isRtl ? 'إدارة أعضاء الفريق والمدققين والمصادقة متعددة العوامل' : 'Manage corporate treasury staff, internal auditors, and external forensic partners'}
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={() => setIsInviteOpen(true)}>
          <UserPlus className="w-3.5 h-3.5" />
          <span>Invite Team Member</span>
        </Button>
      </div>

      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left rtl:text-right border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-800/40 text-neutral-500 font-semibold">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Member Since</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {teamMembers.map((member) => (
                <tr
                  key={member.id}
                  className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/50 transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {member.name}
                    </div>
                    <div className="text-[11px] text-neutral-500 flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3" />
                      <span>{member.email}</span>
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <span className="font-mono font-medium px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
                      {member.role}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-neutral-500">
                    {formatDate(member.joinedAt)}
                  </td>

                  <td className="py-3 px-4 text-center">
                    <StatusMarker label={member.status} tone="emerald" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isInviteOpen && (
        <Modal
          isOpen={isInviteOpen}
          onClose={() => setIsInviteOpen(false)}
          title="Invite User to Tenant"
          subtitle={state.currentTenant.name}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Corporate Email Address
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="w-full py-2 px-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Assigned Role
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as any)}
                className="w-full py-2 px-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100"
              >
                <option value="Admin">Admin</option>
                <option value="Finance Manager">Finance Manager</option>
                <option value="Analyst">Analyst</option>
                <option value="Viewer">Viewer</option>
                <option value="Auditor">Auditor (Read-Only Compliance)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
              <Button variant="outline" size="md" onClick={() => setIsInviteOpen(false)}>
                {t.actionCancel}
              </Button>
              <Button variant="primary" size="md" onClick={() => setIsInviteOpen(false)}>
                Send Invitation
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
