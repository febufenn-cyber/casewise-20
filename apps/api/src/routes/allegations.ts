import { Hono } from 'hono';
import type { Env, Variables } from '../env';
import { allegationWarnings, duplicateAllegationCandidates, validateAllegation } from '../../../../packages/core/src/allegations.mjs';
import { audit } from '../lib/audit';
import { requireMatterRole } from '../lib/authorization';
import { ApiError, readJson } from '../lib/http';
import { serviceRest, userRest } from '../lib/supabase';

export const allegations = new Hono<{ Bindings: Env; Variables: Variables }>();

async function activeMatter(env: Env, matterId: string) {
  const rows = await serviceRest(env, `/matters?id=eq.${matterId}&status=eq.active&select=id,organization_id&limit=1`);
  if (!rows?.length) throw new ApiError(409, 'Active matter required', 'invalid_matter_state');
  return rows[0];
}

async function requireMatterObjects(env: Env, matterId: string, table: string, ids: string[]) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) return;
  const rows = await serviceRest(env, `/${table}?id=in.(${uniqueIds.join(',')})&matter_id=eq.${matterId}&select=id`);
  if (rows?.length !== uniqueIds.length) throw new ApiError(400, `${table} must belong to the matter`, 'invalid_matter_objects');
}

allegations.get('/matters/:matterId/allegations', async (c) => {
  const matterId = c.req.param('matterId');
  await requireMatterRole(c.env, c.get('accessToken'), c.get('user').id, matterId, 'viewer');
  const rows = await userRest(c.env, c.get('accessToken'), `/allegations?matter_id=eq.${matterId}&status=neq.deleted&select=*,allegation_sources(*),allegation_relations!allegation_relations_source_allegation_id_fkey(*)&order=created_at.asc`);
  return c.json({ data: rows });
});

allegations.post('/matters/:matterId/allegations', async (c) => {
  const matterId = c.req.param('matterId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'editor');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<Record<string, unknown>>(c.req.raw);
  let value;
  try { value = validateAllegation(body); }
  catch (error) { throw new ApiError(400, error instanceof Error ? error.message : 'Invalid allegation', 'invalid_allegation'); }
  await requireMatterObjects(c.env, matterId, 'source_spans', value.source_span_ids);
  await requireMatterObjects(c.env, matterId, 'entities', [value.alleging_entity_id, ...value.target_entity_ids].filter(Boolean) as string[]);
  if (value.logical_document_id) await requireMatterObjects(c.env, matterId, 'logical_documents', [value.logical_document_id]);
  const id = crypto.randomUUID(); const warnings = allegationWarnings(value);
  await serviceRest(c.env, '/allegations', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id, organization_id: matter.organization_id, matter_id: matterId, logical_document_id: value.logical_document_id, alleging_entity_id: value.alleging_entity_id, target_entity_ids: value.target_entity_ids, proposition: value.proposition, allegation_type: value.allegation_type, procedural_context: value.procedural_context, materiality: value.materiality, warnings, creation_method: value.creation_method, processing_version: value.processing_version, review_status: value.creation_method === 'extracted' ? 'unreviewed' : 'accepted', created_by: user.id }) });
  await serviceRest(c.env, '/allegation_sources', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(value.source_span_ids.map((sourceSpanId: string, index: number) => ({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, allegation_id: id, source_span_id: sourceSpanId, source_role: index === 0 ? 'primary' : 'supporting' }))) });
  await audit(c.env, { organization_id: matter.organization_id, matter_id: matterId, actor_id: user.id, action: 'allegation.created', resource_type: 'allegation', resource_id: id, request_id: c.get('requestId'), metadata: { allegation_type: value.allegation_type, materiality: value.materiality, warnings: warnings.length } });
  return c.json({ data: { id, warnings } }, 201);
});

allegations.post('/matters/:matterId/allegations/duplicate-proposals', async (c) => {
  const matterId = c.req.param('matterId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'reviewer');
  const matter = await activeMatter(c.env, matterId);
  const rows = await serviceRest(c.env, `/allegations?matter_id=eq.${matterId}&status=eq.active&select=*`);
  const proposals = duplicateAllegationCandidates(rows ?? []);
  for (const proposal of proposals) {
    const [target, ...duplicates] = proposal.allegation_ids;
    for (const source of duplicates) await serviceRest(c.env, '/allegation_relations', { method: 'POST', prefer: 'return=minimal,resolution=ignore-duplicates', body: JSON.stringify({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, source_allegation_id: source, target_allegation_id: target, relationship_type: 'duplicate_of', decision_status: 'candidate', rationale: 'Deterministic allegation fingerprint match', created_by: user.id }) });
  }
  return c.json({ data: proposals });
});

allegations.post('/matters/:matterId/allegations/:allegationId/review', async (c) => {
  const matterId = c.req.param('matterId'); const allegationId = c.req.param('allegationId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'reviewer');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<{ decision?: string; proposition?: string; materiality?: string; allegation_type?: string; rationale?: string }>(c.req.raw);
  if (!['accepted','corrected','rejected','unresolved'].includes(body.decision ?? '')) throw new ApiError(400, 'invalid review decision', 'invalid_request');
  const current = await serviceRest(c.env, `/allegations?id=eq.${allegationId}&matter_id=eq.${matterId}&status=eq.active&select=*&limit=1`);
  if (!current?.length) throw new ApiError(404, 'Allegation not found', 'not_found');
  const next = { proposition: body.proposition ?? current[0].proposition, materiality: body.materiality ?? current[0].materiality, allegation_type: body.allegation_type ?? current[0].allegation_type, review_status: body.decision, status: body.decision === 'rejected' ? 'stale' : current[0].status, updated_at: new Date().toISOString() };
  await serviceRest(c.env, `/allegations?id=eq.${allegationId}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify(next) });
  await serviceRest(c.env, '/allegation_reviews', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, allegation_id: allegationId, reviewer_id: user.id, decision: body.decision, previous_value: current[0], new_value: next, rationale: body.rationale ?? null }) });
  await serviceRest(c.env, '/object_revisions', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, object_type: 'allegation', object_id: allegationId, previous_value: current[0], new_value: next, reason: body.rationale ?? body.decision, reviewer_id: user.id }) });
  await serviceRest(c.env, `/artifact_dependencies?matter_id=eq.${matterId}&source_type=eq.allegation&source_id=eq.${allegationId}&status=eq.active`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ status: 'stale' }) });
  return c.json({ data: { id: allegationId, ...next } });
});
