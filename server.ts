import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { BenchmarkEvaluator } from './src/engine/benchmark';
import { MatchingEngine } from './src/engine/matching';
import { PromptDefense } from './src/security/promptDefense';
import { ArchitecturalTestRunner } from './src/engine/architecturalTest';
import { requireSessionAuth, SessionService, AuthenticatedRequest } from './src/security/sessionAuth';
import { AuthUserService } from './src/security/authService';
import { AuditLogService } from './src/db/auditLog';
import { IngestionQueueService } from './src/ingestion/queue';
import { EncryptedDocumentStorage } from './src/storage/encryptedStorage';
import { db } from './src/db/client';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const isTestMode = process.env.RECOVEROS_TEST_MODE === 'true';

const appendAudit = (session: AuthenticatedRequest['sessionContext'], entryData: any) => {
  if (!session) throw new Error('Missing authenticated session.');
  return db.usesPostgres
    ? AuditLogService.appendEntryDurable(session, entryData)
    : Promise.resolve(AuditLogService.appendEntry(session, entryData));
};

if (isProduction && !/^[0-9a-fA-F]{64}$/.test(process.env.RECOVEROS_MASTER_KEK_HEX || '')) {
  throw new Error('RECOVEROS_MASTER_KEK_HEX must be configured as a 32-byte hex secret before production startup.');
}

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'; base-uri 'self'");
  next();
});
app.use(express.json({ limit: '10mb' }));

// Liveness & Readiness Checks (Section 42)
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'HEALTHY', timestamp: new Date().toISOString() });
});

app.get('/ready', async (req, res) => {
  const database = await db.checkHealth();
  const ready = database.connected && (isProduction ? database.mode === 'postgres' : true);
  res.status(ready ? 200 : 503).json({
    status: ready ? 'READY' : 'NOT_READY',
    database: database.connected ? 'CONNECTED' : 'DISCONNECTED',
    persistenceMode: database.mode,
    services: ['database', 'matching-engine', 'agents', 'ingestion-queue'],
  });
});

// API v1 Health & Metadata
app.get('/api/v1/health', (req, res) => {
  res.json({
    platform: 'RecoverOS',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'production',
    mode: 'AUTONOMOUS_ENTERPRISE_RECOVERY',
    auditLogImmutable: true,
    rlsEnforced: true,
  });
});

// ---------------------------------------------------------------------------
// Authentication & Session Endpoints
// ---------------------------------------------------------------------------
app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const { user, session } = await AuthUserService.authenticate(email, password);
    res.status(200).json({
      token: session.sessionId,
      expiresAt: session.expiresAt,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId },
    });
  } catch {
    res.status(401).json({ error: 'Invalid email or password.' });
  }
});

app.post('/api/v1/auth/logout', requireSessionAuth, async (req: AuthenticatedRequest, res) => {
  const session = req.sessionContext!;
  if (db.usesPostgres) await SessionService.revokeSessionDurable(session);
  else SessionService.revokeSession(session.sessionId);
  res.status(204).send();
});

app.post('/api/v1/auth/session', (req, res) => {
  if (isProduction || !isTestMode) {
    return res.status(404).json({ error: 'NOT_FOUND' });
  }
  const { userId, tenantId, role } = req.body;
  if (!userId || !tenantId || !role) {
    return res.status(400).json({ error: 'Missing userId, tenantId, or role in request body' });
  }

  const session = SessionService.createSession({ userId, tenantId, role, ttlMinutes: 120 });
  res.status(201).json({
    token: session.sessionId,
    expiresAt: session.expiresAt,
    tenantId: session.tenantId,
    role: session.role,
  });
});

// ---------------------------------------------------------------------------
// Cryptographic Audit Log Verification Endpoint (Phase 2 Requirement)
// ---------------------------------------------------------------------------
app.get('/api/v1/audit/verify', requireSessionAuth, async (req: AuthenticatedRequest, res) => {
  const session = req.sessionContext!;
  const report = db.usesPostgres
    ? await AuditLogService.verifyChainIntegrityDurable(session)
    : AuditLogService.verifyChainIntegrity(session.tenantId);
  res.json(report);
});

app.get('/api/v1/audit/entries', requireSessionAuth, async (req: AuthenticatedRequest, res) => {
  const session = req.sessionContext!;
  const entries = db.usesPostgres
    ? await AuditLogService.getEntriesDurable(session, 100)
    : AuditLogService.getEntries(session, 100);
  res.json({ entriesCount: entries.length, entries });
});

// ---------------------------------------------------------------------------
// Idempotent Ingestion Queue Endpoints (Phase 2 Requirement)
// ---------------------------------------------------------------------------
app.post('/api/v1/ingestion/jobs', requireSessionAuth, async (req: AuthenticatedRequest, res) => {
  const session = req.sessionContext!;
  try {
    const result = db.usesPostgres
      ? await IngestionQueueService.submitBatchDurable(session, req.body)
      : await IngestionQueueService.submitBatch(session, req.body);
    await appendAudit(session, {
      action: 'INGESTION_BATCH_SUBMITTED',
      targetEntity: 'INGESTION_JOB',
      targetId: result.job.id,
      payload: {
        idempotencyKey: result.job.idempotencyKey,
        recordCount: result.job.recordCount,
        isExisting: result.isExisting,
      },
    });

    res.status(result.isExisting ? 200 : 202).json({
      message: result.isExisting ? 'Batch already ingested (idempotent result)' : 'Batch accepted for processing',
      job: result.job,
      isExisting: result.isExisting,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/v1/ingestion/jobs/:jobId', requireSessionAuth, async (req: AuthenticatedRequest, res) => {
  const session = req.sessionContext!;
  try {
    const job = db.usesPostgres
      ? await IngestionQueueService.getJobDurable(session, req.params.jobId)
      : IngestionQueueService.getJob(session, req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

app.get('/api/v1/ingestion/dead-letter', requireSessionAuth, async (req: AuthenticatedRequest, res) => {
  const session = req.sessionContext!;
  const entries = db.usesPostgres
    ? await IngestionQueueService.getDeadLettersDurable(session)
    : IngestionQueueService.getDeadLetters(session);
  res.json({ deadLettersCount: entries.length, entries });
});

// ---------------------------------------------------------------------------
// Encrypted Document Object Storage Endpoints (Phase 2 Requirement)
// ---------------------------------------------------------------------------
app.post('/api/v1/storage/upload', requireSessionAuth, async (req: AuthenticatedRequest, res) => {
  const session = req.sessionContext!;
  const { fileName, mimeType, base64Content } = req.body;
  if (!fileName || !base64Content) {
    return res.status(400).json({ error: 'Missing fileName or base64Content' });
  }

  try {
    const rawBuffer = Buffer.from(base64Content, 'base64');
    const envelope = await EncryptedDocumentStorage.uploadDocument(session, fileName, mimeType || 'application/octet-stream', rawBuffer);

    await appendAudit(session, {
      action: 'DOCUMENT_ENCRYPTED_AND_STORED',
      targetEntity: 'DOCUMENT',
      targetId: envelope.documentId,
      payload: {
        fileName: envelope.fileName,
        sha256: envelope.sha256Hash,
        fileSizeBytes: envelope.fileSizeBytes,
      },
    });

    res.status(201).json({
      documentId: envelope.documentId,
      fileName: envelope.fileName,
      sha256: envelope.sha256Hash,
      fileSizeBytes: envelope.fileSizeBytes,
      virusScanPassed: envelope.virusScanPassed,
      envelopeEncrypted: true,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/v1/storage/download/:documentId', requireSessionAuth, async (req: AuthenticatedRequest, res) => {
  const session = req.sessionContext!;
  try {
    const decryptedBytes = await EncryptedDocumentStorage.downloadDocument(session, req.params.documentId);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(decryptedBytes);
  } catch (err: any) {
    res.status(err.name === 'SecurityViolationError' ? 403 : 404).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Dev/Test Diagnostic Endpoints
// ---------------------------------------------------------------------------
app.post('/api/v1/benchmark/run', (req, res) => {
  if (isProduction) return res.status(404).json({ error: 'NOT_FOUND' });
  try {
    const results = BenchmarkEvaluator.runBenchmark();
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/v1/architecture/run', async (req, res) => {
  if (isProduction) return res.status(404).json({ error: 'NOT_FOUND' });
  try {
    const report = await ArchitecturalTestRunner.runFullArchitecturalAudit();
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/v1/security/sanitize', (req, res) => {
  if (isProduction) return res.status(404).json({ error: 'NOT_FOUND' });
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Missing text parameter' });
  const sanitized = PromptDefense.sanitizeExternalData(text);
  res.json(sanitized);
});

// In production, serve static assets
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// If not in Vite dev mode, start server
if (db.usesPostgres) {
  await db.initialize();
}

if (isProduction) {
  app.listen(port, () => {
    console.log(`RecoverOS Enterprise Server listening on port ${port}`);
  });
}

export default app;
