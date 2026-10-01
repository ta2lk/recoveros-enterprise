import type { ClaimStatus } from '../types';

export interface ClaimTransitionContext {
  actorId: string;
  actorRole: string;
  reason?: string;
  isShadowMode?: boolean;
}

const transitions: Record<ClaimStatus, readonly ClaimStatus[]> = {
  DISCOVERED: ['VERIFIED', 'CANCELLED'],
  VERIFIED: ['READY', 'APPROVAL_REQUIRED', 'CANCELLED'],
  READY: ['SUBMITTED', 'APPROVAL_REQUIRED', 'CANCELLED'],
  APPROVAL_REQUIRED: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['ACKNOWLEDGED', 'NEGOTIATING', 'DISPUTED', 'EXPIRED'],
  ACKNOWLEDGED: ['NEGOTIATING', 'ACCEPTED', 'DISPUTED'],
  NEGOTIATING: ['ACCEPTED', 'DISPUTED', 'EXPIRED'],
  ACCEPTED: ['SETTLEMENT_PENDING', 'RECOVERED'],
  SETTLEMENT_PENDING: ['RECOVERED', 'DISPUTED'],
  RECOVERED: [],
  REJECTED: ['DISCOVERED'],
  DISPUTED: ['NEGOTIATING', 'REJECTED', 'ACCEPTED'],
  EXPIRED: ['DISCOVERED'],
  CANCELLED: [],
};

export class InvalidClaimTransitionError extends Error {
  constructor(from: ClaimStatus, to: ClaimStatus) {
    super(`CLAIM_TRANSITION_NOT_ALLOWED: ${from} -> ${to}`);
    this.name = 'InvalidClaimTransitionError';
  }
}

export function canTransitionClaim(from: ClaimStatus, to: ClaimStatus): boolean {
  return transitions[from]?.includes(to) ?? false;
}

export function transitionClaim(from: ClaimStatus, to: ClaimStatus, context: ClaimTransitionContext): ClaimStatus {
  if (!context.actorId || !context.actorRole) throw new Error('CLAIM_TRANSITION_ACTOR_REQUIRED');
  if (!canTransitionClaim(from, to)) throw new InvalidClaimTransitionError(from, to);
  if (['REJECTED', 'CANCELLED', 'DISPUTED'].includes(to) && !context.reason?.trim()) {
    throw new Error(`CLAIM_TRANSITION_REASON_REQUIRED: ${to}`);
  }
  return to;
}

export function allowedClaimTransitions(from: ClaimStatus): readonly ClaimStatus[] {
  return transitions[from] ?? [];
}
