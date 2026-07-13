import { Hono } from 'hono';
import type { Env, Variables } from '../env';
import { buildMatterMatrix, canApproveMatrix, matrixReadiness } from '../../../../packages/core/src/matter-matrix.mjs';
import { audit } from '../lib/audit';
import { requireMatterRole } from '../lib/authorization';
import { ApiError, readJson } from '../lib/http';
import { serviceRest, userRest } from '../lib/supabase';

export const matrix = new Hono<{ Bindings: Env; Variables: Variables }>();

async function activeMatter(env: Env, matterId: string) {
  const rows = await serviceRest(env, `/matters?id=eq.${matterId}&status=eq.active&select=id,organization_id&limit=1`);
  if (!rows?.length) throw new ApiError(409, 'Active matter required', 'invalid_matter_state');
  return rows[0];
}

matrix.get('/matters/:matterId/matrix', async (c) => {
  const matterId = c.req.param('matterId');
  await requireMatterRole(c.env, c.get('accessToken'), c.get('user').id, matterId, 'viewer');
  const snapshots = await userRest(c.env, c.get('accessToken'), `/matter_matrix_snapshots?matter_id=eq.${matterId}&export_status=not.in.(superseded,deleted)&select=*,matter_matrix_rows(*)&order=version_number.desc&limit=1`);
  return c.json({ data: snapshots?.[0] ?? null });
});

matrix.post('/matters/:matterId/matrix/rebuild', async (c) => {
  const matterId = c.req.param('matterId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'reviewer');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<{ processing_version?: string }>(c.req.raw);
  const [allegations, responseLinks, responseSearches, evidenceLinks, contradictionRows, missingItems, coverageEntries, versions] = await Promise.all([
    serviceRest(c.env, `/allegations?matter_id=eq.${matterId}&status=eq.active&review_status=neq.rejected&select=*`),
    serviceRest(c.env, `/allegation_response_links?matter_id=eq.${matterId}&review_status=neq.rejected&select=*&order=created_at.asc`),
    serviceRest(c.env, `/allegation_response_searches?matter_id=eq.${matterId}&select=*&order=created_at.desc`),
    serviceRest(c.env, `/proposition_evidence_links?matter_id=eq.${matterId}&review_status=neq.rejected&select=*`),
    serviceRest(c.env, `/contradiction_candidates?matter_id=eq.${matterId}&status=eq.active&select=*`),
    serviceRest(c.env, `/missing_information_items?matter_id=eq.${matterId}&resolution_status=not.in.(resolved,dismissed)&select=*`),
    serviceRest(c.env, `/coverage_entries?matter_id=eq.${matterId}&select=status`),
    serviceRest(c.env, `/matter_matrix_snapshots?matter_id=eq.${matterId}&select=version_number&order=version_number.desc&limit=1`),
  ]);
  const coverage = { failed_files: 0, failed_pages: 0, unreadable_pages: 0, quarantined_files: 0 };
  for (const entry of coverageEntries ?? []) {
    if (entry.status === 'failed') coverage.failed_pages += 1;
    if (entry.status === 'unreadable') coverage.unreadable_pages += 1;
    if (entry.status === 'quarantined') coverage.quarantined_files += 1;
  }
  const rows = buildMatterMatrix({ allegations, response_links: responseLinks, response_searches: responseSearches, evidence_links: evidenceLinks, contradictions: contradictionRows, missing_items: missingItems });
  const readiness = matrixReadiness(rows, coverage);
  const versionNumber = Number(versions?.[0]?.version_number ?? 0) + 1; const snapshotId = crypto.randomUUID();
  await serviceRest(c.env, `/matter_matrix_snapshots?matter_id=eq.${matterId}&export_status=not.in.(superseded,deleted)`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ export_status: 'superseded' }) });
  await serviceRest(c.env, '/matter_matrix_snapshots', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: snapshotId, organization_id: matter.organization_id, matter_id: matterId, version_number: versionNumber, processing_version: body.processing_version ?? 'phase3-matrix-v1', row_count: readiness.row_count, blocked_row_count: readiness.blocked_row_count, review_required_row_count: readiness.review_required_row_count, coverage_summary: { ...coverage, coverage_warnings: readiness.coverage_warnings }, export_status: readiness.export_status, created_by: user.id, activated_at: new Date().toISOString() }) });
  if (rows.length) await serviceRest(c.env, '/matter_matrix_rows', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(rows.map((row) => ({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, snapshot_id: snapshotId, allegation_id: row.allegation_id, readiness_status: row.readiness_status, warnings: row.warnings, response_summary: row.responses, evidence_summary: row.evidence, contradiction_summary: row.contradictions, missing_summary: row.missing_information, row_data: row }))) });
  const reviewRows = rows.filter((row) => row.readiness_status !== 'ready');
  if (reviewRows.length) await serviceRest(c.env, '/review_tasks', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(reviewRows.map((row) => ({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, task_type: 'matrix_row_review', object_type: 'allegation', object_id: row.allegation_id, priority: row.readiness_status === 'blocked' ? 100 : 50, reason: row.warnings.join(',') }))) });
  await audit(c.env, { organization_id: matter.organization_id, matter_id: matterId, actor_id: user.id, action: 'matter_matrix.rebuilt', resource_type: 'matter_matrix_snapshot', resource_id: snapshotId, request_id: c.get('requestId'), metadata: { version_number: versionNumber, ...readiness } });
  return c.json({ data: { snapshot_id: snapshotId, version_number: versionNumber, ...readiness } }, 201);
});

matrix.get('/matters/:matterId/matrix/:snapshotId/readiness', async (c) => {
  const matterId = c.req.param('matterId'); const snapshotId = c.req.param('snapshotId');
  await requireMatterRole(c.env, c.get('accessToken'), c.get('user').id, matterId, 'viewer');
  const rows = await userRest(c.env, c.get('accessToken'), `/matter_matrix_snapshots?id=eq.${snapshotId}&matter_id=eq.${matterId}&select=*&limit=1`);
  if (!rows?.length) throw new ApiError(404, 'Matrix snapshot not found', 'not_found');
  const snapshot = rows[0];
  const readiness = { export_status: snapshot.export_status, row_count: snapshot.row_count, blocked_row_count: snapshot.blocked_row_count, review_required_row_count: snapshot.review_required_row_count, coverage_warnings: snapshot.coverage_summary?.coverage_warnings ?? [] };
  return c.json({ data: { ...readiness, can_approve: canApproveMatrix(readiness) } });
});

matrix.post('/matters/:matterId/matrix/:snapshotId/review', async (c) => {
  const matterId = c.req.param('matterId'); const snapshotId = c.req.param('snapshotId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'reviewer');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<{ decision?: string; rationale?: string }>(c.req.raw);
  if (!['approved','rejected','corrected','unresolved'].includes(body.decision ?? '')) throw new ApiError(400, 'invalid matrix review decision', 'invalid_request');
  const rows = await serviceRest(c.env, `/matter_matrix_snapshots?id=eq.${snapshotId}&matter_id=eq.${matterId}&select=*&limit=1`);
  if (!rows?.length) throw new ApiError(404, 'Matrix snapshot not found', 'not_found');
  const current = rows[0];
  const readiness = { export_status: current.export_status, blocked_row_count: current.blocked_row_count, review_required_row_count: current.review_required_row_count, coverage_warnings: current.coverage_summary?.coverage_warnings ?? [] };
  if (body.decision === 'approved' && !canApproveMatrix(readiness)) throw new ApiError(409, 'Matrix has unresolved readiness blockers', 'matrix_not_ready');
  const exportStatus = body.decision === 'approved' ? 'attorney_approved' : body.decision === 'rejected' ? 'rejected' : body.decision === 'corrected' ? 'stale' : 'review_required';
  const next = { export_status: exportStatus, approved_by: body.decision === 'approved' ? user.id : null, approved_at: body.decision === 'approved' ? new Date().toISOString() : null };
  await serviceRest(c.env, `/matter_matrix_snapshots?id=eq.${snapshotId}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify(next) });
  await serviceRest(c.env, '/matter_matrix_reviews', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, snapshot_id: snapshotId, reviewer_id: user.id, decision: body.decision, previous_value: current, new_value: next, rationale: body.rationale ?? null }) });
  return c.json({ data: { id: snapshotId, ...next } });
});
