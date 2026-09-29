import {
  createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID,
  scryptSync, timingSafeEqual,
} from 'node:crypto';
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
  failedLoginAttempts?: number;
  lockedUntil?: string;
  mfaEnabled?: boolean;
  mfaSecretCiphertext?: string;
}

const MAX_LOGIN_FAILURES = 5;
const ACCOUNT_LOCK_MINUTES = 15;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT = 10;
const devMfaKey = randomBytes(32);
const loginBuckets = new Map<string, { count: number; windowStart: number; blockedUntil: number }>();

function normalizeEmail(email: string): string { return email.trim().toLowerCase(); }

function hashPassword(password: string): string {
  if (password.length < 12 || password.length > 128) throw new SecurityViolationError('Password must contain between 12 and 128 characters.');
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64, { N: 16_384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('hex')}$${derived.toString('hex')}`;
}

function verifyPassword(password: string, encoded: string): boolean {
  const [algorithm, n, r, p, saltHex, hashHex] = encoded.split('$');
  if (algorithm !== 'scrypt' || !n || !r || !p || !saltHex || !hashHex) return false;
  try {
    const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), hashHex.length / 2, { N: Number(n), r: Number(r), p: Number(p) });
    const expected = Buffer.from(hashHex, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch { return false; }
}

function base32Encode(input: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0; let value = 0; let output = '';
  for (const byte of input) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { output += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0; let value = 0; const output: number[] = [];
  for (const char of input.replace(/=+$/, '').toUpperCase()) {
    const index = alphabet.indexOf(char); if (index < 0) throw new Error('Invalid base32 secret');
    value = (value << 5) | index; bits += 5;
    if (bits >= 8) { output.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(output);
}

function totp(secret: string, timestamp = Date.now()): string {
  const counter = Math.floor(timestamp / 30_000);
  const buffer = Buffer.alloc(8); buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', base32Decode(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 15;
  const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return code.toString().padStart(6, '0');
}

function verifyTotp(secret: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  for (const drift of [-1, 0, 1]) {
    const expected = totp(secret, Date.now() + drift * 30_000);
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(code))) return true;
  }
  return false;
}

function encryptionKey(): Buffer {
  const configured = process.env.RECOVEROS_MASTER_KEK_HEX || '';
  if (/^[0-9a-fA-F]{64}$/.test(configured)) return Buffer.from(configured, 'hex');
  if (process.env.NODE_ENV === 'production') throw new SecurityViolationError('RECOVEROS_MASTER_KEK_HEX is required for MFA secrets in production.');
  return devMfaKey;
}

function encryptSecret(secret: string): string {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}.${cipher.getAuthTag().toString('hex')}.${ciphertext.toString('hex')}`;
}

function decryptSecret(encoded: string): string {
  const [ivHex, tagHex, ciphertextHex] = encoded.split('.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextHex, 'hex')), decipher.final()]).toString('utf8');
}

function isSensitiveRole(role: string): boolean { return role === 'Owner' || role === 'Admin'; }

export class AuthUserService {
  static readonly roles: UserRole[] = ['Owner', 'Admin', 'Finance Manager', 'Analyst', 'Viewer', 'Auditor', 'AI Agent'];

  private static assertProvisioningRole(role: string): asserts role is UserRole {
    if (!this.roles.includes(role as UserRole)) throw new SecurityViolationError('Invalid user role.');
  }

  private static canManage(actor: AuthenticatedSession, targetRole: string): boolean {
    if (actor.role === 'Owner') return true;
    return actor.role === 'Admin' && targetRole !== 'Owner' && targetRole !== 'Admin';
  }

  private static assertRateAllowed(keys: string[]): void {
    const now = Date.now();
    for (const key of keys) {
      const bucket = loginBuckets.get(key);
      if (bucket && bucket.blockedUntil > now) throw new SecurityViolationError('Too many login attempts. Try again later.');
    }
  }

  private static recordRateFailure(keys: string[]): void {
    const now = Date.now();
    for (const key of keys) {
      const bucket = loginBuckets.get(key);
      const next = !bucket || now - bucket.windowStart > RATE_WINDOW_MS
        ? { count: 1, windowStart: now, blockedUntil: 0 }
        : { ...bucket, count: bucket.count + 1 };
      if (next.count >= RATE_LIMIT) next.blockedUntil = now + RATE_WINDOW_MS;
      loginBuckets.set(key, next);
    }
  }

  private static clearRateFailures(keys: string[]): void { keys.forEach((key) => loginBuckets.delete(key)); }

  static async provisionUser(actor: AuthenticatedSession, params: { email: string; name: string; role: string; password: string }): Promise<AuthUser> {
    this.assertProvisioningRole(params.role);
    if (actor.role !== 'Owner' && actor.role !== 'Admin') throw new SecurityViolationError('Only Owner or Admin can provision users.');
    if (!this.canManage(actor, params.role)) throw new SecurityViolationError('Admin cannot provision Owner or Admin accounts.');
    return this.createUser(actor, { id: `user-${randomUUID()}`, ...params });
  }

  static async listUsers(actor: AuthenticatedSession): Promise<Partial<AuthUser>[]> {
    if (actor.role !== 'Owner' && actor.role !== 'Admin') throw new SecurityViolationError('Only Owner or Admin can list users.');
    return db.listAuthUsers(actor.tenantId) as Promise<Partial<AuthUser>[]>;
  }

  static async updateUser(actor: AuthenticatedSession, userId: string, updates: { name?: string; role?: string; status?: 'ACTIVE' | 'DISABLED' }): Promise<void> {
    if (actor.role !== 'Owner' && actor.role !== 'Admin') throw new SecurityViolationError('Only Owner or Admin can update users.');
    if (updates.name !== undefined && (!updates.name.trim() || updates.name.length > 255)) throw new SecurityViolationError('Name must contain between 1 and 255 characters.');
    if (updates.status !== undefined && updates.status !== 'ACTIVE' && updates.status !== 'DISABLED') throw new SecurityViolationError('Invalid user status.');
    if (userId === actor.userId && (updates.role || updates.status)) throw new SecurityViolationError('You cannot change your own role or status.');
    if (updates.role) this.assertProvisioningRole(updates.role);
    const tenantUsers = await db.listAuthUsers(actor.tenantId); const target = tenantUsers.find((user) => user.id === userId);
    if (!target) throw new SecurityViolationError('User not found in the authenticated tenant.');
    if (!this.canManage(actor, updates.role || String(target.role))) throw new SecurityViolationError('This administrator cannot manage the target role.');
    if (target.role === 'Owner' && updates.status === 'DISABLED' && tenantUsers.filter((user) => user.role === 'Owner' && user.status === 'ACTIVE').length <= 1) throw new SecurityViolationError('The last active Owner cannot be disabled.');
    if (!await db.updateAuthUser(userId, actor.tenantId, updates)) throw new SecurityViolationError('User update failed.');
    if (updates.status === 'DISABLED' || updates.role) await db.revokeUserSessions(userId, actor.tenantId);
  }

  static async createUser(session: AuthenticatedSession, params: { id: string; email: string; name: string; role: string; password: string }): Promise<AuthUser> {
    this.assertProvisioningRole(params.role);
    const email = normalizeEmail(params.email);
    if (!email.includes('@')) throw new SecurityViolationError('A valid email is required.');
    if (await db.findUserByEmail(email)) throw new SecurityViolationError('A user with this email already exists.');
    const user: AuthUser = { id: params.id, tenantId: session.tenantId, email, name: params.name.trim(), role: params.role, status: 'ACTIVE', passwordHash: hashPassword(params.password), createdAt: new Date().toISOString(), mfaEnabled: false };
    return db.insertAuthUser(user) as Promise<AuthUser>;
  }

  static async beginMfaSetup(emailInput: string, password: string): Promise<{ email: string; secret: string; otpauthUrl: string }> {
    const email = normalizeEmail(emailInput); const user = await db.findUserByEmail(email) as AuthUser | null;
    if (!user || user.status !== 'ACTIVE' || !isSensitiveRole(user.role) || !verifyPassword(password, user.passwordHash)) throw new SecurityViolationError('Unable to start MFA setup.');
    const secret = base32Encode(randomBytes(20));
    await db.updateAuthSecurity(user.id, { mfaEnabled: false, mfaSecretCiphertext: encryptSecret(secret) });
    const issuer = encodeURIComponent('RecoverOS');
    return { email: user.email, secret, otpauthUrl: `otpauth://totp/${issuer}:${encodeURIComponent(user.email)}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30` };
  }

  static async confirmMfa(emailInput: string, password: string, code: string): Promise<void> {
    const email = normalizeEmail(emailInput); const user = await db.findUserByEmail(email) as AuthUser | null;
    if (!user || !user.mfaSecretCiphertext || !verifyPassword(password, user.passwordHash)) throw new SecurityViolationError('Unable to confirm MFA.');
    if (!verifyTotp(decryptSecret(user.mfaSecretCiphertext), code)) throw new SecurityViolationError('Invalid MFA code.');
    await db.updateAuthSecurity(user.id, { mfaEnabled: true });
  }

  static async authenticate(emailInput: string, password: string, otp?: string, ipAddress = 'unknown'): Promise<{ user: AuthUser; session: AuthenticatedSession }> {
    const email = normalizeEmail(emailInput); const keys = [`email:${email}`, `ip:${ipAddress}`];
    this.assertRateAllowed(keys);
    const user = await db.findUserByEmail(email) as AuthUser | null;
    const locked = user?.lockedUntil && Date.parse(user.lockedUntil) > Date.now();
    if (locked) throw new SecurityViolationError('Account temporarily locked. Try again later.');
    if (!user || user.status !== 'ACTIVE' || !verifyPassword(password, user.passwordHash)) {
      if (user) await db.recordFailedLogin(user.id, MAX_LOGIN_FAILURES, ACCOUNT_LOCK_MINUTES);
      this.recordRateFailure(keys);
      throw new SecurityViolationError('Invalid email or password.');
    }
    if (isSensitiveRole(user.role) && !user.mfaEnabled) throw new SecurityViolationError('MFA_ENROLLMENT_REQUIRED');
    if ((isSensitiveRole(user.role) || user.mfaEnabled) && (!otp || !user.mfaSecretCiphertext || !verifyTotp(decryptSecret(user.mfaSecretCiphertext), otp))) {
      await db.recordFailedLogin(user.id, MAX_LOGIN_FAILURES, ACCOUNT_LOCK_MINUTES); this.recordRateFailure(keys);
      throw new SecurityViolationError('Invalid MFA code.');
    }
    this.clearRateFailures(keys); await db.resetLoginProtection(user.id);
    const session = await SessionService.createSessionDurable({ userId: user.id, tenantId: user.tenantId, role: user.role, ttlMinutes: 120 });
    return { user, session };
  }

  static hashToken(token: string): string { return createHash('sha256').update(token, 'utf8').digest('hex'); }
}
