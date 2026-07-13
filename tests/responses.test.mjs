import test from 'node:test';
import assert from 'node:assert/strict';
import { responseWarnings, suggestResponseClass, validateResponse, validateResponseCoverage, validateResponseLink } from '../packages/core/src/responses.mjs';

test('requires a source-linked response', () => {
  assert.throws(() => validateResponse({ proposition: 'Denied' }), /source span/);
});

test('suggests only conservative response classes', () => {
  assert.equal(suggestResponseClass('The allegation is denied.'), 'denied');
  assert.equal(suggestResponseClass('The respondent partly admits paragraph 4.'), 'partially_admitted');
  assert.equal(suggestResponseClass('The paragraph is noted.'), 'ambiguous');
});

test('not specifically answered remains distinct from denial', () => {
  const link = validateResponseLink({ response_class: 'not_specifically_answered', addressed_scope: 'unclear' });
  const response = validateResponse({ proposition: 'No specific reply is required.', source_span_ids: ['s1'], responding_entity_id: 'e1' });
  assert.deepEqual(responseWarnings(response, link), ['not_specific_answer_is_not_denial']);
});

test('not located coverage requires documented search scope', () => {
  assert.throws(() => validateResponseCoverage({ coverage_status: 'not_located' }), /search scope/);
  assert.equal(validateResponseCoverage({ coverage_status: 'not_located', scope_note: 'Reviewed defence pages 1-40.' }).coverage_status, 'not_located');
});

test('deduplicates searched documents', () => {
  const value = validateResponseCoverage({ coverage_status: 'incomplete', searched_document_ids: ['d1', 'd1'], scope_note: 'Only one filing reviewed.' });
  assert.deepEqual(value.searched_document_ids, ['d1']);
});
