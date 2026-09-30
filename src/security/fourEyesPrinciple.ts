/**
 * RecoverOS - Four-Eyes Principle Enforcement
 * 
 * Rules:
 * 1. For claims exceeding the high-value threshold (default $5,000.00 / 500,000 cents),
 *    the user who created or discovered the claim CANNOT approve it.
 * 2. Approver must have an authorized privileged role ('Finance Manager', 'Admin', 'Owner').
 * 3. Violations throw SecurityViolationError and are logged as dual-control breach attempts.
 */

import { SecurityViolationError, AuthenticatedSession } from '../db/client';
import { Money } from '../engine/money';

export interface ClaimApprovalContext {
  claimId: string;
  claimAmountMinor: bigint;
  currency: string;
  createdByUserOrAgentId: string;
  approverSession: AuthenticatedSession;
  highValueThresholdMinor?: bigint;
}

export interface ClaimApprovalResult {
  approved: boolean;
  claimId: string;
  approverId: string;
  approverRole: string;
  dualControlVerified: boolean;
  approvalTimestamp: string;
}

export class FourEyesPrincipleEngine {
  // Default high-value threshold: $5,000.00 (500,000 minor units)
  private static DEFAULT_HIGH_VALUE_THRESHOLD = 500000n;

  /**
   * Enforce dual authorization before approving a recovery claim
   */
  static authorizeClaimApproval(params: ClaimApprovalContext): ClaimApprovalResult {
    const { claimId, claimAmountMinor, currency, createdByUserOrAgentId, approverSession } = params;
    const threshold = params.highValueThresholdMinor ?? this.DEFAULT_HIGH_VALUE_THRESHOLD;

    // 1. Role Authorization Check: Approver must be Owner, Admin, or Finance Manager
    const allowedRoles = ['Owner', 'Admin', 'Finance Manager'];
    if (!allowedRoles.includes(approverSession.role)) {
      throw new SecurityViolationError(
        `ROLE_DENIED: Role '${approverSession.role}' is not authorized to approve recovery claims. Required: ${allowedRoles.join(', ')}.`
      );
    }

    const claimMoney = Money.fromMinor(claimAmountMinor, currency);
    const thresholdMoney = Money.fromMinor(threshold, currency);

    // 2. High-Value Threshold Check & Four-Eyes Enforcement
    const exceedsThreshold = claimMoney.compare(thresholdMoney) > 0;

    if (exceedsThreshold) {
      // Four-Eyes Rule: Creator CANNOT approve
      if (approverSession.userId === createdByUserOrAgentId) {
        throw new SecurityViolationError(
          `FOUR_EYES_VIOLATION: Self-approval prohibited! Claim of ${claimMoney.toFormattedString()} exceeds threshold (${thresholdMoney.toFormattedString()}). The creator ('${createdByUserOrAgentId}') cannot approve their own claim.`
        );
      }
    }

    return {
      approved: true,
      claimId,
      approverId: approverSession.userId,
      approverRole: approverSession.role,
      dualControlVerified: exceedsThreshold,
      approvalTimestamp: new Date().toISOString(),
    };
  }
}
