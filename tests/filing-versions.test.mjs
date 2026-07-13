import test from 'node:test';
import assert from 'node:assert/strict';
import { filingVersionReadiness, fingerprintGraphMember, snapshotGraphMembers, validateFilingVersion } from '../packages/core/src/filing-versions.mjs';

test('validates filing version labels and kinds', () => {
  const value = validateFilingVersion({ label: ' Amended statement of claim ', filing_kind: 'amended_filing' });
  assert.equal(value.label, 'Amended statement of claim');
  assert.equal(value.filing_kind, 'amended_filing');
  assert.throws(() => validateFilingVersion({ label: 'x', filing_kind: 'truth' }), /invalid filing kind/);
});

test('requires source-linked unique graph members', () => {
  assert.throws(() => snapshotGraphMembers([{ object_type: 'allegation', object_id: 'a1', source_span_ids: [] }]), /source spans are required/);
  assert.throws(() => snapshotGraphMembers([
    { object_type: 'allegation', object_id: 'a1', source_span_ids: ['s1'] },
    { object_type: 'allegation', object_id: 'a1', source_span_ids: ['s2'] },
  ]), /duplicate graph member/);
});

test('fingerprints canonical payloads deterministically', () => {
  const first = fingerprintGraphMember({ object_type: 'response', object_id: 'r1', payload: { b: 2, a: 1 } });
  const second = fingerprintGraphMember({ object_type: 'response', object_id: 'r1', payload: { a: 1, b: 2 } });
  assert.equal(first, second);
});

test('readiness blocks unreviewed members', () => {
  const members = snapshotGraphMembers([{ object_type: 'allegation', object_id: 'a1', source_span_ids: ['s1'], review_status: 'unreviewed', payload: { proposition: 'Payment was due.' } }]);
  const readiness = filingVersionReadiness(members);
  assert.equal(readiness.ready, false);
  assert.ok(readiness.warnings.includes('unreviewed_graph_members'));
});

test('reviewed source-linked members form an activatable version', () => {
  const members = snapshotGraphMembers([
    { object_type: 'allegation', object_id: 'a1', source_span_ids: ['s1'], review_status: 'accepted', payload: { proposition: 'Payment was due.' } },
    { object_type: 'response', object_id: 'r1', source_span_ids: ['s2'], review_status: 'corrected', payload: { response_text: 'Payment was not due.' } },
  ]);
  const readiness = filingVersionReadiness(members);
  assert.equal(readiness.ready, true);
  assert.equal(readiness.member_count, 2);
});
