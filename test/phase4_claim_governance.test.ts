import { evaluateApproval } from '../src/engine/approvalMatrix';
import { canTransitionClaim, transitionClaim } from '../src/engine/claimLifecycle';
import { ShadowModeRecorder } from '../src/engine/shadowMode';
import { detectPaymentTermsConflict } from '../src/engine/paymentTermsConflict';

let passed = 0;
let total = 0;
function assert(condition: boolean, name: string) {
  total++;
  if (condition) { passed++; console.log(`  ✓ [PASS] ${name}`); }
  else { console.error(`  ✗ [FAIL] ${name}`); process.exitCode = 1; }
}

console.log('--- RecoverOS Phase 4 Claim Governance ---');
const policy = { autonomousAmountUsd: 250, singleHumanAmountUsd: 5000, autonomousConfidencePercent: 95, requireEvidenceForAutonomous: true, maxAutonomousDailyUsd: 1000 };
const autonomous = evaluateApproval({ amountUsd: 100, confidencePercent: 99, evidenceCount: 3, dailyAutonomousUsedUsd: 0 }, policy);
assert(autonomous.tier === 'AUTONOMOUS' && autonomous.requiredApprovers === 0, 'Low-value high-confidence claim can use autonomous tier');
const human = evaluateApproval({ amountUsd: 1000, confidencePercent: 99, evidenceCount: 3 }, policy);
assert(human.tier === 'SINGLE_HUMAN' && human.requiredApprovers === 1, 'Medium claim requires one human approver');
const fourEyes = evaluateApproval({ amountUsd: 5000, confidencePercent: 99, evidenceCount: 3 }, policy);
assert(fourEyes.tier === 'FOUR_EYES' && fourEyes.requiredApprovers === 2, 'High-value claim requires four-eyes approval');
const budgetBlocked = evaluateApproval({ amountUsd: 100, confidencePercent: 99, evidenceCount: 3, dailyAutonomousUsedUsd: 950 }, policy);
assert(budgetBlocked.tier === 'SINGLE_HUMAN', 'Autonomous daily budget prevents silent over-approval');

assert(canTransitionClaim('DISCOVERED', 'VERIFIED'), 'FSM permits discovered to verified');
assert(!canTransitionClaim('DISCOVERED', 'SUBMITTED'), 'FSM blocks discovered to submitted shortcut');
assert(transitionClaim('APPROVAL_REQUIRED', 'APPROVED', { actorId: 'u-1', actorRole: 'Finance Manager' }) === 'APPROVED', 'FSM records authorized approval transition');
let reasonRequired = false;
try { transitionClaim('APPROVAL_REQUIRED', 'REJECTED', { actorId: 'u-1', actorRole: 'Finance Manager' }); } catch { reasonRequired = true; }
assert(reasonRequired, 'FSM requires reason for rejection');

const recorder = new ShadowModeRecorder();
const decision = recorder.record({ tenantId: 'tenant-a', agentName: 'Claim Agent', recommendedAction: 'DISPATCH', confidencePercent: 97, evidenceIds: ['ev-1'], simulatedAmount: 125, currency: 'USD' });
assert(decision.mode === 'SHADOW' && recorder.list('tenant-a').length === 1, 'Shadow mode records without a live dispatch');
const evaluation = recorder.evaluate('tenant-a', new Map([[decision.id, 'CORRECT']]));
assert(evaluation.precision === 1 && evaluation.evaluatedDecisions === 1, 'Shadow decisions can be evaluated against human outcomes');

const conflict = detectPaymentTermsConflict({ invoiceId: 'inv-1', contractTerms: 'Net 60', systemTerms: 'Net 30', invoiceDate: '2026-01-01', paymentDate: '2026-01-20', invoiceAmount: 10000, currency: 'USD' });
assert(conflict.conflict && conflict.earlyPaymentDays === 41, 'Payment terms conflict and early settlement are detected');
const aligned = detectPaymentTermsConflict({ invoiceId: 'inv-2', contractTerms: 'Net 30', systemTerms: 'Net 30', invoiceDate: '2026-01-01', paymentDate: '2026-01-31', invoiceAmount: 10000, currency: 'USD' });
assert(!aligned.conflict, 'Aligned payment terms are not flagged');

console.log(`Phase 4 result: ${passed}/${total} passed`);
if (passed !== total) process.exitCode = 1;
