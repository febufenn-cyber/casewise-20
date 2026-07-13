import { Hono } from 'hono';
import type { Env, Variables } from '../env';
import { contradictionWarnings, detectStructuredConflicts, validateContradictionCandidate, validateMissingInformation } from '../../../../packages/core/src/contradictions.mjs';
import { audit } from '../lib/audit';
import { requireMatterRole } from '../lib/authorization';
import { ApiError, readJson } from '../lib/http';
import { serviceRest, userRest } from '../lib/supabase';

export const contradictions = new Hono<{ Bindings: Env; Variables: Variables }>();

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

function objectTable(type: string) {
  return ({ allegation: 'allegations', response: 'responses', candidate_event: 'candidate_events', evidence_item: 'evidence_items', date_mention: 'date_mentions', amount_mention: 'amount_mentions', entity: 'entities', logical_document: 'logical_documents' } as Record<string, string>)[type];
}

contradictions.get('/matters/:matterId/contradictions', async (c) => {
  const matterId = c.req.param('matterId');
  await requireMatterRole(c.env, c.get('accessToken'), c.get('user').id, matterId, 'viewer');
  const rows = await userRest(c.env, c.get('accessToken'), `/contradiction_candidates?matter_id=eq.${matterId}&status=neq.deleted&select=*,contradiction_candidate_sources(*)&order=materiality.asc,created_at.asc`);
  return c.json({ data: rows });
});

contradictions.post('/matters/:matterId/contradictions', async (c) => {
  const matterId = c.req.param('matterId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'editor');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<Record<string, unknown>>(c.req.raw);
  let value;
  try { value = validateContradictionCandidate(body); }
  catch (error) { throw new ApiError(400, error instanceof Error ? error.message : 'Invalid contradiction candidate', 'invalid_contradiction_candidate'); }
  await requireMatterObjects(c.env, matterId, objectTable(value.object_a_type), [value.object_a_id]);
  await requireMatterObjects(c.env, matterId, objectTable(value.object_b_type), [value.object_b_id]);
  await requireMatterObjects(c.env, matterId, 'source_spans', [...value.source_a_span_ids, ...value.source_b_span_ids]);
  const id = crypto.randomUUID(); const warnings = contradictionWarnings(value);
  await serviceRest(c.env, '/contradiction_candidates', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id, organization_id: matter.organization_id, matter_id: matterId, object_a_type: value.object_a_type, object_a_id: value.object_a_id, object_b_type: value.object_b_type, object_b_id: value.object_b_id, contradiction_type: value.contradiction_type, explanation: value.explanation, materiality: value.materiality, warnings, creation_method: value.creation_method, processing_version: value.processing_version, created_by: user.id }) });
  const sources = [...value.source_a_span_ids.map((sourceSpanId: string) => ({ side: 'a', sourceSpanId })), ...value.source_b_span_ids.map((sourceSpanId: string) => ({ side: 'b', sourceSpanId }))];
  await serviceRest(c.env, '/contradiction_candidate_sources', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(sources.map((source) => ({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, contradiction_candidate_id: id, side: source.side, source_span_id: source.sourceSpanId }))) });
  await audit(c.env, { organization_id: matter.organization_id, matter_id: matterId, actor_id: user.id, action: 'contradiction_candidate.created', resource_type: 'contradiction_candidate', resource_id: id, request_id: c.get('requestId'), metadata: { contradiction_type: value.contradiction_type, warnings: warnings.length } });
  return c.json({ data: { id, warnings } }, 201);
});

contradictions.post('/matters/:matterId/contradictions/structured-proposals', async (c) => {
  const matterId = c.req.param('matterId');
  await requireMatterRole(c.env, c.get('accessToken'), c.get('user').id, matterId, 'reviewer');
  const body = await readJson<{ items?: Record<string, unknown>[] }>(c.req.raw);
  return c.json({ data: detectStructuredConflicts(body.items ?? []) });
});

contradictions.post('/matters/:matterId/contradictions/:candidateId/review', async (c) => {
  const matterId = c.req.param('matterId'); const candidateId = c.req.param('candidateId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'reviewer');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<{ decision?: string; explanation?: string; materiality?: string; rationale?: string }>(c.req.raw);
  if (!['confirmed','explained','duplicate','false_positive','unresolved'].includes(body.decision ?? '')) throw new ApiError(400, 'invalid contradiction decision', 'invalid_request');
  const current = await serviceRest(c.env, `/contradiction_candidates?id=eq.${candidateId}&matter_id=eq.${matterId}&status=eq.active&select=*&limit=1`);
  if (!current?.length) throw new ApiError(404, 'Contradiction candidate not found', 'not_found');
  const next = { decision_status: body.decision, explanation: body.explanation ?? current[0].explanation, materiality: body.materiality ?? current[0].materiality, review_status: body.decision === 'false_positive' ? 'rejected' : body.decision === 'unresolved' ? 'unresolved' : 'accepted', updated_at: new Date().toISOString() };
  await serviceRest(c.env, `/contradiction_candidates?id=eq.${candidateId}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify(next) });
  await serviceRest(c.env, '/contradiction_reviews', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, contradiction_candidate_id: candidateId, reviewer_id: user.id, decision: body.decision, previous_value: current[0], new_value: next, rationale: body.rationale ?? null }) });
  await serviceRest(c.env, '/object_revisions', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, object_type: 'contradiction_candidate', object_id: candidateId, previous_value: current[0], new_value: next, reason: body.rationale ?? body.decision, reviewer_id: user.id }) });
  return c.json({ data: { id: candidateId, ...next } });
});

contradictions.get('/matters/:matterId/missing-information', async (c) => {
  const matterId = c.req.param('matterId');
  await requireMatterRole(c.env, c.get('accessToken'), c.get('user').id, matterId, 'viewer');
  const rows = await userRest(c.env, c.get('accessToken'), `/missing_information_items?matter_id=eq.${matterId}&resolution_status=not.eq.dismissed&select=*,missing_information_sources(*)&order=materiality.asc,created_at.asc`);
  return c.json({ data: rows });
});

contradictions.post('/matters/:matterId/missing-information', async (c) => {
  const matterId = c.req.param('matterId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'editor');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<Record<string, unknown>>(c.req.raw);
  let value;
  try { value = validateMissingInformation(body); }
  catch (error) { throw new ApiError(400, error instanceof Error ? error.message : 'Invalid missing information item', 'invalid_missing_information'); }
  if (value.related_type && value.related_id) await requireMatterObjects(c.env, matterId, objectTable(value.related_type), [value.related_id]);
  await requireMatterObjects(c.env, matterId, 'source_spans', value.source_span_ids);
  const id = crypto.randomUUID();
  await serviceRest(c.env, '/missing_information_items', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id, organization_id: matter.organization_id, matter_id: matterId, category: value.category, title: value.title, description: value.description, scope_note: value.scope_note, materiality: value.materiality, related_type: value.related_type, related_id: value.related_id, created_by: user.id }) });
  if (value.source_span_ids.length) await serviceRest(c.env, '/missing_information_sources', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(value.source_span_ids.map((sourceSpanId: string) => ({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, missing_information_item_id: id, source_span_id: sourceSpanId }))) });
  return c.json({ data: { id } }, 201);
});

contradictions.post('/matters/:matterId/missing-information/:itemId/review', async (c) => {
  const matterId = c.req.param('matterId'); const itemId = c.req.param('itemId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'reviewer');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<{ decision?: string; resolution?: string; title?: string; materiality?: string; rationale?: string }>(c.req.raw);
  if (!['resolved','dismissed','unresolved','corrected'].includes(body.decision ?? '')) throw new ApiError(400, 'invalid missing-information decision', 'invalid_request');
  const current = await serviceRest(c.env, `/missing_information_items?id=eq.${itemId}&matter_id=eq.${matterId}&select=*&limit=1`);
  if (!current?.length) throw new ApiError(404, 'Missing information item not found', 'not_found');
  const status = body.decision === 'corrected' ? 'open' : body.decision;
  const next = { title: body.title ?? current[0].title, materiality: body.materiality ?? current[0].materiality, resolution_status: status, resolution: body.resolution ?? current[0].resolution, resolved_by: status === 'open' ? null : user.id, resolved_at: status === 'open' ? null : new Date().toISOString(), updated_at: new Date().toISOString() };
  await serviceRest(c.env, `/missing_information_items?id=eq.${itemId}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify(next) });
  await serviceRest(c.env, '/missing_information_reviews', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, missing_information_item_id: itemId, reviewer_id: user.id, decision: body.decision, previous_value: current[0], new_value: next, rationale: body.rationale ?? null }) });
  return c.json({ data: { id: itemId, ...next } });
});
