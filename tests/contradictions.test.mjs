import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalObjectPair, contradictionWarnings, detectStructuredConflicts, validateContradictionCandidate, validateMissingInformation } from '../packages/core/src/contradictions.mjs';

test('canonicalizes object pairs and rejects self-conflict', () => {
  assert.deepEqual(canonicalObjectPair('response', 'r1', 'allegation', 'a1'), { object_a_type: 'allegation', object_a_id: 'a1', object_b_type: 'response', object_b_id: 'r1' });
  assert.throws(() => canonicalObjectPair('allegation', 'a1', 'allegation', 'a1'), /cannot contradict itself/);
});

test('requires exact source spans on both sides', () => {
  assert.throws(() => validateContradictionCandidate({ object_a_type: 'allegation', object_a_id: 'a1', object_b_type: 'response', object_b_id: 'r1' }), /both contradiction sides/);
});

test('warns when conflict is inferred or shares the same source', () => {
  const value = validateContradictionCandidate({ object_a_type: 'allegation', object_a_id: 'a1', object_b_type: 'response', object_b_id: 'r1', source_a_span_ids: ['s1'], source_b_span_ids: ['s1'], creation_method: 'inferred' });
  assert.deepEqual(contradictionWarnings(value), ['conflict_not_explained', 'same_source_span_on_both_sides', 'inferred_contradiction_requires_review']);
});

test('detects structured date and amount conflicts conservatively', () => {
  const items = [
    { id: 'd1', subject_key: 'agreement-date', value_type: 'date', normalized_value: '2024-04-03' },
    { id: 'd2', subject_key: 'agreement-date', value_type: 'date', normalized_value: '2024-04-04' },
    { id: 'd3', subject_key: 'other-date', value_type: 'date', normalized_value: '2024-04-03' },
  ];
  const conflicts = detectStructuredConflicts(items);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].contradiction_type, 'date');
});

test('referenced missing documents require processed-scope notes', () => {
  assert.throws(() => validateMissingInformation({ category: 'referenced_document', title: 'Annexure P-7' }), /processed-scope notes/);
  const item = validateMissingInformation({ category: 'referenced_document', title: 'Annexure P-7', scope_note: 'Not located in the uploaded bundle.' });
  assert.equal(item.category, 'referenced_document');
});
