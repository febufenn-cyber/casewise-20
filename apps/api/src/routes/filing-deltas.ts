import { Hono } from 'hono';
import type { Env, Variables } from '../env';
import { buildFilingDeltaItems, deltaSnapshotReadiness } from '../../../../packages/core/src/filing-deltas.mjs';
import { matchRunReadiness } from '../../../../packages/core/src/delta-matching.mjs';
import { audit } from '../lib/audit';
import { requireMatterRole } from '../lib/authorization';
import { ApiError, readJson } from '../lib/http';
import { serviceRest, userRest } from '../lib/supabase';

export const filingDeltas = new Hono<{ Bindings: Env; Variables: Variables }>();

const CHANGE_TYPES = new Set(['new','removed','unchanged','restated','narrowed','expanded','amended','response_changed','response_coverage_changed','date_changed','amount_changed','party_or_role_changed','document_reference_changed','evidence_relationship_changed','contradiction_opened','contradiction_resolved','information_gap_opened','information_gap_resolved']);
const MATERIALITY = new Set(['critical','high','medium','low','unrated']);

async function activeMatter(env: Env, matterId: string) {
  const rows = await serviceRest(env, `/matters?id=eq.${matterId}&status=eq.active&select=id,organization_id&limit=1`) as Record<string, any>[];
  if (!rows?.length) throw new ApiError(409, 'Active matter required', 'invalid_matter_state');
  return rows[0];
}

filingDeltas.get('/matters/:matterId/delta-snapshots', async (c) => {
  const matterId = c.req.param('matterId');
  await requireMatterRole(c.env, c.get('accessToken'), c.get('user').id, matterId, 'viewer');
  const rows = await userRest(c.env, c.get('accessToken'), `/delta_snapshots?matter_id=eq.${matterId}&status=neq.deleted&select=*&order=version_number.desc`);
  return c.json({ data: rows });
});

filingDeltas.get('/matters/:matterId/delta-snapshots/:snapshotId/items', async (c) => {
  const matterId = c.req.param('matterId'); const snapshotId = c.req.param('snapshotId');
  await requireMatterRole(c.env, c.get('accessToken'), c.get('user').id, matterId, 'viewer');
  const partyId = c.req.query('party_id'); const documentId = c.req.query('document_id'); const changeType = c.req.query('change_type');
  const filters = [
    `delta_snapshot_id=eq.${snapshotId}`,
    `matter_id=eq.${matterId}`,
    'status=eq.active',
    partyId ? `party_entity_ids=cs.{${partyId}}` : '',
    documentId ? `logical_document_ids=cs.{${documentId}}` : '',
    changeType ? `change_type=eq.${changeType}` : '',
  ].filter(Boolean).join('&');
  const rows = await userRest(c.env, c.get('accessToken'), `/delta_items?${filters}&select=*&order=materiality.desc,created_at.asc`);
  return c.json({ data: rows });
});

filingDeltas.post('/matters/:matterId/delta-snapshots/rebuild', async (c) => {
  const matterId = c.req.param('matterId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'reviewer');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<{ match_run_id?: string; processing_version?: string; include_unchanged?: boolean }>(c.req.raw);
  if (!body.match_run_id) throw new ApiError(400, 'match_run_id is required', 'invalid_request');
  const runs = await serviceRest(c.env, `/delta_match_runs?id=eq.${body.match_run_id}&matter_id=eq.${matterId}&status=eq.active&select=*&limit=1`) as Record<string, any>[];
  if (!runs?.length) throw new ApiError(404, 'Active match run not found', 'not_found');
  const run = runs[0];
  const matches = await serviceRest(c.env, `/delta_match_candidates?match_run_id=eq.${body.match_run_id}&matter_id=eq.${matterId}&selected=eq.true&review_status=neq.rejected&select=*`) as Record<string, any>[];
  const matchReadiness = matchRunReadiness(matches ?? []);
  if (!matchReadiness.ready) throw new ApiError(409, 'Ambiguous filing matches remain unresolved', 'delta_matches_not_ready', matchReadiness);
  const [priorMembers, currentMembers] = await Promise.all([
    serviceRest(c.env, `/filing_version_members?filing_version_id=eq.${run.prior_version_id}&matter_id=eq.${matterId}&select=*`) as Promise<Record<string, any>[]>,
    serviceRest(c.env, `/filing_version_members?filing_version_id=eq.${run.current_version_id}&matter_id=eq.${matterId}&select=*`) as Promise<Record<string, any>[]>,
  ]);
  const items = buildFilingDeltaItems(matches ?? [], priorMembers ?? [], currentMembers ?? [], { include_unchanged: body.include_unchanged });
  const readiness = deltaSnapshotReadiness(items);
  const latest = await serviceRest(c.env, `/delta_snapshots?matter_id=eq.${matterId}&select=version_number&order=version_number.desc&limit=1`) as Record<string, any>[];
  const versionNumber = Number(latest?.[0]?.version_number ?? 0) + 1; const snapshotId = crypto.randomUUID();
  await serviceRest(c.env, `/delta_snapshots?matter_id=eq.${matterId}&prior_version_id=eq.${run.prior_version_id}&current_version_id=eq.${run.current_version_id}&status=eq.active`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ status: 'superseded' }) });
  await serviceRest(c.env, '/delta_snapshots', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: snapshotId, organization_id: matter.organization_id, matter_id: matterId, version_number: versionNumber, prior_version_id: run.prior_version_id, current_version_id: run.current_version_id, match_run_id: body.match_run_id, processing_version: body.processing_version ?? 'phase4-deltas-v1', item_count: readiness.item_count, changed_item_count: readiness.changed_item_count, blocked_item_count: readiness.blocked_item_count, review_required_item_count: readiness.review_required_item_count, created_by: user.id }) });
  const itemIds = new Map<number, string>();
  if (items.length) {
    const rows = items.map((item, index) => {
      const id = crypto.randomUUID(); itemIds.set(index, id);
      return { id, organization_id: matter.organization_id, matter_id: matterId, delta_snapshot_id: snapshotId, ...item };
    });
    await serviceRest(c.env, '/delta_items', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(rows) });
    const tasks = items.map((item, index) => ({
      id: crypto.randomUUID(),
      organization_id: matter.organization_id,
      matter_id: matterId,
      task_type: 'delta_item_review',
      object_type: 'delta_item',
      object_id: itemIds.get(index),
      priority: item.materiality === 'critical' ? 100 : item.materiality === 'high' ? 80 : item.materiality === 'medium' ? 50 : 25,
      reason: `${item.change_type}:${item.object_type}`,
    }));
    await serviceRest(c.env, '/review_tasks', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(tasks) });
  }
  await audit(c.env, { organization_id: matter.organization_id, matter_id: matterId, actor_id: user.id, action: 'delta_snapshot.rebuilt', resource_type: 'delta_snapshot', resource_id: snapshotId, request_id: c.get('requestId'), metadata: { version_number: versionNumber, prior_version_id: run.prior_version_id, current_version_id: run.current_version_id, ...readiness } });
  return c.json({ data: { snapshot_id: snapshotId, version_number: versionNumber, ...readiness } }, 201);
});

filingDeltas.get('/matters/:matterId/delta-snapshots/:snapshotId/readiness', async (c) => {
  const matterId = c.req.param('matterId'); const snapshotId = c.req.param('snapshotId');
  await requireMatterRole(c.env, c.get('accessToken'), c.get('user').id, matterId, 'viewer');
  const rows = await userRest(c.env, c.get('accessToken'), `/delta_items?delta_snapshot_id=eq.${snapshotId}&matter_id=eq.${matterId}&status=eq.active&select=change_type,materiality,review_status`) as Record<string, any>[];
  return c.json({ data: deltaSnapshotReadiness(rows ?? []) });
});

filingDeltas.post('/matters/:matterId/delta-items/:itemId/review', async (c) => {
  const matterId = c.req.param('matterId'); const itemId = c.req.param('itemId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'reviewer');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<{ decision?: string; change_type?: string; materiality?: string; summary?: string; details?: Record<string, unknown>; rationale?: string }>(c.req.raw);
  if (!['accepted','corrected','rejected','unresolved'].includes(body.decision ?? '')) throw new ApiError(400, 'Invalid delta review decision', 'invalid_request');
  if (body.change_type && !CHANGE_TYPES.has(body.change_type)) throw new ApiError(400, 'Invalid change type', 'invalid_request');
  if (body.materiality && !MATERIALITY.has(body.materiality)) throw new ApiError(400, 'Invalid materiality', 'invalid_request');
  const rows = await serviceRest(c.env, `/delta_items?id=eq.${itemId}&matter_id=eq.${matterId}&status=eq.active&select=*&limit=1`) as Record<string, any>[];
  if (!rows?.length) throw new ApiError(404, 'Delta item not found', 'not_found');
  const current = rows[0];
  const next = {
    change_type: body.change_type ?? current.change_type,
    materiality: body.materiality ?? current.materiality,
    summary: body.summary?.trim() || current.summary,
    details: body.details ?? current.details,
    review_status: body.decision,
    status: body.decision === 'rejected' ? 'stale' : current.status,
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
  };
  await serviceRest(c.env, `/delta_items?id=eq.${itemId}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify(next) });
  await serviceRest(c.env, '/delta_item_reviews', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, delta_item_id: itemId, reviewer_id: user.id, decision: body.decision, previous_value: current, new_value: next, rationale: body.rationale ?? null }) });
  await serviceRest(c.env, `/artifact_dependencies?matter_id=eq.${matterId}&source_type=eq.delta_item&source_id=eq.${itemId}&status=eq.active`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ status: 'stale' }) });
  return c.json({ data: { id: itemId, ...next } });
});
