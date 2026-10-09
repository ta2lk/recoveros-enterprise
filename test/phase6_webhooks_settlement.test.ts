import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WebhookDispatcherService } from '../src/events/webhookDispatcher';
import { SettlementAgreementService } from '../src/settlement/settlementAgreement';
import { AuthenticatedSession } from '../src/db/client';
import { AuditLogService } from '../src/db/auditLog';

console.log('\n===============================================================');
console.log('--- RECOVEROS: PHASE 6 WEBHOOKS & SETTLEMENT AGREEMENT SUITE ---');
console.log('===============================================================');

const testSession: AuthenticatedSession = {
  sessionId: 'sess_finance_officer',
  userId: 'usr_sarah_audit',
  tenantId: 'tenant_enterprise_xyz',
  role: 'Finance Manager',
  expiresAt: Date.now() + 3600000,
};

describe('Phase 6: Real-time Webhooks & Settlement Agreement Suite', () => {
  WebhookDispatcherService.clear();
  SettlementAgreementService.clear();

  // 1. Webhook HMAC-SHA256 Signatures & Tolerance
  it('[PASS] Webhook subscription registers with unique signing secret', () => {
    const sub = WebhookDispatcherService.registerSubscription(testSession, {
      targetUrl: 'https://enterprise.acme.corp/api/v1/recoveros-webhooks',
      subscribedEvents: ['supplier.dispute.accepted', 'supplier.credit_memo.uploaded'],
      description: 'Acme ERP Inbound Gateway',
    });

    assert.ok(sub.id.startsWith('whsub_'));
    assert.ok(sub.secret.startsWith('whsec_'));
    assert.equal(sub.targetUrl, 'https://enterprise.acme.corp/api/v1/recoveros-webhooks');
    assert.deepEqual(sub.subscribedEvents, ['supplier.dispute.accepted', 'supplier.credit_memo.uploaded']);
    console.log('  ✓ [PASS] Webhook subscription registers with unique signing secret');
  });

  it('[PASS] HMAC-SHA256 signature format strictly matches standard t=timestamp,v1=signature', () => {
    const secret = 'whsec_test_secret_key_8899';
    const payload = JSON.stringify({ event: 'test', amount: 5000 });
    const now = Date.now();
    const signatureHeader = WebhookDispatcherService.computeSignature(secret, payload, now);

    assert.ok(signatureHeader.startsWith(`t=${now},v1=`));
    const hmacPart = signatureHeader.split('v1=')[1];
    assert.equal(hmacPart.length, 64); // SHA-256 hex is 64 chars
    console.log('  ✓ [PASS] HMAC-SHA256 signature format strictly matches standard t=timestamp,v1=signature');
  });

  it('[PASS] Webhook signature verifies successfully for authentic message', () => {
    const secret = 'whsec_test_secret_key_8899';
    const payload = JSON.stringify({ event: 'supplier.dispute.accepted', claimId: 'clm-88' });
    const now = Date.now();
    const signatureHeader = WebhookDispatcherService.computeSignature(secret, payload, now);

    const verification = WebhookDispatcherService.verifySignature(secret, payload, signatureHeader);
    assert.equal(verification.isValid, true);
    assert.equal(verification.timestamp, now);
    assert.equal(verification.error, undefined);
    console.log('  ✓ [PASS] Webhook signature verifies successfully for authentic message');
  });

  it('[PASS] REPLAY DEFENSE: Stale signature exceeding tolerance window is rejected', () => {
    const secret = 'whsec_test_secret_key_8899';
    const payload = JSON.stringify({ event: 'supplier.dispute.accepted', claimId: 'clm-88' });
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const signatureHeader = WebhookDispatcherService.computeSignature(secret, payload, tenMinutesAgo);

    const verification = WebhookDispatcherService.verifySignature(secret, payload, signatureHeader, 5 * 60 * 1000);
    assert.equal(verification.isValid, false);
    assert.equal(verification.error, 'SIGNATURE_TIMESTAMP_EXPIRED');
    console.log('  ✓ [PASS] REPLAY DEFENSE: Stale signature exceeding tolerance window is rejected');
  });

  it('[PASS] TAMPER DEFENSE: Modified payload fails signature verification', () => {
    const secret = 'whsec_test_secret_key_8899';
    const originalPayload = JSON.stringify({ amount: 1000 });
    const tamperedPayload = JSON.stringify({ amount: 9999 });
    const now = Date.now();
    const signatureHeader = WebhookDispatcherService.computeSignature(secret, originalPayload, now);

    const verification = WebhookDispatcherService.verifySignature(secret, tamperedPayload, signatureHeader);
    assert.equal(verification.isValid, false);
    assert.equal(verification.error, 'SIGNATURE_MISMATCH');
    console.log('  ✓ [PASS] TAMPER DEFENSE: Modified payload fails signature verification');
  });

  it('[PASS] Webhook event dispatch streams events and updates delivery ledger', () => {
    const result = WebhookDispatcherService.dispatchEvent(testSession.tenantId, 'supplier.dispute.accepted', {
      claimId: 'clm-7701',
      claimNumber: 'CLM-7701-ACME',
      supplierName: 'Global Freight Logistics LLC',
      action: 'ACCEPT',
      amountMinor: '150000',
    });

    assert.ok(result.event.id.startsWith('wh_evt_'));
    assert.equal(result.event.eventType, 'supplier.dispute.accepted');
    assert.ok(result.deliveries.length >= 1);
    assert.equal(result.deliveries[0].status, 'DELIVERED');
    assert.equal(result.deliveries[0].statusCode, 200);
    assert.ok(result.deliveries[0].signatureHeader.includes('v1='));
    console.log('  ✓ [PASS] Webhook event dispatch streams events and updates delivery ledger');
  });

  // 2. Official Settlement Agreement Engine
  it('[PASS] Settlement Agreement generates with canonical text and exact BigInt minor units', () => {
    const agreement = SettlementAgreementService.generateAgreement(testSession, {
      claimId: 'clm-8802',
      claimNumber: 'CLM-8802-TECH',
      supplierId: 'sup-tech-99',
      supplierName: 'Apex Precision Tools Inc.',
      creditorName: 'RecoverOS Enterprise Client',
      originalDiscrepancyAmountMinor: 1250000n, // $12,500.00
      settledAmountMinor: 1250000n,
      currency: 'USD',
      resolutionType: 'FULL_ACCEPTANCE',
    });

    assert.ok(agreement.id.startsWith('agr_'));
    assert.equal(agreement.claimNumber, 'CLM-8802-TECH');
    assert.equal(agreement.originalDiscrepancyAmountMinor, 1250000n);
    assert.equal(agreement.settledAmountMinor, 1250000n);
    assert.equal(agreement.status, 'DRAFT');
    assert.ok(agreement.canonicalText.includes('Apex Precision Tools Inc.'));
    assert.ok(agreement.canonicalText.includes('$12,500.00'));
    assert.equal(agreement.documentSha256.length, 64);
    assert.ok(agreement.creditorSigner.signatureHash.length === 64);
    console.log('  ✓ [PASS] Settlement Agreement generates with canonical text and exact BigInt minor units');
  });

  it('[PASS] Counter-offer settlement reflects negotiated minor units', () => {
    const agreement = SettlementAgreementService.generateAgreement(testSession, {
      claimId: 'clm-8803',
      claimNumber: 'CLM-8803-NEGOTIATED',
      supplierId: 'sup-tech-99',
      supplierName: 'Apex Precision Tools Inc.',
      originalDiscrepancyAmountMinor: 2000000n, // $20,000.00
      settledAmountMinor: 1600000n,             // $16,000.00
      currency: 'USD',
      resolutionType: 'COUNTER_OFFER_ACCEPTED',
    });

    assert.equal(agreement.originalDiscrepancyAmountMinor, 2000000n);
    assert.equal(agreement.settledAmountMinor, 1600000n);
    assert.equal(agreement.resolutionType, 'COUNTER_OFFER_ACCEPTED');
    assert.ok(agreement.canonicalText.includes('$16,000.00 (1600000 minor units)'));
    console.log('  ✓ [PASS] Counter-offer settlement reflects negotiated minor units');
  });

  it('[PASS] Supplier Electronic Signature transitions agreement to EXECUTED with legal fingerprint', () => {
    const agreement = SettlementAgreementService.generateAgreement(testSession, {
      claimId: 'clm-8804',
      claimNumber: 'CLM-8804-SIGN',
      supplierId: 'sup-logistics',
      supplierName: 'Pacific Transport Systems',
      originalDiscrepancyAmountMinor: 450000n,
      settledAmountMinor: 450000n,
      currency: 'USD',
    });

    const executed = SettlementAgreementService.signSupplierAgreement({
      agreementId: agreement.id,
      supplierEmail: 'legal@pacifictransport.com',
      supplierSignerName: 'Robert Vance, VP Commercial',
      ipAddress: '198.51.100.42',
    });

    assert.equal(executed.status, 'EXECUTED');
    assert.ok(executed.supplierSigner);
    assert.equal(executed.supplierSigner.name, 'Robert Vance, VP Commercial');
    assert.equal(executed.supplierSigner.email, 'legal@pacifictransport.com');
    assert.equal(executed.supplierSigner.ipAddress, '198.51.100.42');
    assert.equal(executed.supplierSigner.signatureHash.length, 64);
    console.log('  ✓ [PASS] Supplier Electronic Signature transitions agreement to EXECUTED with legal fingerprint');
  });

  it('[PASS] Cryptographic integrity verification validates un-tampered settlement agreement', () => {
    const agreement = SettlementAgreementService.generateAgreement(testSession, {
      claimId: 'clm-8805',
      claimNumber: 'CLM-8805-VERIFY',
      supplierId: 'sup-delta',
      supplierName: 'Delta Materials Co',
      originalDiscrepancyAmountMinor: 800000n,
      settledAmountMinor: 800000n,
      currency: 'USD',
    });

    const check = SettlementAgreementService.verifyAgreementIntegrity(agreement);
    assert.equal(check.isValid, true);
    assert.equal(check.computedHash, agreement.documentSha256);
    console.log('  ✓ [PASS] Cryptographic integrity verification validates un-tampered settlement agreement');
  });

  it('[PASS] TAMPER DETECTED: Modifying canonical text invalidates document SHA-256 seal', () => {
    const agreement = SettlementAgreementService.generateAgreement(testSession, {
      claimId: 'clm-8806',
      claimNumber: 'CLM-8806-TAMPER',
      supplierId: 'sup-delta',
      supplierName: 'Delta Materials Co',
      originalDiscrepancyAmountMinor: 800000n,
      settledAmountMinor: 800000n,
      currency: 'USD',
    });

    const tamperedAgreement = {
      ...agreement,
      canonicalText: agreement.canonicalText + '\n[FRAUDULENT_AMENDMENT: WAIVE_ALL_RIGHTS]',
    };

    const check = SettlementAgreementService.verifyAgreementIntegrity(tamperedAgreement);
    assert.equal(check.isValid, false);
    assert.notEqual(check.computedHash, check.recordedHash);
    console.log('  ✓ [PASS] TAMPER DETECTED: Modifying canonical text invalidates document SHA-256 seal');
  });

  it('[PASS] Agreement lookup by claim ID successfully locates active agreement', () => {
    const found = SettlementAgreementService.findAgreementByClaimId(testSession.tenantId, 'clm-8805');
    assert.ok(found);
    assert.equal(found.claimNumber, 'CLM-8805-VERIFY');
    console.log('  ✓ [PASS] Agreement lookup by claim ID successfully locates active agreement');
  });
});
