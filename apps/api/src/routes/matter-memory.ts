import { Hono } from 'hono';
import type { Env, Variables } from '../env';
import { matchRunReadiness } from '../../../../packages/core/src/delta-matching.mjs';
import { buildMatterMemoryEntries, deltaApprovalReadiness, matterMemorySummary } from '../../../../packages/core/src/matter-memory.mjs';
import { audit } from '../lib/audit';
import { requireMatterRole } from '../lib/authorization';
import { ApiError, readJson } from '../lib/http';
import { serviceRest, userRest } from '../lib/supabase';

export const matterMemory = new Hono<{ Bindings: Env; Variables: Variables }>();

async function activeMatter(env: Env, matterId: string) {
  const rows = await serviceRest(env, `/matters?id=eq.${matterId}&status=eq.active&select=id,organization_id&limit=1`) as Record<string, any>[];
  if (!rows?.length) throw new ApiError(409, 'Active matter required', 'invalid_matter_state');
  return rows[0];
}

async function snapshotContext(env: Env, matterId: string, snapshotId: string) {
  const snapshots = await serviceRest(env, `/delta_snapshots?id=eq.${snapshotId}&matter_id=eq.${matterId}&status=eq.active&select=*&limit=1`) as Record<string, any>[];
  if (!snapshots?.length) throw new ApiError(404, 'Active delta snapshot not found', 'not_found');
  const snapshot = snapshots[0];
  const [items, matches] = await Promise.all([
    serviceRest(env, `/delta_items?delta_snapshot_id=eq.${snapshotId}&matter_id=eq.${matterId}&status=eq.active&select=*`) as Promise<Record<string, any>[]>,
    serviceRest(env, `/delta_match_candidates?match_run_id=eq.${snapshot.match_run_id}&matter_id=eq.${matterId}&selected=eq.true&review_status=neq.rejected&select=*`) as Promise<Record<string, any>[]>,
  ]);
  const readiness = deltaApprovalReadiness(items ?? [], matchRunReadiness(matches ?? []));
  return { snapshot, items: items ?? [], readiness };
}

matterMemory.get('/matters/:matterId/matter-memory/snapshots', async (c) => {
  const matterId = c.req.param('matterId');
  await requireMatterRole(c.env, c.get('accessToken'), c.get('user').id, matterId, 'viewer');
  const rows = await userRest(c.env, c.get('accessToken'), `/matter_memory_snapshots?matter_id=eq.${matterId}&status=neq.deleted&select=*&order=version_number.desc`);
  return c.json({ data: rows });
});

matterMemory.get('/matters/:matterId/matter-memory', async (c) => {
  const matterId = c.req.param('matterId');
  await requireMatterRole(c.env, c.get('accessToken'), c.get('user').id, matterId, 'viewer');
  const snapshots = await userRest(c.env, c.get('accessToken'), `/matter_memory_snapshots?matter_id=eq.${matterId}&status=eq.active&select=*&order=version_number.desc&limit=1`) as Record<string, any>[];
  if (!snapshots?.length) return c.json({ data: null });
  const snapshot = snapshots[0];
  const partyId = c.req.query('party_id'); const documentId = c.req.query('document_id'); const changeType = c.req.query('change_type'); const materiality = c.req.query('materiality');
  const filters = [
    `memory_snapshot_id=eq.${snapshot.id}`,
    `matter_id=eq.${matterId}`,
    'status=eq.active',
    partyId ? `party_entity_ids=cs.{${partyId}}` : '',
    documentId ? `logical_document_ids=cs.{${documentId}}` : '',
    changeType ? `change_type=eq.${changeType}` : '',
    materiality ? `materiality=eq.${materiality}` : '',
  ].filter(Boolean).join('&');
  const entries = await userRest(c.env, c.get('accessToken'), `/matter_memory_entries?${filters}&select=*&order=created_at.asc`) as Record<string, any>[];
  return c.json({ data: { snapshot, entries: entries ?? [], summary: matterMemorySummary(entries ?? []) } });
});

matterMemory.get('/matters/:matterId/delta-snapshots/:snapshotId/approval-readiness', async (c) => {
  const matterId = c.req.param('matterId'); const snapshotId = c.req.param('snapshotId');
  await requireMatterRole(c.env, c.get('accessToken'), c.get('user').id, matterId, 'viewer');
  const context = await snapshotContext(c.env, matterId, snapshotId);
  return c.json({ data: context.readiness });
});

matterMemory.post('/matters/:matterId/delta-snapshots/:snapshotId/review', async (c) => {
  const matterId = c.req.param('matterId'); const snapshotId = c.req.param('snapshotId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'reviewer');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<{ decision?: string; rationale?: string }>(c.req.raw);
  if (!['approved','rejected','unresolved'].includes(body.decision ?? '')) throw new ApiError(400, 'Invalid delta snapshot review decision', 'invalid_request');
  const context = await snapshotContext(c.env, matterId, snapshotId);
  if (body.decision === 'approved' && !context.readiness.can_approve) throw new ApiError(409, 'Delta snapshot has unresolved approval blockers', 'delta_snapshot_not_ready', context.readiness);

  const now = new Date().toISOString();
  if (body.decision !== 'approved') {
    const next = { approval_status: body.decision === 'rejected' ? 'rejected' : 'review_required', review_status: body.decision === 'rejected' ? 'rejected' : 'unresolved', approved_by: null, approved_at: null };
    await serviceRest(c.env, `/delta_snapshots?id=eq.${snapshotId}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify(next) });
    await serviceRest(c.env, '/delta_snapshot_reviews', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, delta_snapshot_id: snapshotId, reviewer_id: user.id, decision: body.decision, readiness: context.readiness, previous_value: context.snapshot, new_value: next, rationale: body.rationale ?? null }) });
    return c.json({ data: { id: snapshotId, ...next, readiness: context.readiness } });
  }

  const entries = buildMatterMemoryEntries(context.snapshot, context.items);
  const latest = await serviceRest(c.env, `/matter_memory_snapshots?matter_id=eq.${matterId}&select=version_number&order=version_number.desc&limit=1`) as Record<string, any>[];
  const versionNumber = Number(latest?.[0]?.version_number ?? 0) + 1; const memorySnapshotId = crypto.randomUUID();
  await serviceRest(c.env, `/matter_memory_snapshots?matter_id=eq.${matterId}&status=eq.active`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ status: 'superseded' }) });
  await serviceRest(c.env, '/matter_memory_snapshots', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: memorySnapshotId, organization_id: matter.organization_id, matter_id: matterId, version_number: versionNumber, delta_snapshot_id: snapshotId, entry_count: entries.length, created_by: user.id }) });
  if (entries.length) {
    await serviceRest(c.env, '/matter_memory_entries', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(entries.map((entry) => ({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, memory_snapshot_id: memorySnapshotId, ...entry }))) });
  }
  const next = { approval_status: 'attorney_approved', review_status: 'accepted', approved_by: user.id, approved_at: now, reviewed_at: now };
  await serviceRest(c.env, `/delta_snapshots?id=eq.${snapshotId}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify(next) });
  await serviceRest(c.env, '/delta_snapshot_reviews', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, delta_snapshot_id: snapshotId, reviewer_id: user.id, decision: 'approved', readiness: context.readiness, previous_value: context.snapshot, new_value: { ...next, memory_snapshot_id: memorySnapshotId }, rationale: body.rationale ?? null }) });
  await audit(c.env, { organization_id: matter.organization_id, matter_id: matterId, actor_id: user.id, action: 'delta_snapshot.approved', resource_type: 'delta_snapshot', resource_id: snapshotId, request_id: c.get('requestId'), metadata: { memory_snapshot_id: memorySnapshotId, memory_version_number: versionNumber, entry_count: entries.length } });
  return c.json({ data: { id: snapshotId, ...next, memory_snapshot_id: memorySnapshotId, memory_version_number: versionNumber, entry_count: entries.length } });
});
