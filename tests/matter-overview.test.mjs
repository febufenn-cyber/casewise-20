import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOverviewSourceManifest, overviewReadiness, overviewSummary, validateOverviewSections } from '../packages/core/src/matter-overview.mjs';

test('validates ordered unique overview sections', () => {
  const sections = validateOverviewSections([
    { section_key: 'chronology', title: 'Chronology', position: 1, sentence_ids: ['s2'] },
    { section_key: 'parties', title: 'Parties', position: 0, sentence_ids: ['s1'] },
  ]);
  assert.deepEqual(sections.map((section) => section.section_key), ['parties','chronology']);
});

test('rejects a sentence reused across sections', () => {
  assert.throws(() => validateOverviewSections([
    { section_key: 'one', title: 'One', sentence_ids: ['s1'] },
    { section_key: 'two', title: 'Two', sentence_ids: ['s1'] },
  ]), /multiple overview sections/);
});

test('overview readiness requires reviewed supported source-bound sentences', () => {
  const sections = validateOverviewSections([{ section_key: 'facts', title: 'Facts', sentence_ids: ['s1'] }]);
  const ready = overviewReadiness(sections, [{ id: 's1', review_status: 'accepted', support_status: 'supported', warnings: [], support_count: 1 }], { support_set_ready: true, artifact_locks_complete: true });
  assert.equal(ready.ready_for_review, true);

  const blocked = overviewReadiness(sections, [{ id: 's1', review_status: 'unreviewed', support_status: 'blocked', warnings: ['unsupported'], support_count: 0 }], { support_set_ready: true, artifact_locks_complete: true });
  assert.equal(blocked.ready_for_review, false);
  assert.ok(blocked.warnings.includes('overview_contains_unreviewed_sentences'));
  assert.ok(blocked.warnings.includes('overview_sentence_source_missing'));
});

test('source manifest preserves exact source bindings and fingerprint', () => {
  const sections = validateOverviewSections([{ section_key: 'facts', title: 'Facts', sentence_ids: ['s1'] }]);
  const sentence = { id: 's1', sentence_text: 'The claimant alleges payment.', materiality: 'high', attribution_entity_id: 'e1', dispute_status: 'contested', uncertainty_status: 'certain', omission_status: 'none' };
  const support = { sentence_id: 's1', object_type: 'allegation', object_id: 'a1', source_span_id: 'span1', support_role: 'primary' };
  const first = buildOverviewSourceManifest({ id: 'o1', support_set_id: 'set1', artifact_locks: { matrix: 3 } }, sections, [sentence], [support]);
  const second = buildOverviewSourceManifest({ id: 'o1', support_set_id: 'set1', artifact_locks: { matrix: 3 } }, sections, [sentence], [support]);
  assert.equal(first.entries[0].supports[0].source_span_id, 'span1');
  assert.equal(first.manifest_fingerprint, second.manifest_fingerprint);
});

test('overview summary exposes disputes, uncertainty and omissions', () => {
  const summary = overviewSummary([{ section_key: 'facts' }], [
    { dispute_status: 'contested', uncertainty_status: 'ambiguous', omission_status: 'not_located', materiality: 'high' },
  ]);
  assert.equal(summary.contested_sentence_count, 1);
  assert.equal(summary.uncertain_sentence_count, 1);
  assert.equal(summary.omission_sentence_count, 1);
  assert.equal(summary.high_materiality_sentence_count, 1);
});
