import { AuthUserService } from '../src/security/authService';
import { SessionService } from '../src/security/sessionAuth';
import { AuthenticatedSession, db } from '../src/db/client';

if (!process.env.DATABASE_URL) {
  console.log('POSTGRES PROVISIONING TEST SKIPPED: DATABASE_URL is not configured.');
  process.exit(0);
}

await db.initialize();
const suffix = Date.now().toString();
const owner: AuthenticatedSession = {
  sessionId: `owner-${suffix}`, userId: `owner-${suffix}`, tenantId: `provision-tenant-${suffix}`, role: 'Owner', expiresAt: Date.now() + 60_000,
};
const admin: AuthenticatedSession = { ...owner, sessionId: `admin-${suffix}`, userId: `admin-${suffix}`, role: 'Admin' };
const otherTenantAdmin: AuthenticatedSession = { ...owner, sessionId: `other-${suffix}`, userId: `other-${suffix}`, tenantId: `other-tenant-${suffix}`, role: 'Admin' };

const adminUser = await AuthUserService.createUser(owner, {
  id: `admin-${suffix}`, email: `admin-${suffix}@recoveros.test`, name: 'Tenant Admin', role: 'Admin', password: 'admin password 2026 secure',
});
const analyst = await AuthUserService.provisionUser(owner, {
  email: `analyst-${suffix}@recoveros.test`, name: 'Tenant Analyst', role: 'Analyst', password: 'analyst password 2026 secure',
});
if (analyst.tenantId !== owner.tenantId) throw new Error('Provisioned user escaped the owner tenant.');

let adminElevationBlocked = false;
try {
  await AuthUserService.provisionUser(admin, {
    email: `owner2-${suffix}@recoveros.test`, name: 'Unauthorized Owner', role: 'Owner', password: 'owner password 2026 secure',
  });
} catch { adminElevationBlocked = true; }
if (!adminElevationBlocked) throw new Error('Admin was allowed to provision an Owner.');

let crossTenantBlocked = false;
try {
  await AuthUserService.updateUser(otherTenantAdmin, analyst.id, { status: 'DISABLED' });
} catch { crossTenantBlocked = true; }
if (!crossTenantBlocked) throw new Error('Cross-tenant user update was not blocked.');

const analystAuth = await AuthUserService.authenticate(analyst.email, 'analyst password 2026 secure');
await AuthUserService.updateUser(admin, analyst.id, { status: 'DISABLED' });
if (await SessionService.getSessionDurable(analystAuth.session.sessionId)) {
  throw new Error('Disabling a user did not revoke active sessions.');
}

let selfRoleChangeBlocked = false;
try {
  await AuthUserService.updateUser(admin, adminUser.id, { role: 'Owner' });
} catch { selfRoleChangeBlocked = true; }
if (!selfRoleChangeBlocked) throw new Error('Admin self-role escalation was allowed.');

const users = await AuthUserService.listUsers(owner);
if (users.some((user) => user.tenantId !== owner.tenantId)) throw new Error('User listing crossed tenant boundary.');

await db.close();
console.log('POSTGRES PROVISIONING TEST PASSED: RBAC, tenant isolation, role escalation protection, and session revocation.');
