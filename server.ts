import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { BenchmarkEvaluator } from './src/engine/benchmark';
import { MatchingEngine } from './src/engine/matching';
import { PromptDefense } from './src/security/promptDefense';
import { ArchitecturalTestRunner } from './src/engine/architecturalTest';
import { requireSessionAuth, SessionService, AuthenticatedRequest } from './src/security/sessionAuth';
import { CryptoAuthService } from './src/security/cryptoAuth';
import { JwtManager } from './src/security/jwtManager';
import { FourEyesPrincipleEngine } from './src/security/fourEyesPrinciple';
import { PromptInjectionShield } from './src/security/promptInjectionShield';
import { applySecurityHeaders, rateLimitByIp, authIpLimiter, portalIpLimiter } from './src/security/rateLimiter';
import { AuditLogService } from './src/db/auditLog';
import { IngestionQueueService } from './src/ingestion/queue';
import { EncryptedDocumentStorage } from './src/storage/encryptedStorage';
import { db } from './src/db/client';
import { SupplierDisputePortalService, SupplierPortalError, SupplierPortalClaim } from './src/portal/supplierDisputePortal';
import { WebhookDispatcherService } from './src/events/webhookDispatcher';
import { SettlementAgreementService } from './src/settlement/settlementAgreement';
import { assertProductionConfiguration } from './src/config/productionGuard';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === 'true');

assertProductionConfiguration();

// Security Headers (Helmet Equivalent)
app.use(applySecurityHeaders);

// Body parser with size limits
app.use(express.json({ limit: '10mb', strict: true }));

// General IP Rate Limiting
app.use(rateLimitByIp());

// Liveness & Readiness Checks
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'HEALTHY', timestamp: new Date().toISOString() });
});

app.get('/ready', (req, res) => {
  res.status(200).json({ status: 'READY', services: ['database', 'matching-engine', 'agents', 'ingestion-queue', 'security-shield'] });
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
    mfaEnforced: true,
    fourEyesEnforced: true,
  });
});

// ---------------------------------------------------------------------------
// Supplier Dispute Portal: one-time Magic Links, portal sessions and evidence
// ---------------------------------------------------------------------------
app.post('/api/v1/supplier-portal/magic-links', requireSessionAuth, (req: AuthenticatedRequest, res) => {
  const session = req.sessionContext!;
  const { claim, supplierEmail, baseUrl, ttlMs } = req.body as {
    claim: SupplierPortalClaim;
    supplierEmail: string;
    baseUrl?: string;
    ttlMs?: number;
  };
  if (!claim || !claim.claimId || !claim.tenantId || !claim.supplierId || !supplierEmail) {
    return res.status(400).json({ error: 'Missing claim, claimId, tenantId, supplierId, or supplierEmail' });
  }
  try {
    const result = SupplierDisputePortalService.issueMagicLink({
      operatorSession: session,
      claim,
      supplierEmail,
      baseUrl: baseUrl || `${req.protocol}://${req.get('host')}`,
      ttlMs,
    });
    res.status(201).json(result);
  } catch (err: any) {
    res.status(err.name === 'SecurityViolationError' ? 403 : 400).json({ error: err.message });
  }
});

app.get('/api/v1/supplier-portal/access', rateLimitByIp(portalIpLimiter), (req, res) => {
  try {
    if (typeof req.query.token !== 'string' || !req.query.token) throw new SupplierPortalError('MAGIC_LINK_INVALID', 'Magic link is required.');
    const session = SupplierDisputePortalService.redeemMagicLink(req.query.token);
    // Dispatch real-time webhook notification
    WebhookDispatcherService.dispatchEvent(session.claim.tenantId, 'supplier.portal.viewed', {
      claimId: session.claim.claimId,
      claimNumber: session.claim.claimNumber,
      supplierId: session.claim.supplierId,
      supplierName: session.claim.supplierName,
      viewedAt: new Date().toISOString(),
    });
    res.json(session);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

function portalTokenFromRequest(req: express.Request): string {
  const token = req.headers['x-supplier-portal-token'];
  return typeof token === 'string' ? token : '';
}

app.get('/api/v1/supplier-portal/claims/:claimId', rateLimitByIp(portalIpLimiter), (req, res) => {
  try {
    const token = portalTokenFromRequest(req);
    const access = SupplierDisputePortalService.authenticatePortalToken(token, req.params.claimId);
    res.json({ claim: access.claim, responses: SupplierDisputePortalService.listResponses(token, req.params.claimId) });
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

app.post('/api/v1/supplier-portal/claims/:claimId/respond', rateLimitByIp(portalIpLimiter), (req, res) => {
  try {
    const token = portalTokenFromRequest(req);
    const access = SupplierDisputePortalService.authenticatePortalToken(token, req.params.claimId);
    const result = SupplierDisputePortalService.respond({
      portalToken: token,
      claimId: req.params.claimId,
      action: req.body.action,
      reason: req.body.reason,
      counterOfferMinor: req.body.counterOfferMinor === undefined ? undefined : BigInt(req.body.counterOfferMinor),
      documentId: req.body.documentId,
    });

    // Dispatch webhook for dispute action
    WebhookDispatcherService.dispatchEvent(access.claim.tenantId, `supplier.dispute.${result.action.toLowerCase()}`, {
      claimId: result.claimId,
      claimNumber: access.claim.claimNumber,
      supplierId: access.claim.supplierId,
      supplierName: access.claim.supplierName,
      action: result.action,
      reason: result.reason,
      counterOfferMinor: result.counterOfferMinor?.toString(),
      documentId: result.documentId,
      respondedAt: result.createdAt,
    });

    // If accepted, auto-generate official settlement agreement draft
    let agreement;
    if (result.action === 'ACCEPT') {
      agreement = SettlementAgreementService.generateAgreement(access.session, {
        claimId: access.claim.claimId,
        claimNumber: access.claim.claimNumber,
        supplierId: access.claim.supplierId,
        supplierName: access.claim.supplierName,
        originalDiscrepancyAmountMinor: access.claim.amountMinor,
        settledAmountMinor: access.claim.amountMinor,
        currency: access.claim.currency,
        resolutionType: 'FULL_ACCEPTANCE',
      });
      WebhookDispatcherService.dispatchEvent(access.claim.tenantId, 'settlement.agreement.generated', {
        agreementId: agreement.id,
        claimId: access.claim.claimId,
        documentSha256: agreement.documentSha256,
        settledAmountMinor: agreement.settledAmountMinor.toString(),
      });
    }

    res.status(201).json({
      ...result,
      counterOfferMinor: result.counterOfferMinor?.toString(),
      settlementAgreementId: agreement?.id,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/v1/supplier-portal/claims/:claimId/credit-memo', rateLimitByIp(portalIpLimiter), async (req, res) => {
  try {
    const token = portalTokenFromRequest(req);
    const access = SupplierDisputePortalService.authenticatePortalToken(token, req.params.claimId);
    const result = await SupplierDisputePortalService.uploadCreditMemo({
      portalToken: token,
      claimId: req.params.claimId,
      fileName: req.body.fileName,
      mimeType: req.body.mimeType,
      base64Content: req.body.base64Content,
    });

    // Dispatch webhook for uploaded credit memo
    WebhookDispatcherService.dispatchEvent(access.claim.tenantId, 'supplier.credit_memo.uploaded', {
      claimId: req.params.claimId,
      supplierId: access.claim.supplierId,
      documentId: result.documentId,
      fileName: req.body.fileName,
      sha256: result.sha256,
      fileSizeBytes: result.fileSizeBytes,
    });

    res.status(201).json(result);
  } catch (err: any) {
    res.status(err.name === 'SecurityViolationError' ? 403 : 400).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Webhook Subscriptions & Dispatcher Endpoints
// ---------------------------------------------------------------------------
app.post('/api/v1/webhooks/subscriptions', requireSessionAuth, (req: AuthenticatedRequest, res) => {
  const session = req.sessionContext!;
  const { targetUrl, subscribedEvents, description } = req.body;
  try {
    const sub = WebhookDispatcherService.registerSubscription(session, {
      targetUrl,
      subscribedEvents: subscribedEvents || ['*'],
      description,
    });
    res.status(201).json(sub);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/v1/webhooks/subscriptions', requireSessionAuth, (req: AuthenticatedRequest, res) => {
  const session = req.sessionContext!;
  const subs = WebhookDispatcherService.listSubscriptions(session.tenantId);
  res.json({ subscriptions: subs });
});

app.delete('/api/v1/webhooks/subscriptions/:id', requireSessionAuth, (req: AuthenticatedRequest, res) => {
  const session = req.sessionContext!;
  const success = WebhookDispatcherService.deleteSubscription(session, req.params.id);
  res.json({ success });
});

app.get('/api/v1/webhooks/events', requireSessionAuth, (req: AuthenticatedRequest, res) => {
  const session = req.sessionContext!;
  const events = WebhookDispatcherService.listEventHistory(session.tenantId);
  res.json({ events });
});

app.get('/api/v1/webhooks/deliveries', requireSessionAuth, (req: AuthenticatedRequest, res) => {
  const session = req.sessionContext!;
  const deliveries = WebhookDispatcherService.listDeliveryLogs(session.tenantId);
  res.json({ deliveries });
});

app.post('/api/v1/webhooks/test-dispatch', requireSessionAuth, (req: AuthenticatedRequest, res) => {
  const session = req.sessionContext!;
  const { eventType, payload } = req.body;
  const dispatchResult = WebhookDispatcherService.dispatchEvent(
    session.tenantId,
    eventType || 'test.ping',
    payload || { message: 'RecoverOS Webhook Ping', timestamp: new Date().toISOString() }
  );
  res.json(dispatchResult);
});

// ---------------------------------------------------------------------------
// Official Settlement Agreements Endpoints
// ---------------------------------------------------------------------------
app.post('/api/v1/settlement/agreements', requireSessionAuth, (req: AuthenticatedRequest, res) => {
  const session = req.sessionContext!;
  const {
    claimId,
    claimNumber,
    supplierId,
    supplierName,
    creditorName,
    originalDiscrepancyAmountMinor,
    settledAmountMinor,
    currency,
    resolutionType,
  } = req.body;

  try {
    const agreement = SettlementAgreementService.generateAgreement(session, {
      claimId,
      claimNumber,
      supplierId,
      supplierName,
      creditorName,
      originalDiscrepancyAmountMinor: BigInt(originalDiscrepancyAmountMinor),
      settledAmountMinor: BigInt(settledAmountMinor),
      currency: currency || 'USD',
      resolutionType,
    });

    WebhookDispatcherService.dispatchEvent(session.tenantId, 'settlement.agreement.generated', {
      agreementId: agreement.id,
      claimId: agreement.claimId,
      documentSha256: agreement.documentSha256,
      settledAmountMinor: agreement.settledAmountMinor.toString(),
    });

    res.status(201).json({
      ...agreement,
      originalDiscrepancyAmountMinor: agreement.originalDiscrepancyAmountMinor.toString(),
      settledAmountMinor: agreement.settledAmountMinor.toString(),
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/v1/settlement/agreements/:id', requireSessionAuth, (req: AuthenticatedRequest, res) => {
  const session = req.sessionContext!;
  const ag = SettlementAgreementService.getAgreement(session.tenantId, req.params.id);
  if (!ag) return res.status(404).json({ error: 'Settlement agreement not found' });

  res.json({
    ...ag,
    originalDiscrepancyAmountMinor: ag.originalDiscrepancyAmountMinor.toString(),
    settledAmountMinor: ag.settledAmountMinor.toString(),
  });
});

app.get('/api/v1/settlement/agreements/claim/:claimId', requireSessionAuth, (req: AuthenticatedRequest, res) => {
  const session = req.sessionContext!;
  const ag = SettlementAgreementService.findAgreementByClaimId(session.tenantId, req.params.claimId);
  if (!ag) return res.status(404).json({ error: 'No settlement agreement found for claim' });

  res.json({
    ...ag,
    originalDiscrepancyAmountMinor: ag.originalDiscrepancyAmountMinor.toString(),
    settledAmountMinor: ag.settledAmountMinor.toString(),
  });
});

app.post('/api/v1/settlement/agreements/:id/sign-supplier', rateLimitByIp(portalIpLimiter), (req, res) => {
  const { supplierEmail, supplierSignerName } = req.body;
  if (!supplierEmail || !supplierSignerName) {
    return res.status(400).json({ error: 'Missing supplierEmail or supplierSignerName' });
  }

  try {
    const executed = SettlementAgreementService.signSupplierAgreement({
      agreementId: req.params.id,
      supplierEmail,
      supplierSignerName,
      ipAddress: req.ip || '127.0.0.1',
    });

    WebhookDispatcherService.dispatchEvent(executed.tenantId, 'settlement.agreement.executed', {
      agreementId: executed.id,
      claimId: executed.claimId,
      signerName: supplierSignerName,
      signedAt: executed.supplierSigner?.signedAt,
      signatureHash: executed.supplierSigner?.signatureHash,
    });

    res.json({
      ...executed,
      originalDiscrepancyAmountMinor: executed.originalDiscrepancyAmountMinor.toString(),
      settledAmountMinor: executed.settledAmountMinor.toString(),
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Phase 3: Authentication, JWT & Rotating Refresh Tokens
// ---------------------------------------------------------------------------
app.post('/api/v1/auth/login', rateLimitByIp(authIpLimiter), (req, res) => {
  const { userId, password, mfaCode } = req.body;
  if (!userId || !password) {
    return res.status(400).json({ error: 'Missing userId or password' });
  }

  const authResult = CryptoAuthService.authenticate({ userId, password, mfaCode });
  if (!authResult.success) {
    const statusCode = authResult.requiresMfa ? 403 : 401;
    return res.status(statusCode).json({
      error: authResult.error,
      requiresMfa: authResult.requiresMfa,
    });
  }

  const user = authResult.user!;
  const tokenPair = JwtManager.issueTokenPair({
    userId: user.userId,
    tenantId: user.tenantId,
    role: user.role,
  });

  AuditLogService.appendEntry(
    { sessionId: 'auth-event', userId: user.userId, tenantId: user.tenantId, role: user.role, expiresAt: 0 },
    {
      action: 'USER_AUTHENTICATED',
      targetEntity: 'USER',
      targetId: user.userId,
      payload: { role: user.role, mfaVerified: !!mfaCode },
    }
  );

  res.json({
    message: 'Authentication successful',
    user: {
      userId: user.userId,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    },
    ...tokenPair,
  });
});

app.post('/api/v1/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Missing refreshToken in request body' });
  }

  try {
    const newTokens = JwtManager.rotateRefreshToken(refreshToken);
    res.json(newTokens);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

app.post('/api/v1/auth/revoke', requireSessionAuth, (req: AuthenticatedRequest, res) => {
  const session = req.sessionContext!;
  JwtManager.revokeSession(session.sessionId);
  SessionService.revokeSession(session.sessionId);
  res.json({ message: 'Session successfully revoked' });
});

// Legacy test session setup endpoint: never expose this impersonation helper in production.
app.post('/api/v1/auth/session', (req, res) => {
  if (isProduction) return res.status(404).json({ error: 'Not found' });
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
// Phase 3: Four-Eyes Principle Claim Approval Endpoint
// ---------------------------------------------------------------------------
app.post('/api/v1/claims/:claimId/approve', requireSessionAuth, (req: AuthenticatedRequest, res) => {
  const session = req.sessionContext!;
  const { claimId } = req.params;
  const { claimAmountMinor, currency, createdByUserOrAgentId, highValueThresholdMinor } = req.body;

  if (!claimAmountMinor || !currency || !createdByUserOrAgentId) {
    return res.status(400).json({ error: 'Missing claimAmountMinor, currency, or createdByUserOrAgentId' });
  }

  try {
    const result = FourEyesPrincipleEngine.authorizeClaimApproval({
      claimId,
      claimAmountMinor: BigInt(claimAmountMinor),
      currency,
      createdByUserOrAgentId,
      approverSession: session,
      highValueThresholdMinor: highValueThresholdMinor ? BigInt(highValueThresholdMinor) : undefined,
    });

    AuditLogService.appendEntry(session, {
      action: 'CLAIM_DUAL_AUTHORIZED',
      targetEntity: 'CLAIM',
      targetId: claimId,
      payload: {
        claimAmountMinor,
        currency,
        creator: createdByUserOrAgentId,
        approver: session.userId,
        dualControlVerified: result.dualControlVerified,
      },
    });

    res.json(result);
  } catch (err: any) {
    res.status(err.name === 'SecurityViolationError' ? 403 : 400).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Phase 3: Prompt Injection Shield Endpoint
// ---------------------------------------------------------------------------
app.post('/api/v1/security/shield', (req, res) => {
  const { input } = req.body;
  if (!input) return res.status(400).json({ error: 'Missing input parameter' });

  const result = PromptInjectionShield.inspectAndIsolate(input);
  res.json(result);
});

// ---------------------------------------------------------------------------
// Cryptographic Audit Log Verification Endpoint
// ---------------------------------------------------------------------------
app.get('/api/v1/audit/verify', requireSessionAuth, (req: AuthenticatedRequest, res) => {
  const session = req.sessionContext!;
  const report = AuditLogService.verifyChainIntegrity(session.tenantId);
  res.json(report);
});

app.get('/api/v1/audit/entries', requireSessionAuth, (req: AuthenticatedRequest, res) => {
  const session = req.sessionContext!;
  const entries = AuditLogService.getEntries(session, 100);
  res.json({ entriesCount: entries.length, entries });
});

// ---------------------------------------------------------------------------
// Idempotent Ingestion Queue Endpoints
// ---------------------------------------------------------------------------
app.post('/api/v1/ingestion/jobs', requireSessionAuth, async (req: AuthenticatedRequest, res) => {
  const session = req.sessionContext!;
  try {
    const result = await IngestionQueueService.submitBatch(session, req.body);
    AuditLogService.appendEntry(session, {
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

app.get('/api/v1/ingestion/jobs/:jobId', requireSessionAuth, (req: AuthenticatedRequest, res) => {
  const session = req.sessionContext!;
  try {
    const job = IngestionQueueService.getJob(session, req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

app.get('/api/v1/ingestion/dead-letter', requireSessionAuth, (req: AuthenticatedRequest, res) => {
  const session = req.sessionContext!;
  const entries = IngestionQueueService.getDeadLetters(session);
  res.json({ deadLettersCount: entries.length, entries });
});

// ---------------------------------------------------------------------------
// Encrypted Document Object Storage Endpoints
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

    AuditLogService.appendEntry(session, {
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
  try {
    const results = BenchmarkEvaluator.runBenchmark();
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/v1/architecture/run', async (req, res) => {
  try {
    const report = await ArchitecturalTestRunner.runFullArchitecturalAudit();
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/v1/security/sanitize', (req, res) => {
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
if (process.env.NODE_ENV === 'production') {
  app.listen(port, () => {
    console.log(`RecoverOS Enterprise Server listening on port ${port}`);
  });
}

export default app;
