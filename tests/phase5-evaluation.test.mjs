import test from 'node:test';
import assert from 'node:assert/strict';
import { computePhase5Evaluation, evaluatePhase5Gate, validatePhase5EvaluationInput } from '../packages/core/src/phase5-evaluation.mjs';

function supportedOverview(id, materiality = 'high') {
  return { artifact_type: 'overview_sentence', artifact_id: id, outcome: 'supported', materiality, source_verified: true };
}
function supportedPlan(id, materiality = 'high') {
  return { artifact_type: 'response_plan_node', artifact_id: id, outcome: 'supported', materiality, source_verified: true };
}

test('validates exact artifact observations and timing', () => {
  const value = validatePhase5EvaluationInput({ pack_label: 'Matter pack A', baseline_minutes: 120, casewise_minutes: 60, observations: [supportedOverview('s1'), supportedPlan('n1'), { artifact_type: 'stale_propagation', outcome: 'stale_propagation_pass', source_verified: true }] });
  assert.equal(value.observations.length, 3);
  assert.equal(value.pack_label, 'Matter pack A');
});

test('rejects unsupported stale observation shapes', () => {
  assert.throws(() => validatePhase5EvaluationInput({ pack_label: 'Pack', baseline_minutes: 10, casewise_minutes: 5, observations: [{ artifact_type: 'stale_propagation', artifact_id: 'x', outcome: 'supported' }] }), /invalid outcome/);
});

test('computes citation fidelity, support coverage and time savings', () => {
  const observations = [supportedOverview('s1'), supportedOverview('s2'), supportedPlan('n1'), supportedPlan('n2'), { artifact_type: 'stale_propagation', artifact_id: null, outcome: 'stale_propagation_pass', materiality: 'high', source_verified: true, expected_support: true }];
  const metrics = computePhase5Evaluation(observations, { baseline_minutes: 100, casewise_minutes: 50 });
  assert.equal(metrics.citation_fidelity, 1);
  assert.equal(metrics.sentence_support_coverage, 1);
  assert.equal(metrics.plan_node_support_coverage, 1);
  assert.equal(metrics.time_savings_fraction, 0.5);
});

test('material omissions, citation failures and stale failures are visible', () => {
  const observations = [
    supportedOverview('s1'),
    { artifact_type: 'overview_sentence', artifact_id: 's2', outcome: 'citation_failure', materiality: 'high', source_verified: false, expected_support: true },
    { artifact_type: 'response_plan_node', artifact_id: 'n1', outcome: 'material_omission', materiality: 'critical', source_verified: false, expected_support: true },
    { artifact_type: 'stale_propagation', artifact_id: null, outcome: 'stale_propagation_failure', materiality: 'critical', source_verified: true, expected_support: true },
  ];
  const metrics = computePhase5Evaluation(observations, { baseline_minutes: 100, casewise_minutes: 50 });
  assert.equal(metrics.material_omission_count, 1);
  assert.equal(metrics.stale_propagation_failure_count, 1);
  assert.ok(metrics.citation_fidelity < 1);
});

test('passes a sufficiently large clean evaluation pack', () => {
  const observations = [];
  for (let index = 0; index < 10; index += 1) observations.push(supportedOverview(`s${index}`));
  for (let index = 0; index < 10; index += 1) observations.push(supportedPlan(`n${index}`));
  observations.push({ artifact_type: 'stale_propagation', artifact_id: null, outcome: 'stale_propagation_pass', materiality: 'critical', source_verified: true, expected_support: true });
  const metrics = computePhase5Evaluation(observations, { baseline_minutes: 120, casewise_minutes: 60 });
  const gate = evaluatePhase5Gate(metrics);
  assert.equal(gate.gate_status, 'passed');
});

test('returns incomplete for a small sample and failed for a material defect', () => {
  const small = computePhase5Evaluation([supportedOverview('s1'), supportedPlan('n1'), { artifact_type: 'stale_propagation', artifact_id: null, outcome: 'stale_propagation_pass', materiality: 'high', source_verified: true, expected_support: true }], { baseline_minutes: 10, casewise_minutes: 5 });
  assert.equal(evaluatePhase5Gate(small).gate_status, 'incomplete');

  const observations = [];
  for (let index = 0; index < 10; index += 1) observations.push(supportedOverview(`s${index}`));
  for (let index = 0; index < 9; index += 1) observations.push(supportedPlan(`n${index}`));
  observations.push({ artifact_type: 'response_plan_node', artifact_id: 'n-bad', outcome: 'material_omission', materiality: 'critical', source_verified: false, expected_support: true });
  observations.push({ artifact_type: 'stale_propagation', artifact_id: null, outcome: 'stale_propagation_pass', materiality: 'high', source_verified: true, expected_support: true });
  const failed = evaluatePhase5Gate(computePhase5Evaluation(observations, { baseline_minutes: 100, casewise_minutes: 50 }));
  assert.equal(failed.gate_status, 'failed');
  assert.ok(failed.reasons.includes('material_omission_present'));
});
