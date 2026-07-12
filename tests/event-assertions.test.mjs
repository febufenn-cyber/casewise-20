import test from 'node:test';
import assert from 'node:assert/strict';
import { assertionFingerprint, assertionWarnings, duplicateAssertionCandidates, validateEventAssertion } from '../packages/core/src/event-assertions.mjs';

const base = { id: 'a', event_type: 'payment', proposition: 'The claimant paid the respondent.', asserting_entity_id: 'claimant', assertion_mode: 'affirmed', source_span_ids: ['s1'], actor_entity_ids: ['claimant'], object_entity_ids: ['respondent'], date_mention_ids: ['d1'], amount_mention_ids: ['m1'] };

test('requires a source and assertion mode', () => {
  assert.throws(() => validateEventAssertion({ ...base, source_span_ids: [] }), /source span/);
  assert.throws(() => validateEventAssertion({ ...base, assertion_mode: 'fact' }), /invalid assertion mode/);
});

test('preserves denial as a warning instead of confirmation', () => {
  assert.ok(assertionWarnings({ ...base, assertion_mode: 'denied' }).includes('denial_not_event_confirmation'));
});

test('deduplicates arrays before persistence', () => {
  const result = validateEventAssertion({ ...base, source_span_ids: ['s1', 's1'] });
  assert.deepEqual(result.source_span_ids, ['s1']);
});

test('fingerprint separates different asserting parties and modes', () => {
  assert.notEqual(assertionFingerprint(base), assertionFingerprint({ ...base, asserting_entity_id: 'respondent' }));
  assert.notEqual(assertionFingerprint(base), assertionFingerprint({ ...base, assertion_mode: 'quoted' }));
});

test('finds copied assertions without counting them as independent proof', () => {
  const candidates = duplicateAssertionCandidates([base, { ...base, id: 'b', source_span_ids: ['s2'] }]);
  assert.deepEqual(candidates[0].assertion_ids, ['a', 'b']);
});
