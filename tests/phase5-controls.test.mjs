import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDependencyRows, buildInternalExportManifest, invalidationTargets, phase5ApprovalReadiness } from '../packages/core/src/phase5-controls.mjs';

const overview = { id: 'o1', version_number: 2, matrix_snapshot_id: 'm1', status: 'active', approval_status: 'ready', source_manifest_fingerprint: 'fp1', artifact_locks: { matrix_snapshot_id: 'm1' } };
const plan = { id: 'p1', version_number: 3, matrix_snapshot_id: 'm1', overview_snapshot_id: 'o1', status: 'draft', approval_status: 'ready', artifact_locks: { overview_snapshot_id: 'o1' } };
const planReadiness = { ready_for_approval: true, warnings: [] };

test('approves only matching ready artifacts with complete source and coverage checks', () => {
  const ready = phase5ApprovalReadiness(overview, plan, planReadiness, { source_integrity_verified: true, processing_coverage_complete: true });
  assert.equal(ready.can_approve, true);
  assert.equal(ready.production_use_allowed, false);

  const blocked = phase5ApprovalReadiness(overview, { ...plan, overview_snapshot_id: 'other' }, planReadiness, { source_integrity_verified: false, processing_coverage_complete: false });
  assert.equal(blocked.can_approve, false);
  assert.ok(blocked.warnings.includes('overview_plan_version_mismatch'));
  assert.ok(blocked.warnings.includes('source_integrity_not_verified'));
  assert.ok(blocked.warnings.includes('processing_coverage_incomplete'));
});

test('internal export requires attorney-approved exact versions', () => {
  assert.throws(() => buildInternalExportManifest({ matter_id: 'matter1', organization_id: 'org1', overview, plan, overview_entries: [{}], plan_entries: [{}] }), /attorney-approved/);
});

test('internal export is reproducible and never filing-ready', () => {
  const input = {
    matter_id: 'matter1',
    organization_id: 'org1',
    overview: { ...overview, approval_status: 'attorney_approved' },
    plan: { ...plan, approval_status: 'attorney_approved' },
    overview_entries: [{ sentence_id: 's1', supports: [{ source_span_id: 'span1' }] }],
    plan_entries: [{ node_id: 'n1', supports: [{ source_span_id: 'span2' }] }],
  };
  const first = buildInternalExportManifest(input);
  const second = buildInternalExportManifest(input);
  assert.equal(first.manifest.classification, 'internal_only');
  assert.equal(first.manifest.filing_ready, false);
  assert.equal(first.manifest.production_use_allowed, false);
  assert.equal(first.manifest_fingerprint, second.manifest_fingerprint);
});

test('dependency builder connects source objects to exact overview and plan versions', () => {
  const rows = buildDependencyRows({
    overview_snapshot_id: 'o1',
    response_plan_snapshot_id: 'p1',
    overview_entries: [{ sentence_id: 's1', supports: [{ source_span_id: 'span1' }] }],
    plan_entries: [{ node_id: 'n1', supports: [{ source_span_id: 'span2' }] }],
  });
  assert.ok(rows.some((row) => row.upstream_type === 'narrative_sentence' && row.downstream_id === 'o1'));
  assert.ok(rows.some((row) => row.upstream_type === 'source_span' && row.upstream_id === 'span1'));
  assert.ok(rows.some((row) => row.upstream_type === 'matter_overview_snapshot' && row.downstream_id === 'p1'));
  assert.ok(rows.some((row) => row.upstream_type === 'response_plan_node' && row.upstream_id === 'n1'));
});

test('invalidation targets are deduplicated by downstream artifact', () => {
  const dependencies = [
    { upstream_type: 'source_span', upstream_id: 'span1', downstream_type: 'matter_overview_snapshot', downstream_id: 'o1', dependency_reason: 'one', status: 'active' },
    { upstream_type: 'source_span', upstream_id: 'span1', downstream_type: 'matter_overview_snapshot', downstream_id: 'o1', dependency_reason: 'two', status: 'active' },
    { upstream_type: 'source_span', upstream_id: 'span1', downstream_type: 'response_plan_snapshot', downstream_id: 'p1', dependency_reason: 'three', status: 'active' },
  ];
  const targets = invalidationTargets(dependencies, { type: 'source_span', id: 'span1' });
  assert.equal(targets.length, 2);
  assert.deepEqual(targets.map((target) => target.downstream_id).sort(), ['o1','p1']);
});
