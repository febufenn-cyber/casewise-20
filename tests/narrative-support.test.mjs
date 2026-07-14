import test from 'node:test';
import assert from 'node:assert/strict';
import { detectUnsupportedLanguage, narrativeSentenceReadiness, narrativeSupportSetReadiness, validateNarrativeSentence } from '../packages/core/src/narrative-support.mjs';

const binding = { object_type: 'allegation', object_id: '11111111-1111-1111-1111-111111111111', source_span_id: '22222222-2222-2222-2222-222222222222', support_role: 'primary' };

test('accepts a source-bound attributed party position', () => {
  const sentence = validateNarrativeSentence({
    sentence_text: 'The claimant alleges that payment was made on 3 April 2024.',
    claim_type: 'party_position',
    attribution_entity_id: '33333333-3333-3333-3333-333333333333',
    materiality: 'high',
    dispute_status: 'contested',
    uncertainty_status: 'certain',
    support_bindings: [binding],
  });
  assert.equal(sentence.support_status, 'supported');
  assert.deepEqual(sentence.warnings, []);
});

test('blocks unsupported factual sentences', () => {
  const sentence = validateNarrativeSentence({ sentence_text: 'A payment was made.', materiality: 'high' });
  assert.equal(sentence.support_status, 'blocked');
  assert.ok(sentence.warnings.includes('missing_structured_and_source_support'));
});

test('blocks language that flattens a contested position', () => {
  const warnings = detectUnsupportedLanguage({ sentence_text: 'The records clearly prove that the respondent committed fraud.', dispute_status: 'contested', uncertainty_status: 'ambiguous', claim_type: 'factual_statement' });
  assert.ok(warnings.includes('dispute_or_uncertainty_flattened'));
  assert.ok(warnings.includes('legal_or_strategy_conclusion_not_allowed'));
});

test('requires attribution for party positions', () => {
  const sentence = validateNarrativeSentence({ sentence_text: 'Payment was denied.', claim_type: 'party_position', materiality: 'medium', support_bindings: [binding] });
  assert.equal(sentence.support_status, 'blocked');
  assert.ok(sentence.warnings.includes('party_position_missing_attribution'));
});

test('does not accept a sentence with unresolved warnings', () => {
  const readiness = narrativeSentenceReadiness({ support_status: 'review_required', support_count: 1, warnings: ['uncertainty_hidden'] });
  assert.equal(readiness.ready_for_review, true);
  assert.equal(readiness.ready_for_acceptance, false);
});

test('support set readiness requires approved inputs, complete coverage, and reviewed sentences', () => {
  const ready = narrativeSupportSetReadiness([{ support_status: 'supported', support_count: 1, review_status: 'accepted' }], { matrix_snapshot_attorney_approved: true, coverage_complete: true });
  assert.equal(ready.ready_for_overview, true);
  assert.equal(ready.production_use_allowed, false);

  const blocked = narrativeSupportSetReadiness([{ support_status: 'blocked', support_count: 0, review_status: 'unreviewed' }], { matrix_snapshot_attorney_approved: true, coverage_complete: false });
  assert.equal(blocked.ready_for_overview, false);
  assert.ok(blocked.warnings.includes('processing_coverage_incomplete'));
  assert.ok(blocked.warnings.includes('blocked_sentences_present'));
});
