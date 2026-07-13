import { Hono } from 'hono';
import type { Env, Variables } from '../env';
import { supportCoverage, supportWarnings, validateEvidenceItem, validateSupportLink } from '../../../../packages/core/src/evidence-support.mjs';
import { audit } from '../lib/audit';
import { requireMatterRole } from '../lib/authorization';
import { ApiError, readJson } from '../lib/http';
import { serviceRest, userRest } from '../lib/supabase';

export const evidence = new Hono<{ Bindings: Env; Variables: Variables }>();

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

async function requireTarget(env: Env, matterId: string, targetType: string, targetId: string) {
  const table = targetType === 'allegation' ? 'allegations' : targetType === 'response' ? 'responses' : 'candidate_events';
  await requireMatterObjects(env, matterId, table, [targetId]);
}

evidence.get('/matters/:matterId/evidence', async (c) => {
  const matterId = c.req.param('matterId');
  await requireMatterRole(c.env, c.get('accessToken'), c.get('user').id, matterId, 'viewer');
  const rows = await userRest(c.env, c.get('accessToken'), `/evidence_items?matter_id=eq.${matterId}&status=neq.deleted&select=*,evidence_item_sources(*),proposition_evidence_links(*)&order=created_at.asc`);
  return c.json({ data: rows });
});

evidence.get('/matters/:matterId/support/:targetType/:targetId', async (c) => {
  const matterId = c.req.param('matterId'); const targetType = c.req.param('targetType'); const targetId = c.req.param('targetId');
  await requireMatterRole(c.env, c.get('accessToken'), c.get('user').id, matterId, 'viewer');
  const links = await userRest(c.env, c.get('accessToken'), `/proposition_evidence_links?matter_id=eq.${matterId}&target_type=eq.${targetType}&target_id=eq.${targetId}&select=*,evidence_items(*,evidence_item_sources(*))&order=created_at.asc`);
  return c.json({ data: { links, coverage: supportCoverage(links ?? []) } });
});

evidence.post('/matters/:matterId/evidence', async (c) => {
  const matterId = c.req.param('matterId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'editor');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<Record<string, unknown>>(c.req.raw);
  let value;
  try { value = validateEvidenceItem(body); }
  catch (error) { throw new ApiError(400, error instanceof Error ? error.message : 'Invalid evidence item', 'invalid_evidence_item'); }
  await requireMatterObjects(c.env, matterId, 'source_spans', value.source_span_ids);
  await requireMatterObjects(c.env, matterId, 'entities', [value.offered_by_entity_id].filter(Boolean) as string[]);
  if (value.logical_document_id) await requireMatterObjects(c.env, matterId, 'logical_documents', [value.logical_document_id]);
  const id = crypto.randomUUID();
  await serviceRest(c.env, '/evidence_items', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id, organization_id: matter.organization_id, matter_id: matterId, logical_document_id: value.logical_document_id, offered_by_entity_id: value.offered_by_entity_id, title: value.title, description: value.description, evidence_type: value.evidence_type, creation_method: value.creation_method, processing_version: value.processing_version, review_status: value.creation_method === 'extracted' ? 'unreviewed' : 'accepted', created_by: user.id }) });
  await serviceRest(c.env, '/evidence_item_sources', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(value.source_span_ids.map((sourceSpanId: string, index: number) => ({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, evidence_item_id: id, source_span_id: sourceSpanId, source_role: index === 0 ? 'primary' : 'supporting' }))) });
  await audit(c.env, { organization_id: matter.organization_id, matter_id: matterId, actor_id: user.id, action: 'evidence.created', resource_type: 'evidence_item', resource_id: id, request_id: c.get('requestId'), metadata: { evidence_type: value.evidence_type } });
  return c.json({ data: { id } }, 201);
});

evidence.post('/matters/:matterId/evidence/:evidenceItemId/links', async (c) => {
  const matterId = c.req.param('matterId'); const evidenceItemId = c.req.param('evidenceItemId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'editor');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<Record<string, unknown>>(c.req.raw);
  let value;
  try { value = validateSupportLink(body); }
  catch (error) { throw new ApiError(400, error instanceof Error ? error.message : 'Invalid support link', 'invalid_support_link'); }
  await requireMatterObjects(c.env, matterId, 'evidence_items', [evidenceItemId]);
  await requireTarget(c.env, matterId, value.target_type, value.target_id);
  const id = crypto.randomUUID(); const warnings = supportWarnings(value);
  await serviceRest(c.env, '/proposition_evidence_links', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id, organization_id: matter.organization_id, matter_id: matterId, evidence_item_id: evidenceItemId, target_type: value.target_type, target_id: value.target_id, relationship: value.relationship, support_status: value.support_status, rationale: value.rationale, warnings, review_status: 'unreviewed', created_by: user.id }) });
  await audit(c.env, { organization_id: matter.organization_id, matter_id: matterId, actor_id: user.id, action: 'evidence.linked', resource_type: 'proposition_evidence_link', resource_id: id, request_id: c.get('requestId'), metadata: { target_type: value.target_type, relationship: value.relationship, support_status: value.support_status } });
  return c.json({ data: { id, warnings } }, 201);
});

evidence.post('/matters/:matterId/evidence-links/:linkId/review', async (c) => {
  const matterId = c.req.param('matterId'); const linkId = c.req.param('linkId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'reviewer');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<{ decision?: string; relationship?: string; support_status?: string; rationale?: string }>(c.req.raw);
  if (!['accepted','corrected','rejected','unresolved'].includes(body.decision ?? '')) throw new ApiError(400, 'invalid review decision', 'invalid_request');
  const current = await serviceRest(c.env, `/proposition_evidence_links?id=eq.${linkId}&matter_id=eq.${matterId}&select=*&limit=1`);
  if (!current?.length) throw new ApiError(404, 'Evidence link not found', 'not_found');
  const next = { relationship: body.relationship ?? current[0].relationship, support_status: body.support_status ?? current[0].support_status, rationale: body.rationale ?? current[0].rationale, review_status: body.decision, updated_at: new Date().toISOString() };
  await serviceRest(c.env, `/proposition_evidence_links?id=eq.${linkId}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify(next) });
  await serviceRest(c.env, '/evidence_support_reviews', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, proposition_evidence_link_id: linkId, reviewer_id: user.id, decision: body.decision, previous_value: current[0], new_value: next, rationale: body.rationale ?? null }) });
  await serviceRest(c.env, '/object_revisions', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, object_type: 'proposition_evidence_link', object_id: linkId, previous_value: current[0], new_value: next, reason: body.rationale ?? body.decision, reviewer_id: user.id }) });
  await serviceRest(c.env, `/artifact_dependencies?matter_id=eq.${matterId}&source_type=eq.proposition_evidence_link&source_id=eq.${linkId}&status=eq.active`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ status: 'stale' }) });
  return c.json({ data: { id: linkId, ...next } });
});
