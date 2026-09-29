import { UserRole } from '../types';

export type AppPermission =
  | 'VIEW_DASHBOARD'
  | 'VIEW_OPPORTUNITIES'
  | 'MANAGE_OPPORTUNITIES'
  | 'APPROVE_CLAIMS'
  | 'SUBMIT_CLAIMS'
  | 'MANAGE_INTEGRATIONS'
  | 'MANAGE_TEAM'
  | 'VIEW_AUDIT_LOGS'
  | 'CONFIGURE_SETTINGS'
  | 'MANAGE_BILLING'
  | 'EXECUTE_AGENTS';

export const ROLE_PERMISSIONS: Record<UserRole, AppPermission[]> = {
  Owner: [
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
  ],
  Admin: [
    'VIEW_DASHBOARD',
    'VIEW_OPPORTUNITIES',
    'MANAGE_OPPORTUNITIES',
    'APPROVE_CLAIMS',
    'SUBMIT_CLAIMS',
    'MANAGE_INTEGRATIONS',
    'MANAGE_TEAM',
    'VIEW_AUDIT_LOGS',
    'CONFIGURE_SETTINGS',
    'EXECUTE_AGENTS',
  ],
  'Finance Manager': [
    'VIEW_DASHBOARD',
    'VIEW_OPPORTUNITIES',
    'MANAGE_OPPORTUNITIES',
    'APPROVE_CLAIMS',
    'SUBMIT_CLAIMS',
    'VIEW_AUDIT_LOGS',
    'EXECUTE_AGENTS',
  ],
  Analyst: [
    'VIEW_DASHBOARD',
    'VIEW_OPPORTUNITIES',
    'MANAGE_OPPORTUNITIES',
    'VIEW_AUDIT_LOGS',
  ],
  Viewer: ['VIEW_DASHBOARD', 'VIEW_OPPORTUNITIES'],
  Auditor: ['VIEW_DASHBOARD', 'VIEW_OPPORTUNITIES', 'VIEW_AUDIT_LOGS'],
  'AI Agent': ['VIEW_OPPORTUNITIES', 'MANAGE_OPPORTUNITIES', 'EXECUTE_AGENTS'],
};

export class RbacGuard {
  static hasPermission(role: UserRole, permission: AppPermission): boolean {
    const list = ROLE_PERMISSIONS[role] || [];
    return list.includes(permission);
  }

  /**
   * Verify Tenant Isolation Guard: Ensures an actor can only access records belonging to their tenant
   */
  static assertTenantAccess(actorTenantId: string, resourceTenantId: string, resourceType: string): void {
    if (actorTenantId !== resourceTenantId) {
      throw new Error(
        `SECURITY_VIOLATION: Cross-tenant access denied! Tenant [${actorTenantId}] attempted unauthorized access to [${resourceType}] owned by Tenant [${resourceTenantId}].`
      );
    }
  }
}
