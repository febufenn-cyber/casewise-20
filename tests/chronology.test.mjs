import test from 'node:test';
import assert from 'node:assert/strict';
import { chronologyLanes, clusterEventAssertions, createChronologyReviewTasks, deriveClusterStatus, eventSimilarity, reviewTaskPriority } from '../packages/core/src/chronology.mjs';

const affirmed = { id: 'a', event_type: 'payment', actor_entity_ids: ['c'], object_entity_ids: ['r'], amount_mention_ids: ['m'], date_start: '2024-04-03', date_end: '2024-04-03', assertion_mode: 'affirmed', asserting_entity_id: 'c', logical_document_id: 'doc1', proposition: 'Payment was made.' };
const denied = { ...affirmed, id: 'b', assertion_mode: 'denied', asserting_entity_id: 'r', logical_document_id: 'doc2', proposition: 'Payment was not made.' };

test('groups similar event assertions without erasing disagreement', () => {
  const clusters = clusterEventAssertions([affirmed, denied]);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].event_status, 'contested');
  assert.equal(clusters[0].independent_source_keys.length, 2);
});

test('does not group different event types', () => {
  assert.equal(eventSimilarity(affirmed, { ...affirmed, event_type: 'notice' }).score, 0);
});

test('detects date disagreement as contested', () => {
  assert.equal(deriveClusterStatus([affirmed, { ...affirmed, date_start: '2024-04-04', date_end: '2024-04-04' }]), 'contested');
});

test('prioritizes contested review tasks by dependency count', () => {
  const tasks = createChronologyReviewTasks([{ temporary_id: 'c1', event_status: 'contested', assertion_ids: ['a','b','c'] }]);
  assert.equal(tasks[0].task_type, 'contested_event');
  assert.equal(tasks[0].priority, 27);
  assert.equal(reviewTaskPriority({ materiality: 2, uncertainty: 2, downstream_dependencies: 2, source_quality_risk: 1 }), 8);
});

test('builds party lanes without presenting one neutral truth', () => {
  const rows = chronologyLanes([{ id: 'e', date_start: '2024-04-03', assertions: [affirmed, denied] }], [{ id: 'c', display_name: 'Claimant' }, { id: 'r', display_name: 'Respondent' }]);
  assert.equal(rows[0].lanes.Claimant, 'Payment was made.');
  assert.equal(rows[0].lanes.Respondent, 'Payment was not made.');
});
