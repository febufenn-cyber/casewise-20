import test from 'node:test';
import assert from 'node:assert/strict';
import { computeDeltaEvaluation, evaluateDeltaGate, validateDeltaEvaluationInput } from '../packages/core/src/delta-evaluation.mjs';

const observation = (outcome, extra = {}) => ({
  outcome,
  materiality: 'medium',
  source_pair_verified: true,
  delta_item_id: outcome === 'true_positive' ? crypto.randomUUID() : null,
  ...extra,
});

test('validates evaluation timing and observations', () => {
  assert.throws(() => validateDeltaEvaluationInput({ pack_label: '', baseline_minutes: 10, casewise_minutes: 5, observations: [observation('true_positive')] }), /pack label/);
  assert.throws(() => validateDeltaEvaluationInput({ pack_label: 'Pack A', baseline_minutes: 0, casewise_minutes: 5, observations: [observation('true_positive')] }), /baseline minutes/);
  assert.throws(() => validateDeltaEvaluationInput({ pack_label: 'Pack A', baseline_minutes: 10, casewise_minutes: 5, observations: [] }), /observations/);
});

test('computes precision recall f1 and review-time savings', () => {
  const observations = [
    observation('true_positive'),
    observation('true_positive'),
    observation('false_positive'),
    observation('false_negative'),
  ];
  const metrics = computeDeltaEvaluation(observations, { baseline_minutes: 100, casewise_minutes: 60 });
  assert.equal(metrics.true_positive_count, 2);
  assert.equal(metrics.precision, 0.6667);
  assert.equal(metrics.recall, 0.6667);
  assert.equal(metrics.f1, 0.6667);
  assert.equal(metrics.time_savings_fraction, 0.4);
});

test('type mismatch counts as both false positive and false negative', () => {
  const metrics = computeDeltaEvaluation([observation('type_mismatch')], { baseline_minutes: 10, casewise_minutes: 5 });
  assert.equal(metrics.type_mismatch_count, 1);
  assert.equal(metrics.false_positive_count, 1);
  assert.equal(metrics.false_negative_count, 1);
});

test('material omissions and source-pair failures fail the gate', () => {
  const observations = [
    observation('true_positive'),
    observation('true_positive', { source_pair_verified: false }),
    observation('material_omission', { materiality: 'high' }),
  ];
  const metrics = computeDeltaEvaluation(observations, { baseline_minutes: 100, casewise_minutes: 50 });
  const gate = evaluateDeltaGate(metrics, { minimum_observations: 3, minimum_precision: 0.5, minimum_recall: 0.5, minimum_time_savings_fraction: 0.2 });
  assert.equal(gate.gate_status, 'failed');
  assert.ok(gate.reasons.includes('material_omission_present'));
  assert.ok(gate.reasons.includes('source_pair_failure_present'));
});

test('small samples remain incomplete even when otherwise accurate', () => {
  const metrics = computeDeltaEvaluation([observation('true_positive')], { baseline_minutes: 20, casewise_minutes: 10 });
  const gate = evaluateDeltaGate(metrics);
  assert.equal(gate.gate_status, 'incomplete');
  assert.ok(gate.reasons.includes('evaluation_sample_too_small'));
});

test('a calibrated evaluation can pass', () => {
  const observations = Array.from({ length: 8 }, () => observation('true_positive'));
  const metrics = computeDeltaEvaluation(observations, { baseline_minutes: 120, casewise_minutes: 70 });
  const gate = evaluateDeltaGate(metrics, { minimum_observations: 8, minimum_precision: 0.95, minimum_recall: 0.95, minimum_time_savings_fraction: 0.25 });
  assert.equal(gate.gate_status, 'passed');
  assert.deepEqual(gate.reasons, []);
});
