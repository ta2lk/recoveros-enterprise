import { createHash, randomBytes } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedSession, SecurityViolationError, db } from '../db/client';

export interface AuthenticatedRequest extends Request {
  sessionContext?: AuthenticatedSession;
}

interface DurableSessionRecord {
  id: string;
  tenantId: string;
  userId: string;
  role: string;
  tokenHash: string;
  expiresAt: number;
  createdAt: string;
  revokedAt?: string;
}

export class SessionService {
  private static activeSessions: Map<string, AuthenticatedSession> = new Map();

  static createSession(params: {
    userId: string;
    tenantId: string;
    role: string;
    ttlMinutes?: number;
  }): AuthenticatedSession {
    const sessionId = `sess-${params.tenantId}-${Date.now()}-${randomBytes(16).toString('hex')}`;
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

  static async createSessionDurable(params: {
    userId: string;
    tenantId: string;
    role: string;
    ttlMinutes?: number;
  }): Promise<AuthenticatedSession> {
    const token = randomBytes(32).toString('base64url');
    const ttl = (params.ttlMinutes || 60) * 60 * 1000;
    const session: AuthenticatedSession = {
      sessionId: token,
      userId: params.userId,
      tenantId: params.tenantId,
      role: params.role,
      expiresAt: Date.now() + ttl,
    };
    const record: DurableSessionRecord = {
      id: `session-${params.tenantId}-${randomBytes(12).toString('hex')}`,
      tenantId: params.tenantId,
      userId: params.userId,
      role: params.role,
      tokenHash: createHash('sha256').update(token, 'utf8').digest('hex'),
      expiresAt: session.expiresAt,
      createdAt: new Date().toISOString(),
    };
    await db.insertAuthSession(record);
    return session;
  }

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

  static async getSessionDurable(token: string): Promise<AuthenticatedSession | null> {
    if (!token) return null;
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
    if (!cleanToken || cleanToken.length < 32) return null;
    const record = await db.findSessionByTokenHash(createHash('sha256').update(cleanToken, 'utf8').digest('hex')) as DurableSessionRecord | null;
    if (!record || record.revokedAt || Date.now() > record.expiresAt) return null;
    return {
      sessionId: cleanToken,
      userId: record.userId,
      tenantId: record.tenantId,
      role: record.role,
      expiresAt: record.expiresAt,
    };
  }

  static revokeSession(sessionId: string): boolean {
    return this.activeSessions.delete(sessionId);
  }

  static async revokeSessionDurable(session: AuthenticatedSession): Promise<boolean> {
    const record = await db.findSessionByTokenHash(createHash('sha256').update(session.sessionId, 'utf8').digest('hex'));
    if (!record) return false;
    return db.revokeAuthSession(record.id);
  }

  static clear() {
    this.activeSessions.clear();
  }
}

export async function requireSessionAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'UNAUTHORIZED: Missing Authorization Bearer token.' });
  }

  const session = db.usesPostgres
    ? await SessionService.getSessionDurable(authHeader)
    : SessionService.getSession(authHeader);
  if (!session) {
    return res.status(401).json({ error: 'UNAUTHORIZED: Invalid or expired session token.' });
  }

  const headerTenant = req.headers['x-tenant-id'];
  if (headerTenant && headerTenant !== session.tenantId) {
    return res.status(403).json({
      error: `SECURITY_VIOLATION: Header tenant '${headerTenant}' conflicts with session tenant '${session.tenantId}'.`,
    });
  }

  req.sessionContext = session;
  next();
}
