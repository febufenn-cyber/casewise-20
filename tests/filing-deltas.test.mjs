import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFilingDeltaItems, classifyFilingChange, deltaSnapshotReadiness } from '../packages/core/src/filing-deltas.mjs';

const member = (id, type, fingerprint, payload, sources = ['s1']) => ({ id, object_type: type, object_fingerprint: fingerprint, payload, source_span_ids: sources, party_entity_ids: [], logical_document_id: null });

test('classifies new and removed objects explicitly', () => {
  assert.equal(classifyFilingChange({ match_status: 'new' }, null, member('c1', 'allegation', 'c', { proposition: 'New allegation' })), 'new');
  assert.equal(classifyFilingChange({ match_status: 'removed' }, member('p1', 'allegation', 'p', { proposition: 'Old allegation' }), null), 'removed');
});

test('classifies narrowed and expanded allegation language', () => {
  const prior = member('p1', 'allegation', 'p', { proposition: 'The respondent failed to pay invoice 41 and invoice 42' });
  const narrowed = member('c1', 'allegation', 'c', { proposition: 'The respondent failed to pay invoice 41' });
  assert.equal(classifyFilingChange({ match_status: 'probable' }, prior, narrowed), 'narrowed');
  assert.equal(classifyFilingChange({ match_status: 'probable' }, narrowed, prior), 'expanded');
});

test('detects changed response positions and critical values', () => {
  const denied = member('p1', 'response', 'p', { response_class: 'denied', response_text: 'Denied.' });
  const partial = member('c1', 'response', 'c', { response_class: 'partially_admitted', response_text: 'Admitted in part.' });
  assert.equal(classifyFilingChange({ match_status: 'probable' }, denied, partial), 'response_changed');
  const oldAmount = member('p2', 'amount_mention', 'a', { normalized_value: 100000, currency: 'INR' });
  const newAmount = member('c2', 'amount_mention', 'b', { normalized_value: 150000, currency: 'INR' });
  assert.equal(classifyFilingChange({ match_status: 'probable' }, oldAmount, newAmount), 'amount_changed');
});

test('detects resolved contradictions and information gaps', () => {
  const openConflict = member('p1', 'contradiction_candidate', 'a', { decision_status: 'confirmed' });
  const explainedConflict = member('c1', 'contradiction_candidate', 'b', { decision_status: 'explained' });
  assert.equal(classifyFilingChange({ match_status: 'probable' }, openConflict, explainedConflict), 'contradiction_resolved');
  const openGap = member('p2', 'missing_information', 'c', { resolution_status: 'open' });
  const resolvedGap = member('c2', 'missing_information', 'd', { resolution_status: 'resolved' });
  assert.equal(classifyFilingChange({ match_status: 'probable' }, openGap, resolvedGap), 'information_gap_resolved');
});

test('delta items preserve both source sides', () => {
  const prior = member('p1', 'allegation', 'a', { proposition: 'Payment of 100 was due.', materiality: 'high' }, ['old-span']);
  const current = member('c1', 'allegation', 'b', { proposition: 'Payment of 150 was due.', materiality: 'high' }, ['new-span']);
  const items = buildFilingDeltaItems([{ id: 'm1', object_type: 'allegation', prior_member_id: 'p1', current_member_id: 'c1', match_status: 'probable', selected: true, review_status: 'accepted' }], [prior], [current]);
  assert.deepEqual(items[0].prior_source_span_ids, ['old-span']);
  assert.deepEqual(items[0].current_source_span_ids, ['new-span']);
});

test('unreviewed high-materiality deltas block readiness', () => {
  const readiness = deltaSnapshotReadiness([{ change_type: 'amended', materiality: 'high', review_status: 'unreviewed' }]);
  assert.equal(readiness.ready, false);
  assert.equal(readiness.blocked_item_count, 1);
});
