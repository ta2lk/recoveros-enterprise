export type ApprovalTier = 'AUTONOMOUS' | 'SINGLE_HUMAN' | 'FOUR_EYES';

export interface ApprovalPolicy {
  autonomousAmountUsd: number;
  singleHumanAmountUsd: number;
  autonomousConfidencePercent: number;
  requireEvidenceForAutonomous: boolean;
  maxAutonomousDailyUsd?: number;
}

export interface ApprovalInput {
  amountUsd: number;
  confidencePercent: number;
  evidenceCount: number;
  dailyAutonomousUsedUsd?: number;
}

export interface ApprovalDecision {
  tier: ApprovalTier;
  approvalRequired: boolean;
  requiredApprovers: number;
  reason: string;
}

export function evaluateApproval(input: ApprovalInput, policy: ApprovalPolicy): ApprovalDecision {
  if (!Number.isFinite(input.amountUsd) || input.amountUsd < 0) throw new Error('APPROVAL_AMOUNT_INVALID');
  if (!Number.isFinite(input.confidencePercent) || input.confidencePercent < 0 || input.confidencePercent > 100) {
    throw new Error('APPROVAL_CONFIDENCE_INVALID');
  }
  const autonomousBudgetExceeded = policy.maxAutonomousDailyUsd !== undefined &&
    (input.dailyAutonomousUsedUsd ?? 0) + input.amountUsd > policy.maxAutonomousDailyUsd;
  const autonomousEligible = input.amountUsd < policy.autonomousAmountUsd &&
    input.confidencePercent >= policy.autonomousConfidencePercent &&
    (!policy.requireEvidenceForAutonomous || input.evidenceCount > 0) &&
    !autonomousBudgetExceeded;

  if (autonomousEligible) {
    return { tier: 'AUTONOMOUS', approvalRequired: false, requiredApprovers: 0, reason: 'Low value, high confidence, evidence and autonomous budget checks passed.' };
  }
  if (input.amountUsd < policy.singleHumanAmountUsd) {
    return { tier: 'SINGLE_HUMAN', approvalRequired: true, requiredApprovers: 1, reason: autonomousBudgetExceeded ? 'Autonomous daily limit exceeded.' : 'Human approval required by value or confidence policy.' };
  }
  return { tier: 'FOUR_EYES', approvalRequired: true, requiredApprovers: 2, reason: 'High-value claim requires two independent approvers.' };
}
