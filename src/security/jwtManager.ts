/**
 * RecoverOS - Short-Lived JWT & Rotating Refresh Token Manager
 * 
 * Rules:
 * 1. Access tokens are short-lived (15 minutes).
 * 2. Refresh tokens are single-use and rotate on every refresh.
 * 3. Token reuse detection: If an already-used refresh token is presented, the entire token family is revoked (theft prevention).
 * 4. Explicit session revocation mechanism.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { SecurityViolationError } from '../db/client';

export interface TokenPayload {
  jti: string;
  userId: string;
  tenantId: string;
  role: string;
  sessionId: string;
  exp: number; // Unix timestamp seconds
  iat: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export interface RefreshTokenRecord {
  token: string;
  userId: string;
  tenantId: string;
  sessionId: string;
  familyId: string;
  role: string;
  isUsed: boolean;
  expiresAt: number;
}

export class JwtManager {
  private static ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
  private static REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  // Active refresh tokens index: token -> record
  private static refreshTokens: Map<string, RefreshTokenRecord> = new Map();
  // Revoked sessions / families
  private static revokedSessionIds: Set<string> = new Set();
  private static revokedFamilyIds: Set<string> = new Set();

  private static jwtSecret(): Buffer {
    const configured = process.env.RECOVEROS_JWT_SECRET;
    if (configured && Buffer.byteLength(configured, 'utf8') >= 32) return Buffer.from(configured, 'utf8');
    if (process.env.NODE_ENV === 'test') return Buffer.from('test-only-recoveros-jwt-secret-DO-NOT-USE', 'utf8');
    throw new SecurityViolationError('RECOVEROS_JWT_SECRET is missing or shorter than 32 bytes.');
  }

  /**
   * Base64Url encoding
   */
  private static base64UrlEncode(data: string | Buffer): string {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }

  private static base64UrlDecode(str: string): string {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    return Buffer.from(base64, 'base64').toString('utf8');
  }

  /**
   * Sign a JWT access token with unique jti
   */
  static signAccessToken(payload: Omit<TokenPayload, 'exp' | 'iat' | 'jti'>, ttlSeconds?: number): string {
    const nowSec = Math.floor(Date.now() / 1000);
    const exp = nowSec + (ttlSeconds || this.ACCESS_TOKEN_TTL_SECONDS);
    const jti = randomBytes(12).toString('hex');

    const fullPayload: TokenPayload = {
      jti,
      ...payload,
      iat: nowSec,
      exp,
    };

    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(fullPayload));

    const signature = createHmac('sha256', this.jwtSecret())
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest();
    const encodedSignature = this.base64UrlEncode(signature);

    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
  }

  /**
   * Verify and decode a JWT access token
   */
  static verifyAccessToken(token: string): TokenPayload {
    const parts = token.trim().split('.');
    if (parts.length !== 3) {
      throw new SecurityViolationError('Malformed JWT token structure.');
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const expectedSignature = createHmac('sha256', this.jwtSecret())
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest();
    const actualSignature = Buffer.from(encodedSignature.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

    if (expectedSignature.length !== actualSignature.length || !timingSafeEqual(expectedSignature, actualSignature)) {
      throw new SecurityViolationError('Invalid JWT signature.');
    }

    const payload: TokenPayload = JSON.parse(this.base64UrlDecode(encodedPayload));

    // Check expiration
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp < nowSec) {
      throw new SecurityViolationError('JWT access token has expired.');
    }

    // Check if session has been explicitly revoked
    if (this.revokedSessionIds.has(payload.sessionId)) {
      throw new SecurityViolationError('Session has been revoked by security administrator.');
    }

    return payload;
  }

  /**
   * Issue a new token pair (Access Token + Refresh Token)
   */
  static issueTokenPair(params: {
    userId: string;
    tenantId: string;
    role: string;
    sessionId?: string;
    familyId?: string;
  }): TokenPair {
    const sessionId = params.sessionId || `sess-${params.tenantId}-${Date.now()}-${randomBytes(4).toString('hex')}`;
    const familyId = params.familyId || `fam-${randomBytes(8).toString('hex')}`;

    const accessToken = this.signAccessToken({
      userId: params.userId,
      tenantId: params.tenantId,
      role: params.role,
      sessionId,
    });

    const refreshToken = `rft-${randomBytes(32).toString('hex')}`;
    const record: RefreshTokenRecord = {
      token: refreshToken,
      userId: params.userId,
      tenantId: params.tenantId,
      sessionId,
      familyId,
      role: params.role,
      isUsed: false,
      expiresAt: Date.now() + this.REFRESH_TOKEN_TTL_MS,
    };

    this.refreshTokens.set(refreshToken, record);

    return {
      accessToken,
      refreshToken,
      expiresInSeconds: this.ACCESS_TOKEN_TTL_SECONDS,
    };
  }

  /**
   * Rotate refresh token: Single-use with theft detection
   */
  static rotateRefreshToken(oldRefreshToken: string): TokenPair {
    const record = this.refreshTokens.get(oldRefreshToken);

    if (!record) {
      throw new SecurityViolationError('Invalid refresh token.');
    }

    // Theft Detection: If token is already used, someone compromised the token chain!
    // Revoke the ENTIRE family immediately.
    if (record.isUsed || this.revokedFamilyIds.has(record.familyId)) {
      this.revokedFamilyIds.add(record.familyId);
      this.revokedSessionIds.add(record.sessionId);
      throw new SecurityViolationError(
        'SECURITY_BREACH_DETECTED: Reused refresh token detected! All sessions in this token family have been permanently revoked.'
      );
    }

    if (Date.now() > record.expiresAt) {
      this.refreshTokens.delete(oldRefreshToken);
      throw new SecurityViolationError('Refresh token has expired.');
    }

    // Invalidate old token
    record.isUsed = true;

    // Issue next token in the same family and session
    return this.issueTokenPair({
      userId: record.userId,
      tenantId: record.tenantId,
      role: record.role,
      sessionId: record.sessionId,
      familyId: record.familyId,
    });
  }

  /**
   * Explicitly revoke session
   */
  static revokeSession(sessionId: string): void {
    this.revokedSessionIds.add(sessionId);
  }

  /**
   * Clear (testing only)
   */
  static clear() {
    this.refreshTokens.clear();
    this.revokedSessionIds.clear();
    this.revokedFamilyIds.clear();
  }
}
