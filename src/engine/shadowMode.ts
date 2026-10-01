export interface ShadowDecision {
  id: string;
  tenantId: string;
  claimId?: string;
  agentName: string;
  recommendedAction: 'DISPATCH' | 'REQUEST_REVIEW' | 'REJECT';
  confidencePercent: number;
  evidenceIds: string[];
  simulatedAmount: number;
  currency: string;
  createdAt: string;
  mode: 'SHADOW';
}

export interface ShadowEvaluation {
  precision?: number;
  recall?: number;
  falsePositiveRate?: number;
  totalDecisions: number;
  evaluatedDecisions: number;
}

export class ShadowModeRecorder {
  private readonly decisions: ShadowDecision[] = [];

  record(decision: Omit<ShadowDecision, 'id' | 'createdAt' | 'mode'>): ShadowDecision {
    const saved: ShadowDecision = { ...decision, id: `shadow-${Date.now()}-${this.decisions.length}`, createdAt: new Date().toISOString(), mode: 'SHADOW' };
    this.decisions.push(saved);
    return saved;
  }

  list(tenantId: string): ShadowDecision[] {
    return this.decisions.filter((decision) => decision.tenantId === tenantId).map((decision) => ({ ...decision, evidenceIds: [...decision.evidenceIds] }));
  }

  evaluate(tenantId: string, outcomes: Map<string, 'CORRECT' | 'INCORRECT'>): ShadowEvaluation {
    const decisions = this.list(tenantId);
    const evaluated = decisions.filter((decision) => outcomes.has(decision.id));
    if (!evaluated.length) return { totalDecisions: decisions.length, evaluatedDecisions: 0 };
    const correct = evaluated.filter((decision) => outcomes.get(decision.id) === 'CORRECT').length;
    return { precision: correct / evaluated.length, recall: undefined, falsePositiveRate: 1 - correct / evaluated.length, totalDecisions: decisions.length, evaluatedDecisions: evaluated.length };
  }
}
