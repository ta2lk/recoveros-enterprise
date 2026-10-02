/**
 * RecoverOS - Session-Derived Authentication & Tenant Context Middleware
 * 
 * Rules:
 * 1. Tenant is derived from authenticated session token ONLY.
 * 2. NEVER trust client-provided x-tenant-id headers for authorization.
 * 3. Reject invalid or expired session tokens immediately (fail closed).
 */

import { Request, Response, NextFunction } from 'express';
import { AuthenticatedSession, SecurityViolationError } from '../db/client';
import { JwtManager } from './jwtManager';

export interface AuthenticatedRequest extends Request {
  sessionContext?: AuthenticatedSession;
}

export class SessionService {
  private static activeSessions: Map<string, AuthenticatedSession> = new Map();

  /**
   * Register an authenticated session (called upon successful SSO/login)
   */
  static createSession(params: {
    userId: string;
    tenantId: string;
    role: string;
    ttlMinutes?: number;
  }): AuthenticatedSession {
    const sessionId = `sess-${params.tenantId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const ttl = (params.ttlMinutes || 60) * 60 * 1000;
    const session: AuthenticatedSession = {
      sessionId,
      userId: params.userId,
      tenantId: params.tenantId,
      role: params.role,
      expiresAt: Date.now() + ttl,
    };

    this.activeSessions.set(sessionId, session);
    return session;
  }

  /**
   * Validate and retrieve session
   */
  static getSession(token: string): AuthenticatedSession | null {
    if (!token) return null;
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
    const session = this.activeSessions.get(cleanToken);
    if (!session) return null;

    if (Date.now() > session.expiresAt) {
      this.activeSessions.delete(cleanToken);
      return null;
    }

    return session;
  }

  /**
   * Revoke session
   */
  static revokeSession(sessionId: string): boolean {
    return this.activeSessions.delete(sessionId);
  }

  /**
   * Clear all sessions (testing only)
   */
  static clear() {
    this.activeSessions.clear();
  }
}

/**
 * Express Middleware: Enforce session-derived tenant context
 */
export function requireSessionAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({
      error: 'UNAUTHORIZED: Missing Authorization Bearer token. Tenant context cannot be established.',
    });
  }

  let session = SessionService.getSession(authHeader);
  if (!session) {
    try {
      const payload = JwtManager.verifyAccessToken(authHeader);
      session = {
        sessionId: payload.sessionId,
        userId: payload.userId,
        tenantId: payload.tenantId,
        role: payload.role,
        expiresAt: payload.exp * 1000,
      };
    } catch {
      session = null;
    }
  }
  if (!session) {
    return res.status(401).json({
      error: 'UNAUTHORIZED: Invalid or expired session token.',
    });
  }

  // Security Invariant Check: If client attempts to spoof a different tenant via header, reject immediately
  const headerTenant = req.headers['x-tenant-id'];
  if (headerTenant && headerTenant !== session.tenantId) {
    return res.status(403).json({
      error: `SECURITY_VIOLATION: Header tenant '${headerTenant}' conflicts with session tenant '${session.tenantId}'. Spoofing detected.`,
    });
  }

  req.sessionContext = session;
  next();
}
