import test from 'node:test';
import assert from 'node:assert/strict';
import { responsePlanReadiness, responsePlanSummary, validatePlanDependencies, validatePlanNode } from '../packages/core/src/response-planning.mjs';

const support = { object_type: 'allegation', object_id: 'a1', source_span_id: 'span1', support_role: 'primary' };

test('validates a source-bound factual answer task without turning it into legal advice', () => {
  const node = validatePlanNode({ matrix_row_id: 'm1', allegation_id: 'a1', node_type: 'factual_answer', title: 'Prepare the factual answer to the payment allegation', details: 'Confirm the transfer date and amount from the bank record.', materiality: 'high', support_bindings: [support] });
  assert.equal(node.node_type, 'factual_answer');
  assert.equal(node.support_bindings.length, 1);
});

test('blocks legal conclusions in factual-answer nodes', () => {
  assert.throws(() => validatePlanNode({ matrix_row_id: 'm1', allegation_id: 'a1', node_type: 'factual_answer', title: 'The respondent is liable', support_bindings: [support] }), /legal or strategy conclusion/);
});

test('client questions must be written as questions', () => {
  assert.throws(() => validatePlanNode({ matrix_row_id: 'm1', allegation_id: 'a1', node_type: 'client_question', title: 'Ask the client about the missing invoice', support_bindings: [support] }), /phrased as a question/);
  const node = validatePlanNode({ matrix_row_id: 'm1', allegation_id: 'a1', node_type: 'client_question', title: 'Did the client receive the invoice?', support_bindings: [support] });
  assert.ok(node.warnings.includes('question_not_answered_by_system'));
});

test('authority research nodes remain unexecuted tasks', () => {
  const node = validatePlanNode({ matrix_row_id: 'm1', allegation_id: 'a1', node_type: 'authority_research_task', title: 'Research limitation authorities', support_bindings: [support] });
  assert.ok(node.warnings.includes('external_authority_research_not_executed'));
});

test('dependency graph rejects cycles', () => {
  const nodes = [{ id: 'n1' }, { id: 'n2' }];
  assert.throws(() => validatePlanDependencies(nodes, [{ node_id: 'n1', depends_on_node_id: 'n2' }, { node_id: 'n2', depends_on_node_id: 'n1' }]), /cycle/);
});

test('plan readiness requires reviewed source-bound unblocked nodes', () => {
  const nodes = [{ id: 'n1', review_status: 'accepted', support_count: 1, node_status: 'open', node_type: 'factual_answer', materiality: 'high' }];
  const ready = responsePlanReadiness(nodes, [], { matrix_snapshot_attorney_approved: true, overview_ready: true });
  assert.equal(ready.ready_for_approval, true);
  assert.equal(ready.production_use_allowed, false);

  const blocked = responsePlanReadiness([{ id: 'n1', review_status: 'unreviewed', support_count: 0, node_status: 'blocked', node_type: 'client_question' }], [], { matrix_snapshot_attorney_approved: true, overview_ready: true });
  assert.equal(blocked.ready_for_approval, false);
  assert.ok(blocked.warnings.includes('unreviewed_plan_nodes'));
  assert.ok(blocked.warnings.includes('plan_nodes_without_sources'));
});

test('plan summary exposes workload without making conclusions', () => {
  const summary = responsePlanSummary([{ node_status: 'open', materiality: 'high', node_type: 'client_question' }, { node_status: 'resolved', materiality: 'low', node_type: 'authority_research_task' }]);
  assert.equal(summary.node_count, 2);
  assert.equal(summary.client_question_count, 1);
  assert.equal(summary.authority_research_task_count, 1);
});
