/**
 * RecoverOS - Cryptographically Hash-Chained Append-Only Audit Log
 * 
 * Rules:
 * 1. Each entry stores hash of previous entry (H_n = SHA-256(H_{n-1} + timestamp + actor + action + payload)).
 * 2. Immutable: UPDATE and DELETE are strictly prohibited and throw SecurityViolationError.
 * 3. Verification function recalculates full chain integrity from genesis to tip.
 */

import { createHash } from 'node:crypto';
import { AuthenticatedSession, SecurityViolationError, db } from './client';

export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  sequenceNumber: number;
  timestamp: string;
  actorId: string;
  actorRole: string;
  action: string;
  targetEntity: string;
  targetId: string;
  payloadHash: string;
  previousHash: string;
  entryHash: string;
  metadata?: Record<string, any>;
}

export interface ChainVerificationReport {
  isValid: boolean;
  totalEntriesVerified: number;
  genesisHash: string;
  latestHash: string;
  tamperedSequenceNumber?: number;
  error?: string;
}

export class AuditLogService {
  // Tenant-scoped in-memory ledger representing table audit_log_entries
  private static ledgers: Map<string, AuditLogEntry[]> = new Map();

  /**
   * Compute SHA-256 hash of arbitrary string or buffer
   */
  static sha256(content: string): string {
    return createHash('sha256').update(content, 'utf8').digest('hex');
  }

  /**
   * Append new immutable log entry to the tenant's hash chain
   */
  static appendEntry(
    session: AuthenticatedSession,
    entryData: {
      action: string;
      targetEntity: string;
      targetId: string;
      payload: any;
      metadata?: Record<string, any>;
    }
  ): AuditLogEntry {
    if (!session || !session.tenantId) {
      throw new SecurityViolationError('Cannot append audit entry without authenticated session.');
    }

    const tenantId = session.tenantId;
    let chain = this.ledgers.get(tenantId);
    if (!chain) {
      chain = [];
      this.ledgers.set(tenantId, chain);
    }

    const previousEntry = chain.length > 0 ? chain[chain.length - 1] : null;
    const previousHash = previousEntry ? previousEntry.entryHash : GENESIS_HASH;
    const sequenceNumber = chain.length + 1;
    const timestamp = new Date().toISOString();

    const normalizedPayload = JSON.stringify(entryData.payload || {});
    const payloadHash = this.sha256(normalizedPayload);

    // Compute entry hash: SHA-256(previousHash + sequenceNumber + timestamp + tenantId + actorId + action + targetEntity + targetId + payloadHash)
    const rawToHash = [
      previousHash,
      sequenceNumber.toString(),
      timestamp,
      tenantId,
      session.userId,
      session.role,
      entryData.action,
      entryData.targetEntity,
      entryData.targetId,
      payloadHash,
    ].join('|');

    const entryHash = this.sha256(rawToHash);

    const logEntry: AuditLogEntry = {
      id: `audit-${tenantId}-${sequenceNumber}`,
      tenantId,
      sequenceNumber,
      timestamp,
      actorId: session.userId,
      actorRole: session.role,
      action: entryData.action,
      targetEntity: entryData.targetEntity,
      targetId: entryData.targetId,
      payloadHash,
      previousHash,
      entryHash,
      metadata: entryData.metadata,
    };

    chain.push(logEntry);
    return logEntry;
  }

  /**
   * Verify the integrity of the audit log chain for a tenant
   */
  static verifyChainIntegrity(tenantId: string): ChainVerificationReport {
    const chain = this.ledgers.get(tenantId) || [];
    if (chain.length === 0) {
      return {
        isValid: true,
        totalEntriesVerified: 0,
        genesisHash: GENESIS_HASH,
        latestHash: GENESIS_HASH,
      };
    }

    let expectedPrevHash = GENESIS_HASH;

    for (let i = 0; i < chain.length; i++) {
      const entry = chain[i];

      // 1. Verify sequence number
      if (entry.sequenceNumber !== i + 1) {
        return {
          isValid: false,
          totalEntriesVerified: i,
          genesisHash: GENESIS_HASH,
          latestHash: entry.entryHash,
          tamperedSequenceNumber: entry.sequenceNumber,
          error: `Broken sequence at index ${i}: expected #${i + 1}, found #${entry.sequenceNumber}`,
        };
      }

      // 2. Verify previous hash pointer
      if (entry.previousHash !== expectedPrevHash) {
        return {
          isValid: false,
          totalEntriesVerified: i,
          genesisHash: GENESIS_HASH,
          latestHash: entry.entryHash,
          tamperedSequenceNumber: entry.sequenceNumber,
          error: `Broken chain link at #${entry.sequenceNumber}: previousHash '${entry.previousHash}' does not match expected '${expectedPrevHash}'`,
        };
      }

      // 3. Recompute entry hash
      const rawToHash = [
        entry.previousHash,
        entry.sequenceNumber.toString(),
        entry.timestamp,
        entry.tenantId,
        entry.actorId,
        entry.actorRole,
        entry.action,
        entry.targetEntity,
        entry.targetId,
        entry.payloadHash,
      ].join('|');

      const computedHash = this.sha256(rawToHash);
      if (computedHash !== entry.entryHash) {
        return {
          isValid: false,
          totalEntriesVerified: i,
          genesisHash: GENESIS_HASH,
          latestHash: entry.entryHash,
          tamperedSequenceNumber: entry.sequenceNumber,
          error: `Tampered block detected at #${entry.sequenceNumber}! Stored hash '${entry.entryHash}' differs from recomputed '${computedHash}'`,
        };
      }

      expectedPrevHash = entry.entryHash;
    }

    return {
      isValid: true,
      totalEntriesVerified: chain.length,
      genesisHash: GENESIS_HASH,
      latestHash: chain[chain.length - 1].entryHash,
    };
  }

  /**
   * Retrieve audit logs with session-based tenant isolation
   */
  static getEntries(session: AuthenticatedSession, limit: number = 100): AuditLogEntry[] {
    if (!session || !session.tenantId) {
      throw new SecurityViolationError('Cannot retrieve audit log without authenticated session.');
    }
    const chain = this.ledgers.get(session.tenantId) || [];
    return [...chain].reverse().slice(0, limit);
  }

  /** PostgreSQL-backed append path used by the production API. */
  static async appendEntryDurable(
    session: AuthenticatedSession,
    entryData: {
      action: string;
      targetEntity: string;
      targetId: string;
      payload: any;
      metadata?: Record<string, any>;
    }
  ): Promise<AuditLogEntry> {
    if (!session || !session.tenantId) {
      throw new SecurityViolationError('Cannot append audit entry without authenticated session.');
    }
    const chain = await db.findMany<AuditLogEntry>('audit_log_entries', session);
    chain.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    const previousEntry = chain[chain.length - 1];
    const sequenceNumber = (previousEntry?.sequenceNumber || 0) + 1;
    const timestamp = new Date().toISOString();
    const previousHash = previousEntry?.entryHash || GENESIS_HASH;
    const payloadHash = this.sha256(JSON.stringify(entryData.payload || {}));
    const entryHash = this.sha256([
      previousHash, sequenceNumber.toString(), timestamp, session.tenantId,
      session.userId, session.role, entryData.action, entryData.targetEntity,
      entryData.targetId, payloadHash,
    ].join('|'));
    const entry: AuditLogEntry = {
      id: `audit-${session.tenantId}-${sequenceNumber}`,
      tenantId: session.tenantId,
      sequenceNumber,
      timestamp,
      actorId: session.userId,
      actorRole: session.role,
      action: entryData.action,
      targetEntity: entryData.targetEntity,
      targetId: entryData.targetId,
      payloadHash,
      previousHash,
      entryHash,
      metadata: entryData.metadata,
    };
    return db.insert('audit_log_entries', session, entry);
  }

  static async getEntriesDurable(session: AuthenticatedSession, limit: number = 100): Promise<AuditLogEntry[]> {
    const entries = await db.findMany<AuditLogEntry>('audit_log_entries', session);
    return entries.sort((a, b) => b.sequenceNumber - a.sequenceNumber).slice(0, limit);
  }

  static async verifyChainIntegrityDurable(session: AuthenticatedSession): Promise<ChainVerificationReport> {
    const entries = await db.findMany<AuditLogEntry>('audit_log_entries', session);
    const chain = entries.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    if (chain.length === 0) {
      return { isValid: true, totalEntriesVerified: 0, genesisHash: GENESIS_HASH, latestHash: GENESIS_HASH };
    }
    let expectedPrevHash = GENESIS_HASH;
    for (let i = 0; i < chain.length; i++) {
      const entry = chain[i];
      if (entry.sequenceNumber !== i + 1 || entry.previousHash !== expectedPrevHash) {
        return {
          isValid: false,
          totalEntriesVerified: i,
          genesisHash: GENESIS_HASH,
          latestHash: entry.entryHash,
          tamperedSequenceNumber: entry.sequenceNumber,
          error: `Broken chain at #${entry.sequenceNumber}`,
        };
      }
      const computedHash = this.sha256([
        entry.previousHash, entry.sequenceNumber.toString(), entry.timestamp,
        entry.tenantId, entry.actorId, entry.actorRole, entry.action,
        entry.targetEntity, entry.targetId, entry.payloadHash,
      ].join('|'));
      if (computedHash !== entry.entryHash) {
        return {
          isValid: false,
          totalEntriesVerified: i,
          genesisHash: GENESIS_HASH,
          latestHash: entry.entryHash,
          tamperedSequenceNumber: entry.sequenceNumber,
          error: `Tampered block detected at #${entry.sequenceNumber}`,
        };
      }
      expectedPrevHash = entry.entryHash;
    }
    return {
      isValid: true,
      totalEntriesVerified: chain.length,
      genesisHash: GENESIS_HASH,
      latestHash: chain[chain.length - 1].entryHash,
    };
  }

  /**
   * Explicitly deny UPDATE - throws SecurityViolationError
   */
  static updateEntry(): never {
    throw new SecurityViolationError('Audit logs are append-only. Modification of audit records is strictly prohibited.');
  }

  /**
   * Explicitly deny DELETE - throws SecurityViolationError
   */
  static deleteEntry(): never {
    throw new SecurityViolationError('Audit logs are append-only. Deletion of audit records is strictly prohibited.');
  }

  /**
   * Tamper with entry (testing helper ONLY to verify tamper detection)
   */
  static _tamperForTesting(tenantId: string, index: number, alteredAction: string) {
    const chain = this.ledgers.get(tenantId);
    if (chain && chain[index]) {
      chain[index].action = alteredAction; // Tamper without updating hash
    }
  }

  /**
   * Clear ledger (testing only)
   */
  static clear(tenantId?: string) {
    if (tenantId) this.ledgers.delete(tenantId);
    else this.ledgers.clear();
  }
}
