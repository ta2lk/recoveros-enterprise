import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { AuthenticatedSession, db, SecurityViolationError } from '../db/client';
import { SessionService } from './sessionAuth';
import { UserRole } from '../types';

export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
  status: 'ACTIVE' | 'DISABLED';
  passwordHash: string;
  createdAt: string;
  lastLoginAt?: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashPassword(password: string): string {
  if (password.length < 12 || password.length > 128) {
    throw new SecurityViolationError('Password must contain between 12 and 128 characters.');
  }
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64, { N: 16_384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('hex')}$${derived.toString('hex')}`;
}

function verifyPassword(password: string, encoded: string): boolean {
  const [algorithm, n, r, p, saltHex, hashHex] = encoded.split('$');
  if (algorithm !== 'scrypt' || !n || !r || !p || !saltHex || !hashHex) return false;
  try {
    const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), hashHex.length / 2, {
      N: Number(n), r: Number(r), p: Number(p),
    });
    const expected = Buffer.from(hashHex, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export class AuthUserService {
  static readonly roles: UserRole[] = ['Owner', 'Admin', 'Finance Manager', 'Analyst', 'Viewer', 'Auditor', 'AI Agent'];

  private static assertProvisioningRole(role: string): asserts role is UserRole {
    if (!this.roles.includes(role as UserRole)) throw new SecurityViolationError('Invalid user role.');
  }

  private static canManage(actor: AuthenticatedSession, targetRole: string): boolean {
    if (actor.role === 'Owner') return true;
    return actor.role === 'Admin' && targetRole !== 'Owner' && targetRole !== 'Admin';
  }

  static async provisionUser(
    actor: AuthenticatedSession,
    params: { email: string; name: string; role: string; password: string }
  ): Promise<AuthUser> {
    this.assertProvisioningRole(params.role);
    if (actor.role !== 'Owner' && actor.role !== 'Admin') {
      throw new SecurityViolationError('Only Owner or Admin can provision users.');
    }
    if (!this.canManage(actor, params.role)) {
      throw new SecurityViolationError('Admin cannot provision Owner or Admin accounts.');
    }
    return this.createUser(actor, { id: `user-${randomUUID()}`, ...params });
  }

  static async listUsers(actor: AuthenticatedSession): Promise<Partial<AuthUser>[]> {
    if (actor.role !== 'Owner' && actor.role !== 'Admin') {
      throw new SecurityViolationError('Only Owner or Admin can list users.');
    }
    return db.listAuthUsers(actor.tenantId) as Promise<Partial<AuthUser>[]>;
  }

  static async updateUser(
    actor: AuthenticatedSession,
    userId: string,
    updates: { name?: string; role?: string; status?: 'ACTIVE' | 'DISABLED' }
  ): Promise<void> {
    if (actor.role !== 'Owner' && actor.role !== 'Admin') {
      throw new SecurityViolationError('Only Owner or Admin can update users.');
    }
    if (updates.name !== undefined && (!updates.name.trim() || updates.name.length > 255)) {
      throw new SecurityViolationError('Name must contain between 1 and 255 characters.');
    }
    if (updates.status !== undefined && updates.status !== 'ACTIVE' && updates.status !== 'DISABLED') {
      throw new SecurityViolationError('Invalid user status.');
    }
    if (userId === actor.userId && (updates.role || updates.status)) {
      throw new SecurityViolationError('You cannot change your own role or status.');
    }
    if (updates.role) this.assertProvisioningRole(updates.role);
    const tenantUsers = await db.listAuthUsers(actor.tenantId);
    const target = tenantUsers.find((user) => user.id === userId);
    if (!target) throw new SecurityViolationError('User not found in the authenticated tenant.');
    if (!this.canManage(actor, updates.role || String(target.role))) {
      throw new SecurityViolationError('This administrator cannot manage the target role.');
    }
    if (target.role === 'Owner' && updates.status === 'DISABLED') {
      const owners = tenantUsers.filter((user) => user.role === 'Owner' && user.status === 'ACTIVE');
      if (owners.length <= 1) throw new SecurityViolationError('The last active Owner cannot be disabled.');
    }
    const updated = await db.updateAuthUser(userId, actor.tenantId, updates);
    if (!updated) throw new SecurityViolationError('User update failed.');
    if (updates.status === 'DISABLED' || updates.role) {
      await db.revokeUserSessions(userId, actor.tenantId);
    }
  }

  static async createUser(
    session: AuthenticatedSession,
    params: { id: string; email: string; name: string; role: string; password: string }
  ): Promise<AuthUser> {
    this.assertProvisioningRole(params.role);
    const email = normalizeEmail(params.email);
    if (!email.includes('@')) throw new SecurityViolationError('A valid email is required.');
    const existing = await db.findUserByEmail(email);
    if (existing) throw new SecurityViolationError('A user with this email already exists.');
    const user: AuthUser = {
      id: params.id,
      tenantId: session.tenantId,
      email,
      name: params.name.trim(),
      role: params.role,
      status: 'ACTIVE',
      passwordHash: hashPassword(params.password),
      createdAt: new Date().toISOString(),
    };
    return db.insertAuthUser(user) as Promise<AuthUser>;
  }

  static async authenticate(emailInput: string, password: string): Promise<{ user: AuthUser; session: AuthenticatedSession }> {
    const email = normalizeEmail(emailInput);
    const user = await db.findUserByEmail(email) as AuthUser | null;
    if (!user || user.status !== 'ACTIVE' || !verifyPassword(password, user.passwordHash)) {
      throw new SecurityViolationError('Invalid email or password.');
    }
    const session = await SessionService.createSessionDurable({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      ttlMinutes: 120,
    });
    await db.updateAuthUserLastLogin(user.id);
    return { user, session };
  }

  static hashToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }
}
