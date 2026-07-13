import test from 'node:test';
import assert from 'node:assert/strict';
import { supportCoverage, supportWarnings, validateEvidenceItem, validateSupportLink } from '../packages/core/src/evidence-support.mjs';

test('requires source-linked evidence', () => {
  assert.throws(() => validateEvidenceItem({ title: 'Bank statement' }), /source span/);
});

test('does not equate citation existence with verified support', () => {
  const link = validateSupportLink({ target_type: 'allegation', target_id: 'a1', relationship: 'relied_upon_for' });
  assert.deepEqual(supportWarnings(link), ['citation_exists_but_support_not_verified']);
});

test('flags unsupported support relationships', () => {
  const link = validateSupportLink({ target_type: 'allegation', target_id: 'a1', relationship: 'supports', support_status: 'unsupported' });
  assert.deepEqual(supportWarnings(link), ['support_relationship_not_established']);
});

test('support coverage remains review required until verified', () => {
  assert.equal(supportCoverage([]), 'no_evidence_linked');
  assert.equal(supportCoverage([{ relationship: 'supports', support_status: 'unreviewed' }]), 'review_required');
  assert.equal(supportCoverage([{ relationship: 'supports', support_status: 'support_verified' }]), 'supported');
});

test('deduplicates evidence source spans', () => {
  const value = validateEvidenceItem({ title: 'Agreement', source_span_ids: ['s1', 's1'], evidence_type: 'contract' });
  assert.deepEqual(value.source_span_ids, ['s1']);
});
