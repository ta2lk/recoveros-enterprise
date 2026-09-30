/**
 * RecoverOS - Enterprise Authentication & Multi-Factor Authentication (MFA)
 * 
 * Rules:
 * 1. Passwords hashed using standard cryptographic key derivation (Argon2 / Scrypt / PBKDF2) with salt.
 * 2. Timing-safe comparison to prevent side-channel timing attacks.
 * 3. Multi-Factor Authentication (MFA/TOTP RFC 6238) strictly REQUIRED for Owner, Admin, and Finance Manager.
 */

import { scryptSync, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';
import { SecurityViolationError } from '../db/client';

export const ROLES_REQUIRING_MFA = new Set(['Owner', 'Admin', 'Finance Manager']);

export interface UserCredentials {
  userId: string;
  email: string;
  tenantId: string;
  role: string;
  passwordHash: string;
  salt: string;
  mfaSecret?: string;
  mfaEnabled: boolean;
}

export class CryptoAuthService {
  private static users: Map<string, UserCredentials> = new Map();

  /**
   * Derive secure password hash using Scrypt (Argon2id-grade memory-hard key derivation)
   */
  static hashPassword(password: string, salt?: string): { hash: string; salt: string } {
    const effectiveSalt = salt || randomBytes(16).toString('hex');
    const derivedKey = scryptSync(password, effectiveSalt, 64, {
      N: 16384, // CPU/memory cost
      r: 8,
      p: 1,
    });
    return {
      hash: derivedKey.toString('hex'),
      salt: effectiveSalt,
    };
  }

  /**
   * Timing-safe verification of password
   */
  static verifyPassword(password: string, storedHash: string, salt: string): boolean {
    const derived = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
    const storedBuf = Buffer.from(storedHash, 'hex');
    if (derived.length !== storedBuf.length) return false;
    return timingSafeEqual(derived, storedBuf);
  }

  /**
   * Register a user with credentials and enforce MFA registration for privileged roles
   */
  static registerUser(params: {
    userId: string;
    email: string;
    tenantId: string;
    role: string;
    password: string;
    mfaSecret?: string;
  }): UserCredentials {
    const { hash, salt } = this.hashPassword(params.password);
    const requiresMfa = ROLES_REQUIRING_MFA.has(params.role);

    // If user has a privileged role, MFA must be enabled
    const mfaSecret = params.mfaSecret || (requiresMfa ? randomBytes(20).toString('hex') : undefined);
    const mfaEnabled = requiresMfa || !!params.mfaSecret;

    const user: UserCredentials = {
      userId: params.userId,
      email: params.email.toLowerCase(),
      tenantId: params.tenantId,
      role: params.role,
      passwordHash: hash,
      salt,
      mfaSecret,
      mfaEnabled,
    };

    this.users.set(user.userId, user);
    return user;
  }

  /**
   * Generate RFC 6238 TOTP 6-digit code for a secret and timestamp window (30-second step)
   */
  static generateTotpCode(secretHex: string, timestampMs: number = Date.now()): string {
    const timeStep = Math.floor(timestampMs / 1000 / 30);
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(BigInt(timeStep), 0);

    const hmac = createHmac('sha1', Buffer.from(secretHex, 'hex'));
    hmac.update(buffer);
    const digest = hmac.digest();

    const offset = digest[digest.length - 1] & 0xf;
    const code =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);

    const otp = (code % 1000000).toString().padStart(6, '0');
    return otp;
  }

  /**
   * Verify TOTP code with +-1 time window tolerance (90 seconds total)
   */
  static verifyTotp(secretHex: string, token: string, timestampMs: number = Date.now()): boolean {
    const currentWindow = Math.floor(timestampMs / 1000 / 30);
    for (const offset of [-1, 0, 1]) {
      const stepTime = (currentWindow + offset) * 30 * 1000;
      const expected = this.generateTotpCode(secretHex, stepTime);
      if (token.trim() === expected) {
        return true;
      }
    }
    return false;
  }

  /**
   * Authenticate user with password and enforce MFA for privileged roles
   */
  static authenticate(params: {
    userId: string;
    password: string;
    mfaCode?: string;
  }): { success: boolean; requiresMfa?: boolean; user?: UserCredentials; error?: string } {
    const user = this.users.get(params.userId);
    if (!user) {
      return { success: false, error: 'INVALID_CREDENTIALS: User not found' };
    }

    const passwordValid = this.verifyPassword(params.password, user.passwordHash, user.salt);
    if (!passwordValid) {
      return { success: false, error: 'INVALID_CREDENTIALS: Password incorrect' };
    }

    // Role-Based MFA Invariant: Owner, Admin, and Finance Manager MUST provide valid MFA
    if (ROLES_REQUIRING_MFA.has(user.role)) {
      if (!params.mfaCode) {
        return {
          success: false,
          requiresMfa: true,
          error: `MFA_REQUIRED: Role '${user.role}' requires multi-factor authentication (TOTP).`,
        };
      }

      if (!user.mfaSecret || !this.verifyTotp(user.mfaSecret, params.mfaCode)) {
        return {
          success: false,
          requiresMfa: true,
          error: 'MFA_INVALID: Provided 6-digit TOTP code is incorrect or expired.',
        };
      }
    }

    return { success: true, user };
  }

  static getUser(userId: string): UserCredentials | undefined {
    return this.users.get(userId);
  }

  static clear() {
    this.users.clear();
  }
}
