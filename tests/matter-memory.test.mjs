import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMatterMemoryEntries, deltaApprovalReadiness, filterMatterMemory, matterMemorySummary } from '../packages/core/src/matter-memory.mjs';

test('material unresolved delta items block approval', () => {
  const readiness = deltaApprovalReadiness([{ change_type: 'amended', materiality: 'high', review_status: 'unreviewed', prior_source_span_ids: ['p'], current_source_span_ids: ['c'] }], { unresolved_ambiguous_count: 0 });
  assert.equal(readiness.can_approve, false);
  assert.equal(readiness.approval_status, 'blocked');
});

test('unresolved cross-version matches block approval', () => {
  const readiness = deltaApprovalReadiness([{ change_type: 'new', materiality: 'low', review_status: 'accepted', current_source_span_ids: ['c'] }], { unresolved_ambiguous_count: 1 });
  assert.equal(readiness.can_approve, false);
  assert.ok(readiness.warnings.includes('ambiguous_matches_unresolved'));
});

test('source integrity is mandatory for approval', () => {
  const readiness = deltaApprovalReadiness([{ change_type: 'removed', materiality: 'low', review_status: 'accepted', prior_source_span_ids: [] }], {});
  assert.equal(readiness.source_failure_count, 1);
  assert.equal(readiness.approval_status, 'blocked');
});

test('fully reviewed source-paired deltas can be approved', () => {
  const readiness = deltaApprovalReadiness([{ change_type: 'amount_changed', materiality: 'high', review_status: 'corrected', prior_source_span_ids: ['p'], current_source_span_ids: ['c'] }], { unresolved_ambiguous_count: 0 });
  assert.equal(readiness.can_approve, true);
  assert.equal(readiness.approval_status, 'ready');
});

test('approved deltas produce immutable memory entries with both source sides', () => {
  const snapshot = { id: 'd1', prior_version_id: 'v1', current_version_id: 'v2' };
  const entries = buildMatterMemoryEntries(snapshot, [{ id: 'i1', object_type: 'amount_mention', change_type: 'amount_changed', materiality: 'high', summary: 'Amount changed', prior_member_id: 'p1', current_member_id: 'c1', prior_source_span_ids: ['old'], current_source_span_ids: ['new'], party_entity_ids: ['party'], logical_document_ids: ['doc'], details: {}, review_status: 'accepted', status: 'active' }]);
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0].prior_source_span_ids, ['old']);
  assert.deepEqual(entries[0].current_source_span_ids, ['new']);
});

test('matter memory filters and summaries remain deterministic', () => {
  const entries = [
    { change_type: 'new', materiality: 'high', party_entity_ids: ['p1'], logical_document_ids: ['d1'] },
    { change_type: 'removed', materiality: 'low', party_entity_ids: ['p2'], logical_document_ids: ['d2'] },
  ];
  assert.equal(filterMatterMemory(entries, { party_id: 'p1' }).length, 1);
  const summary = matterMemorySummary(entries);
  assert.equal(summary.entry_count, 2);
  assert.equal(summary.change_type_counts.new, 1);
});
