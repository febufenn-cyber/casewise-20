import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allegationFingerprint,
  allegationWarnings,
  duplicateAllegationCandidates,
  normalizeAllegationText,
  validateAllegation,
} from '../packages/core/src/allegations.mjs';

test('normalizes whitespace without removing legally meaningful text', () => {
  assert.equal(normalizeAllegationText('  Payment   was not made. '), 'Payment was not made.');
});

test('requires a source-linked proposition', () => {
  assert.throws(() => validateAllegation({ proposition: 'Paid' }), /source span/);
  assert.throws(() => validateAllegation({ proposition: '', source_span_ids: ['s1'] }), /proposition/);
});

test('deduplicates source and target identifiers', () => {
  const value = validateAllegation({ proposition: 'The respondent retained the deposit.', source_span_ids: ['s1', 's1'], target_entity_ids: ['e2', 'e2'] });
  assert.deepEqual(value.source_span_ids, ['s1']);
  assert.deepEqual(value.target_entity_ids, ['e2']);
});

test('warns when attribution or targets remain unresolved', () => {
  const value = validateAllegation({ proposition: 'It appears that funds were diverted.', source_span_ids: ['s1'], creation_method: 'inferred' });
  assert.deepEqual(allegationWarnings(value), ['asserting_party_not_identified', 'target_not_identified', 'inferred_not_source_stated', 'qualified_or_approximate_language']);
});

test('duplicate proposals require the same party, targets, and normalized proposition', () => {
  const items = [
    { id: 'a1', alleging_entity_id: 'p1', target_entity_ids: ['p2'], proposition: 'Payment was not made.' },
    { id: 'a2', alleging_entity_id: 'p1', target_entity_ids: ['p2'], proposition: ' payment  was not made. ' },
    { id: 'a3', alleging_entity_id: 'p2', target_entity_ids: ['p1'], proposition: 'Payment was not made.' },
  ];
  assert.equal(allegationFingerprint(items[0]), allegationFingerprint(items[1]));
  assert.deepEqual(duplicateAllegationCandidates(items).map((item) => item.allegation_ids), [['a1', 'a2']]);
});
