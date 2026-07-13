import test from 'node:test';
import assert from 'node:assert/strict';
import { matchFilingVersionMembers, matchRunReadiness, scoreVersionMembers, validateVersionPair } from '../packages/core/src/delta-matching.mjs';

const member = (id, type, fingerprint, payload, extra = {}) => ({ id, object_type: type, object_fingerprint: fingerprint, payload, party_entity_ids: [], ...extra });

test('validates ordered filing version pairs', () => {
  assert.equal(validateVersionPair({ id: 'v1', matter_id: 'm1', version_number: 1 }, { id: 'v2', matter_id: 'm1', version_number: 2 }), true);
  assert.throws(() => validateVersionPair({ id: 'v2', matter_id: 'm1', version_number: 2 }, { id: 'v1', matter_id: 'm1', version_number: 1 }), /newer/);
});

test('exact fingerprints produce exact matches', () => {
  const results = matchFilingVersionMembers(
    [member('p1', 'allegation', 'same', { proposition: 'Payment was due.' })],
    [member('c1', 'allegation', 'same', { proposition: 'Payment was due.' })],
  );
  assert.equal(results[0].match_status, 'exact');
  assert.equal(results[0].similarity_score, 1);
});

test('matching never crosses object types', () => {
  const score = scoreVersionMembers(
    member('p1', 'allegation', 'x', { text: 'same words' }),
    member('c1', 'response', 'x', { text: 'same words' }),
  );
  assert.equal(score.score, 0);
});

test('close competing candidates remain ambiguous', () => {
  const prior = [
    member('p1', 'allegation', 'x1', { proposition: 'The respondent failed to pay invoice 41.' }),
    member('p2', 'allegation', 'x2', { proposition: 'The respondent failed to pay invoice 42.' }),
  ];
  const current = [member('c1', 'allegation', 'x3', { proposition: 'The respondent failed to pay the invoice.' })];
  const results = matchFilingVersionMembers(prior, current, { probable_threshold: 0.6, ambiguous_threshold: 0.2, ambiguity_margin: 0.2 });
  assert.equal(results[0].match_status, 'ambiguous');
  assert.ok(results[0].features.competing_candidate_count >= 2);
});

test('unmatched members become explicit new and removed records', () => {
  const results = matchFilingVersionMembers(
    [member('p1', 'amount_mention', 'old', { normalized_value: 100 })],
    [member('c1', 'entity', 'new', { display_name: 'Zenith Ltd' })],
  );
  assert.ok(results.some((item) => item.match_status === 'new' && item.current_member_id === 'c1'));
  assert.ok(results.some((item) => item.match_status === 'removed' && item.prior_member_id === 'p1'));
});

test('readiness blocks unresolved ambiguous matches', () => {
  const readiness = matchRunReadiness([{ match_status: 'ambiguous', review_status: 'unreviewed' }]);
  assert.equal(readiness.ready, false);
  assert.equal(readiness.unresolved_ambiguous_count, 1);
});
