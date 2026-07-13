import { Hono } from 'hono';
import type { Env, Variables } from '../env';
import { responseWarnings, validateResponse, validateResponseCoverage, validateResponseLink } from '../../../../packages/core/src/responses.mjs';
import { audit } from '../lib/audit';
import { requireMatterRole } from '../lib/authorization';
import { ApiError, readJson } from '../lib/http';
import { serviceRest, userRest } from '../lib/supabase';

export const responses = new Hono<{ Bindings: Env; Variables: Variables }>();

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

responses.get('/matters/:matterId/responses', async (c) => {
  const matterId = c.req.param('matterId');
  await requireMatterRole(c.env, c.get('accessToken'), c.get('user').id, matterId, 'viewer');
  const rows = await userRest(c.env, c.get('accessToken'), `/responses?matter_id=eq.${matterId}&status=neq.deleted&select=*,response_sources(*),allegation_response_links(*)&order=created_at.asc`);
  return c.json({ data: rows });
});

responses.get('/matters/:matterId/allegations/:allegationId/responses', async (c) => {
  const matterId = c.req.param('matterId'); const allegationId = c.req.param('allegationId');
  await requireMatterRole(c.env, c.get('accessToken'), c.get('user').id, matterId, 'viewer');
  const [links, coverage] = await Promise.all([
    userRest(c.env, c.get('accessToken'), `/allegation_response_links?matter_id=eq.${matterId}&allegation_id=eq.${allegationId}&select=*,responses(*,response_sources(*))&order=created_at.asc`),
    userRest(c.env, c.get('accessToken'), `/allegation_response_searches?matter_id=eq.${matterId}&allegation_id=eq.${allegationId}&select=*&order=created_at.desc`),
  ]);
  return c.json({ data: { links, coverage } });
});

responses.post('/matters/:matterId/allegations/:allegationId/responses', async (c) => {
  const matterId = c.req.param('matterId'); const allegationId = c.req.param('allegationId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'editor');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<Record<string, unknown>>(c.req.raw);
  let responseValue; let linkValue;
  try { responseValue = validateResponse(body); linkValue = validateResponseLink(body); }
  catch (error) { throw new ApiError(400, error instanceof Error ? error.message : 'Invalid response', 'invalid_response'); }
  await requireMatterObjects(c.env, matterId, 'allegations', [allegationId]);
  await requireMatterObjects(c.env, matterId, 'source_spans', responseValue.source_span_ids);
  await requireMatterObjects(c.env, matterId, 'entities', [responseValue.responding_entity_id].filter(Boolean) as string[]);
  if (responseValue.logical_document_id) await requireMatterObjects(c.env, matterId, 'logical_documents', [responseValue.logical_document_id]);
  const responseId = crypto.randomUUID(); const linkId = crypto.randomUUID(); const warnings = responseWarnings(responseValue, linkValue);
  await serviceRest(c.env, '/responses', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: responseId, organization_id: matter.organization_id, matter_id: matterId, logical_document_id: responseValue.logical_document_id, responding_entity_id: responseValue.responding_entity_id, proposition: responseValue.proposition, response_mode: responseValue.response_mode, warnings, creation_method: responseValue.creation_method, processing_version: responseValue.processing_version, review_status: responseValue.creation_method === 'extracted' ? 'unreviewed' : 'accepted', created_by: user.id }) });
  await serviceRest(c.env, '/response_sources', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(responseValue.source_span_ids.map((sourceSpanId: string, index: number) => ({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, response_id: responseId, source_span_id: sourceSpanId, source_role: index === 0 ? 'primary' : 'supporting' }))) });
  await serviceRest(c.env, '/allegation_response_links', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: linkId, organization_id: matter.organization_id, matter_id: matterId, allegation_id: allegationId, response_id: responseId, response_class: linkValue.response_class, addressed_scope: linkValue.addressed_scope, rationale: linkValue.rationale, review_status: responseValue.creation_method === 'extracted' ? 'unreviewed' : 'accepted', created_by: user.id }) });
  await audit(c.env, { organization_id: matter.organization_id, matter_id: matterId, actor_id: user.id, action: 'response.created', resource_type: 'response', resource_id: responseId, request_id: c.get('requestId'), metadata: { allegation_id: allegationId, response_class: linkValue.response_class, warnings: warnings.length } });
  return c.json({ data: { response_id: responseId, link_id: linkId, warnings } }, 201);
});

responses.post('/matters/:matterId/allegations/:allegationId/response-searches', async (c) => {
  const matterId = c.req.param('matterId'); const allegationId = c.req.param('allegationId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'reviewer');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<Record<string, unknown>>(c.req.raw);
  let value;
  try { value = validateResponseCoverage(body); }
  catch (error) { throw new ApiError(400, error instanceof Error ? error.message : 'Invalid response coverage', 'invalid_response_coverage'); }
  await requireMatterObjects(c.env, matterId, 'allegations', [allegationId]);
  await requireMatterObjects(c.env, matterId, 'entities', [value.expected_responding_entity_id].filter(Boolean) as string[]);
  await requireMatterObjects(c.env, matterId, 'logical_documents', value.searched_document_ids);
  const id = crypto.randomUUID();
  await serviceRest(c.env, '/allegation_response_searches', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id, organization_id: matter.organization_id, matter_id: matterId, allegation_id: allegationId, expected_responding_entity_id: value.expected_responding_entity_id, searched_document_ids: value.searched_document_ids, coverage_status: value.coverage_status, scope_note: value.scope_note, reviewed_by: user.id, reviewed_at: new Date().toISOString() }) });
  await audit(c.env, { organization_id: matter.organization_id, matter_id: matterId, actor_id: user.id, action: 'response_search.recorded', resource_type: 'allegation', resource_id: allegationId, request_id: c.get('requestId'), metadata: { coverage_status: value.coverage_status, searched_documents: value.searched_document_ids.length } });
  return c.json({ data: { id, ...value } }, 201);
});

responses.post('/matters/:matterId/responses/:responseId/review', async (c) => {
  const matterId = c.req.param('matterId'); const responseId = c.req.param('responseId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'reviewer');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<{ decision?: string; proposition?: string; response_mode?: string; response_class?: string; addressed_scope?: string; rationale?: string }>(c.req.raw);
  if (!['accepted','corrected','rejected','unresolved'].includes(body.decision ?? '')) throw new ApiError(400, 'invalid review decision', 'invalid_request');
  const current = await serviceRest(c.env, `/responses?id=eq.${responseId}&matter_id=eq.${matterId}&status=eq.active&select=*&limit=1`);
  if (!current?.length) throw new ApiError(404, 'Response not found', 'not_found');
  const next = { proposition: body.proposition ?? current[0].proposition, response_mode: body.response_mode ?? current[0].response_mode, review_status: body.decision, status: body.decision === 'rejected' ? 'stale' : current[0].status, updated_at: new Date().toISOString() };
  await serviceRest(c.env, `/responses?id=eq.${responseId}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify(next) });
  if (body.response_class || body.addressed_scope) await serviceRest(c.env, `/allegation_response_links?response_id=eq.${responseId}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ ...(body.response_class ? { response_class: body.response_class } : {}), ...(body.addressed_scope ? { addressed_scope: body.addressed_scope } : {}), review_status: body.decision, updated_at: new Date().toISOString() }) });
  await serviceRest(c.env, '/response_reviews', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, response_id: responseId, reviewer_id: user.id, decision: body.decision, previous_value: current[0], new_value: next, rationale: body.rationale ?? null }) });
  await serviceRest(c.env, '/object_revisions', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, object_type: 'response', object_id: responseId, previous_value: current[0], new_value: next, reason: body.rationale ?? body.decision, reviewer_id: user.id }) });
  await serviceRest(c.env, `/artifact_dependencies?matter_id=eq.${matterId}&source_type=eq.response&source_id=eq.${responseId}&status=eq.active`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ status: 'stale' }) });
  return c.json({ data: { id: responseId, ...next } });
});
