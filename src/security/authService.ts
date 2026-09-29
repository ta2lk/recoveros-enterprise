import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { AuthenticatedSession, db, SecurityViolationError } from '../db/client';
import { SessionService } from './sessionAuth';

export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: string;
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
  static async createUser(
    session: AuthenticatedSession,
    params: { id: string; email: string; name: string; role: string; password: string }
  ): Promise<AuthUser> {
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
    // Do not reveal whether an email exists. The same generic error is returned for both cases.
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
