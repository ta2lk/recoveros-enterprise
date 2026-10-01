import { SupplierDisputePortalService, SupplierPortalClaim } from '../src/portal/supplierDisputePortal';
import { EncryptedDocumentStorage, EICAR_TEST_SIGNATURE } from '../src/storage/encryptedStorage';
import { AuditLogService } from '../src/db/auditLog';

let passed = 0;
let total = 0;
function assert(condition: boolean, name: string) {
  total++;
  if (condition) { passed++; console.log(`  ✓ [PASS] ${name}`); }
  else { console.error(`  ✗ [FAIL] ${name}`); process.exitCode = 1; }
}
async function expectFailure(fn: () => unknown | Promise<unknown>, name: string) {
  let failed = false;
  try { await fn(); } catch { failed = true; }
  assert(failed, name);
}

console.log('--- RecoverOS Phase 5 Supplier Dispute Portal ---');
SupplierDisputePortalService.clear();
EncryptedDocumentStorage.clear();
const operator = { sessionId: 'sess-op', userId: 'u-operator', tenantId: 'tenant-a', role: 'Finance Manager', expiresAt: Date.now() + 60_000 };
const claim: SupplierPortalClaim = {
  claimId: 'claim-portal-1', claimNumber: 'REC-PORTAL-1', tenantId: 'tenant-a', supplierId: 'supplier-a', supplierName: 'Apex Industrial Supplies', amountMinor: 125000n, currency: 'USD', status: 'SUBMITTED',
};
const issued = SupplierDisputePortalService.issueMagicLink({ operatorSession: operator, claim, supplierEmail: 'ar@apex.example', baseUrl: 'https://recoveros.example' });
assert(issued.url.startsWith('https://recoveros.example/supplier-portal/access?token=ml_'), 'Magic Link is generated with opaque token and expiry');
assert(!issued.url.includes('tenant-a') && !issued.url.includes('supplier-a'), 'Magic Link does not expose tenant or supplier identifiers');
const rawMagicToken = decodeURIComponent(issued.url.split('token=')[1]);
const portal = SupplierDisputePortalService.redeemMagicLink(rawMagicToken);
assert(portal.claim.claimId === claim.claimId && portal.portalToken.startsWith('pt_'), 'Magic Link redeems into scoped portal session');
await expectFailure(() => SupplierDisputePortalService.redeemMagicLink(rawMagicToken), 'Magic Link is single-use after redemption');
await expectFailure(() => SupplierDisputePortalService.authenticatePortalToken(portal.portalToken, 'claim-other'), 'Portal token cannot be switched to another claim');

const rejection = SupplierDisputePortalService.respond({ portalToken: portal.portalToken, claimId: claim.claimId, action: 'REJECT', reason: 'Invoice was already credited under CM-7788.' });
assert(rejection.action === 'REJECT' && rejection.reason?.includes('CM-7788') === true, 'Supplier rejection is recorded with mandatory reason');
await expectFailure(() => SupplierDisputePortalService.respond({ portalToken: portal.portalToken, claimId: claim.claimId, action: 'REJECT' }), 'Rejection without reason is blocked');
const counter = SupplierDisputePortalService.respond({ portalToken: portal.portalToken, claimId: claim.claimId, action: 'COUNTER_OFFER', counterOfferMinor: 100000n, reason: 'Partial credit memo offered.' });
assert(counter.counterOfferMinor === 100000n, 'Counter-offer is recorded using integer minor units');

const proof = await SupplierDisputePortalService.uploadCreditMemo({ portalToken: portal.portalToken, claimId: claim.claimId, fileName: 'credit-memo.pdf', mimeType: 'application/pdf', base64Content: Buffer.from('signed credit memo').toString('base64') });
assert(proof.documentId.startsWith('doc-tenant-a-') && proof.sha256.length === 64, 'Credit Memo is encrypted, tenant-scoped and hashed');
await expectFailure(() => SupplierDisputePortalService.uploadCreditMemo({ portalToken: portal.portalToken, claimId: claim.claimId, fileName: 'malware.pdf', mimeType: 'application/pdf', base64Content: Buffer.from(EICAR_TEST_SIGNATURE).toString('base64') }), 'Malicious Credit Memo is rejected by antivirus hook');

const audit = AuditLogService.verifyChainIntegrity('tenant-a');
assert(audit.isValid && audit.totalEntriesVerified >= 4, 'Portal actions are written to an intact audit chain');
console.log(`Phase 5 result: ${passed}/${total} passed`);
if (passed !== total) process.exitCode = 1;
