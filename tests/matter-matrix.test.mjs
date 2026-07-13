import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMatterMatrix, canApproveMatrix, matrixReadiness } from '../packages/core/src/matter-matrix.mjs';

test('blocks high-materiality allegations without reviewed response mapping', () => {
  const rows = buildMatterMatrix({ allegations: [{ id: 'a1', materiality: 'high', review_status: 'accepted' }] });
  assert.equal(rows[0].readiness_status, 'blocked');
  assert.ok(rows[0].warnings.includes('response_mapping_incomplete'));
});

test('documented not-located response search is distinct from incomplete mapping', () => {
  const rows = buildMatterMatrix({ allegations: [{ id: 'a1', materiality: 'low', review_status: 'accepted' }], response_searches: [{ allegation_id: 'a1', coverage_status: 'not_located', scope_note: 'Reviewed the complete statement of defence.' }] });
  assert.equal(rows[0].warnings.includes('response_mapping_incomplete'), false);
});

test('unreviewed support blocks readiness', () => {
  const rows = buildMatterMatrix({ allegations: [{ id: 'a1', materiality: 'high', review_status: 'accepted' }], response_links: [{ allegation_id: 'a1', review_status: 'accepted' }], evidence_links: [{ target_type: 'allegation', target_id: 'a1', review_status: 'unreviewed', support_status: 'unreviewed' }] });
  assert.ok(rows[0].warnings.includes('evidence_support_not_reviewed'));
});

test('processing gaps block approval', () => {
  const readiness = matrixReadiness([], { failed_files: 0, failed_pages: 1, unreadable_pages: 0, quarantined_files: 0 });
  assert.equal(readiness.export_status, 'blocked');
  assert.equal(canApproveMatrix(readiness), false);
});

test('fully reviewed rows can be approved', () => {
  const rows = buildMatterMatrix({ allegations: [{ id: 'a1', materiality: 'high', review_status: 'accepted' }], response_links: [{ allegation_id: 'a1', review_status: 'accepted' }], evidence_links: [{ target_type: 'allegation', target_id: 'a1', review_status: 'accepted', support_status: 'support_verified' }] });
  const readiness = matrixReadiness(rows, {});
  assert.equal(readiness.export_status, 'ready');
  assert.equal(canApproveMatrix(readiness), true);
});
