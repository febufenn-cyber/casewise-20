import { Hono } from 'hono';
import type { Env, Variables } from '../env';
import { assertionWarnings, duplicateAssertionCandidates, validateEventAssertion } from '../../../../packages/core/src/event-assertions.mjs';
import { audit } from '../lib/audit';
import { requireMatterRole } from '../lib/authorization';
import { ApiError, readJson } from '../lib/http';
import { serviceRest, userRest } from '../lib/supabase';

export const events = new Hono<{ Bindings: Env; Variables: Variables }>();

async function activeMatter(env: Env, matterId: string) {
  const rows = await serviceRest(env, `/matters?id=eq.${matterId}&status=eq.active&select=id,organization_id&limit=1`);
  if (!rows?.length) throw new ApiError(409, 'Active matter required', 'invalid_matter_state');
  return rows[0];
}

async function requireMatterObjects(env: Env, matterId: string, table: string, ids: string[]) {
  if (!ids.length) return [];
  const rows = await serviceRest(env, `/${table}?id=in.(${ids.join(',')})&matter_id=eq.${matterId}&select=id`);
  if (rows?.length !== ids.length) throw new ApiError(400, `${table} must belong to the matter`, 'invalid_matter_objects');
  return rows;
}

events.get('/matters/:matterId/event-assertions', async (c) => {
  const matterId = c.req.param('matterId');
  await requireMatterRole(c.env, c.get('accessToken'), c.get('user').id, matterId, 'viewer');
  const rows = await userRest(c.env, c.get('accessToken'), `/event_assertions?matter_id=eq.${matterId}&status=neq.deleted&select=*,event_assertion_sources(*)&order=created_at.asc`);
  return c.json({ data: rows });
});

events.post('/matters/:matterId/event-assertions', async (c) => {
  const matterId = c.req.param('matterId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'editor');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<Record<string, unknown>>(c.req.raw);
  let value;
  try { value = validateEventAssertion(body); }
  catch (error) { throw new ApiError(400, error instanceof Error ? error.message : 'Invalid assertion', 'invalid_event_assertion'); }
  await requireMatterObjects(c.env, matterId, 'source_spans', value.source_span_ids);
  await requireMatterObjects(c.env, matterId, 'entities', [...new Set([value.asserting_entity_id, ...value.actor_entity_ids, ...value.object_entity_ids].filter(Boolean))]);
  await requireMatterObjects(c.env, matterId, 'date_mentions', value.date_mention_ids);
  await requireMatterObjects(c.env, matterId, 'amount_mentions', value.amount_mention_ids);
  const id = crypto.randomUUID(); const warnings = assertionWarnings(value);
  await serviceRest(c.env, '/event_assertions', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id, organization_id: matter.organization_id, matter_id: matterId, logical_document_id: value.logical_document_id ?? null, asserting_entity_id: value.asserting_entity_id ?? null, event_type: value.event_type ?? 'unknown', proposition: value.proposition, assertion_mode: value.assertion_mode, actor_entity_ids: value.actor_entity_ids, object_entity_ids: value.object_entity_ids, location_entity_ids: value.location_entity_ids ?? [], date_mention_ids: value.date_mention_ids, amount_mention_ids: value.amount_mention_ids, warnings, creation_method: value.creation_method ?? 'manual', processing_version: value.processing_version ?? 'phase2-events-v1', review_status: value.creation_method === 'extracted' ? 'unreviewed' : 'accepted', created_by: user.id }) });
  await serviceRest(c.env, '/event_assertion_sources', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(value.source_span_ids.map((sourceSpanId: string, index: number) => ({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, event_assertion_id: id, source_span_id: sourceSpanId, source_role: index === 0 ? 'primary' : 'supporting' }))) });
  await audit(c.env, { organization_id: matter.organization_id, matter_id: matterId, actor_id: user.id, action: 'event_assertion.created', resource_type: 'event_assertion', resource_id: id, request_id: c.get('requestId'), metadata: { assertion_mode: value.assertion_mode, warnings: warnings.length } });
  return c.json({ data: { id, warnings } }, 201);
});

events.post('/matters/:matterId/event-assertions/duplicate-proposals', async (c) => {
  const matterId = c.req.param('matterId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'reviewer');
  const matter = await activeMatter(c.env, matterId);
  const rows = await serviceRest(c.env, `/event_assertions?matter_id=eq.${matterId}&status=eq.active&select=*`);
  const proposals = duplicateAssertionCandidates(rows.map((row: Record<string, unknown>) => ({ ...row, source_span_ids: ['persisted-source'] })));
  for (const proposal of proposals) {
    const [target, ...duplicates] = proposal.assertion_ids;
    for (const source of duplicates) await serviceRest(c.env, '/event_assertion_relations', { method: 'POST', prefer: 'return=minimal,resolution=ignore-duplicates', body: JSON.stringify({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, source_assertion_id: source, target_assertion_id: target, relationship_type: 'duplicate_of', decision_status: 'candidate', rationale: 'Deterministic assertion fingerprint match' }) });
  }
  return c.json({ data: proposals });
});

events.post('/matters/:matterId/event-assertions/:assertionId/review', async (c) => {
  const matterId = c.req.param('matterId'); const assertionId = c.req.param('assertionId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'reviewer');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<{ decision?: string; proposition?: string; assertion_mode?: string; rationale?: string }>(c.req.raw);
  if (!['accepted','corrected','rejected','unresolved'].includes(body.decision ?? '')) throw new ApiError(400, 'invalid review decision', 'invalid_request');
  const current = await serviceRest(c.env, `/event_assertions?id=eq.${assertionId}&matter_id=eq.${matterId}&select=*&limit=1`);
  if (!current?.length) throw new ApiError(404, 'Event assertion not found', 'not_found');
  const next = { proposition: body.proposition ?? current[0].proposition, assertion_mode: body.assertion_mode ?? current[0].assertion_mode, review_status: body.decision, updated_at: new Date().toISOString(), status: body.decision === 'rejected' ? 'stale' : current[0].status };
  await serviceRest(c.env, `/event_assertions?id=eq.${assertionId}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify(next) });
  await serviceRest(c.env, '/event_assertion_reviews', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, event_assertion_id: assertionId, reviewer_id: user.id, decision: body.decision, previous_value: current[0], new_value: next, rationale: body.rationale ?? null }) });
  return c.json({ data: { id: assertionId, ...next } });
});
