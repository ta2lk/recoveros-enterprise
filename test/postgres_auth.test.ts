import { AuthUserService } from '../src/security/authService';
import { SessionService } from '../src/security/sessionAuth';
import { AuthenticatedSession, db } from '../src/db/client';

if (!process.env.DATABASE_URL) {
  console.log('POSTGRES AUTH TEST SKIPPED: DATABASE_URL is not configured.');
  process.exit(0);
}

await db.initialize();
const suffix = Date.now().toString();
const provisioner: AuthenticatedSession = {
  sessionId: `provisioner-${suffix}`,
  userId: `provisioner-${suffix}`,
  tenantId: `auth-tenant-${suffix}`,
  role: 'Owner',
  expiresAt: Date.now() + 60_000,
};
const email = `auth-${suffix}@recoveros.test`;
const password = 'correct horse battery staple 2026';

const user = await AuthUserService.createUser(provisioner, {
  id: `auth-user-${suffix}`,
  email,
  name: 'Auth Integration User',
  role: 'Finance Manager',
  password,
});
if (user.email !== email || user.passwordHash === password || !user.passwordHash.startsWith('scrypt$')) {
  throw new Error('Password was not stored as a scrypt hash.');
}

let invalidRejected = false;
try {
  await AuthUserService.authenticate(email, 'wrong password 2026');
} catch {
  invalidRejected = true;
}
if (!invalidRejected) throw new Error('Invalid password was accepted.');

const authenticated = await AuthUserService.authenticate(email, password);
if (authenticated.session.tenantId !== provisioner.tenantId || authenticated.session.role !== 'Finance Manager') {
  throw new Error('Authenticated session did not inherit server-side user tenant and role.');
}

const afterRestart = await SessionService.getSessionDurable(authenticated.session.sessionId);
if (!afterRestart || afterRestart.userId !== user.id) {
  throw new Error('PostgreSQL session was not recoverable after service restart.');
}

const revoked = await SessionService.revokeSessionDurable(afterRestart);
if (!revoked || await SessionService.getSessionDurable(authenticated.session.sessionId)) {
  throw new Error('Session revocation failed.');
}

await db.close();
console.log('POSTGRES AUTH TEST PASSED: scrypt password hashing, durable session recovery, tenant/role binding, and revocation.');
