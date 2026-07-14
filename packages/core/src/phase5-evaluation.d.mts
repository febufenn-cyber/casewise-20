export type Phase5EvaluationObservationInput = {
  artifact_type?: string;
  artifact_id?: string | null;
  outcome?: string;
  materiality?: string;
  source_verified?: boolean;
  expected_support?: boolean;
  notes?: string;
};
export type ValidatedPhase5Observation = {
  artifact_type: string;
  artifact_id: string | null;
  outcome: string;
  materiality: string;
  source_verified: boolean;
  expected_support: boolean;
  notes: string | null;
};
export type Phase5EvaluationInput = {
  pack_label?: string;
  baseline_minutes?: number;
  casewise_minutes?: number;
  observations?: Phase5EvaluationObservationInput[];
  notes?: string;
};
export type ValidatedPhase5Evaluation = {
  pack_label: string;
  baseline_minutes: number;
  casewise_minutes: number;
  observations: ValidatedPhase5Observation[];
  notes: string | null;
};
export function validatePhase5EvaluationInput(input?: Phase5EvaluationInput): ValidatedPhase5Evaluation;
export function computePhase5Evaluation(observations?: ValidatedPhase5Observation[], timing?: Record<string, number>): Record<string, any>;
export function evaluatePhase5Gate(metrics: Record<string, any>, thresholds?: Record<string, number>): { gate_status: 'passed' | 'failed' | 'incomplete'; reasons: string[]; thresholds: Record<string, number> };
export const phase5EvaluationConstants: Record<string, string[]>;
