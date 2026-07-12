import { Hono } from 'hono';
import type { Env, Variables } from '../env';
import { matchCandidate, mergeSnapshot, normalizeObservedName, proposeEntityMatches } from '../../../../packages/core/src/entity-resolution.mjs';
import { audit } from '../lib/audit';
import { requireMatterRole } from '../lib/authorization';
import { ApiError, readJson } from '../lib/http';
import { serviceRest, userRest } from '../lib/supabase';

export const entities = new Hono<{ Bindings: Env; Variables: Variables }>();

async function matterRecord(env: Env, matterId: string) {
  const rows = await serviceRest(env, `/matters?id=eq.${matterId}&select=id,organization_id,status&limit=1`);
  if (!rows?.length || rows[0].status !== 'active') throw new ApiError(409, 'Active matter required', 'invalid_matter_state');
  return rows[0];
}

entities.get('/matters/:matterId/entities', async (c) => {
  const matterId = c.req.param('matterId');
  await requireMatterRole(c.env, c.get('accessToken'), c.get('user').id, matterId, 'viewer');
  const rows = await userRest(c.env, c.get('accessToken'), `/entities?matter_id=eq.${matterId}&status=eq.active&select=*,entity_aliases(*),entity_roles(*)&order=display_name.asc`);
  return c.json({ data: rows });
});

entities.post('/matters/:matterId/entities', async (c) => {
  const matterId = c.req.param('matterId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'editor');
  const matter = await matterRecord(c.env, matterId);
  const body = await readJson<{ display_name?: string; entity_type?: string; identifiers?: Record<string, string>; creation_method?: string }>(c.req.raw);
  if (!body.display_name?.trim()) throw new ApiError(400, 'display_name is required', 'invalid_request');
  const id = crypto.randomUUID();
  await serviceRest(c.env, '/entities', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id, organization_id: matter.organization_id, matter_id: matterId, display_name: body.display_name.trim(), normalized_name: normalizeObservedName(body.display_name), entity_type: body.entity_type ?? 'unknown', identifiers: body.identifiers ?? {}, creation_method: body.creation_method ?? 'manual', review_status: body.creation_method === 'manual' || !body.creation_method ? 'confirmed' : 'unreviewed', created_by: user.id }) });
  await audit(c.env, { organization_id: matter.organization_id, matter_id: matterId, actor_id: user.id, action: 'entity.created', resource_type: 'entity', resource_id: id, request_id: c.get('requestId') });
  return c.json({ data: { id } }, 201);
});

entities.post('/matters/:matterId/entity-mentions', async (c) => {
  const matterId = c.req.param('matterId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'editor');
  const matter = await matterRecord(c.env, matterId);
  const body = await readJson<{ source_span_id?: string; logical_document_id?: string; raw_text?: string; mention_type?: string; role_text?: string; identifiers?: Record<string, string>; entity_id?: string; extraction_method?: string; processing_version?: string }>(c.req.raw);
  if (!body.source_span_id || !body.raw_text?.trim() || !body.mention_type) throw new ApiError(400, 'source_span_id, raw_text and mention_type are required', 'invalid_request');
  const spans = await serviceRest(c.env, `/source_spans?id=eq.${body.source_span_id}&matter_id=eq.${matterId}&select=id,logical_document_id&limit=1`);
  if (!spans?.length) throw new ApiError(400, 'source span does not belong to the matter', 'invalid_source');
  const id = crypto.randomUUID();
  await serviceRest(c.env, '/entity_mentions', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id, organization_id: matter.organization_id, matter_id: matterId, entity_id: body.entity_id ?? null, logical_document_id: body.logical_document_id ?? spans[0].logical_document_id, source_span_id: body.source_span_id, raw_text: body.raw_text.trim(), normalized_text: normalizeObservedName(body.raw_text), mention_type: body.mention_type, role_text: body.role_text ?? null, identifiers: body.identifiers ?? {}, extraction_method: body.extraction_method ?? 'manual', processing_version: body.processing_version ?? 'phase2-entity-v1', review_status: body.extraction_method === 'manual' || !body.extraction_method ? 'confirmed' : 'unreviewed' }) });
  return c.json({ data: { id } }, 201);
});

entities.post('/matters/:matterId/entity-resolution/proposals', async (c) => {
  const matterId = c.req.param('matterId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'reviewer');
  const matter = await matterRecord(c.env, matterId);
  const rows = await serviceRest(c.env, `/entities?matter_id=eq.${matterId}&status=eq.active&select=id,display_name,entity_type,identifiers`);
  const proposals = proposeEntityMatches(rows.map((row: Record<string, unknown>) => ({ id: row.id, display_name: row.display_name, entity_type: row.entity_type, identifiers: row.identifiers })));
  if (proposals.length) await serviceRest(c.env, '/entity_resolution_edges', { method: 'POST', prefer: 'return=minimal,resolution=merge-duplicates', body: JSON.stringify(proposals.map((proposal) => ({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, left_entity_id: proposal.left_id, right_entity_id: proposal.right_id, score: proposal.score, reasons: proposal.reasons, proposal_status: proposal.decision, processing_version: 'phase2-entity-v1' }))) });
  return c.json({ data: proposals });
});

entities.post('/matters/:matterId/entities/:targetId/merge', async (c) => {
  const matterId = c.req.param('matterId'); const targetId = c.req.param('targetId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'reviewer');
  const matter = await matterRecord(c.env, matterId);
  const body = await readJson<{ source_entity_ids?: string[]; rationale?: string }>(c.req.raw);
  const sourceIds = [...new Set(body.source_entity_ids ?? [])].filter((id) => id !== targetId);
  if (!sourceIds.length) throw new ApiError(400, 'source_entity_ids are required', 'invalid_request');
  const targetRows = await serviceRest(c.env, `/entities?id=eq.${targetId}&matter_id=eq.${matterId}&status=eq.active&select=*`);
  const sources = await serviceRest(c.env, `/entities?id=in.(${sourceIds.join(',')})&matter_id=eq.${matterId}&status=eq.active&select=*`);
  if (targetRows?.length !== 1 || sources?.length !== sourceIds.length) throw new ApiError(400, 'all entities must be active in the matter', 'invalid_entities');
  for (const source of sources) {
    const candidate = matchCandidate({ display_name: targetRows[0].display_name, entity_type: targetRows[0].entity_type, identifiers: targetRows[0].identifiers }, { display_name: source.display_name, entity_type: source.entity_type, identifiers: source.identifiers });
    if (candidate.decision === 'blocked') throw new ApiError(409, 'merge blocked by conflicting identity evidence', 'merge_blocked', candidate.reasons);
  }
  const mentions = await serviceRest(c.env, `/entity_mentions?entity_id=in.(${sourceIds.join(',')})&select=id,entity_id`);
  const snapshot = mergeSnapshot(targetId, sources, mentions ?? []); const decisionId = crypto.randomUUID();
  await serviceRest(c.env, `/entity_mentions?entity_id=in.(${sourceIds.join(',')})`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ entity_id: targetId, review_status: 'corrected' }) });
  await serviceRest(c.env, `/entities?id=in.(${sourceIds.join(',')})`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ status: 'superseded', superseded_by: targetId, updated_at: new Date().toISOString() }) });
  await serviceRest(c.env, '/entity_aliases', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(sources.map((source: Record<string, unknown>) => ({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, entity_id: targetId, observed_name: source.display_name, normalized_name: source.normalized_name, relationship: 'reviewer_alias', decision_status: 'confirmed', created_by: user.id }))) });
  await serviceRest(c.env, '/entity_resolution_decisions', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: decisionId, organization_id: matter.organization_id, matter_id: matterId, target_entity_id: targetId, source_entity_ids: sourceIds, decision: 'merged', rationale: body.rationale ?? null, reversible_snapshot: snapshot, reviewer_id: user.id }) });
  await serviceRest(c.env, `/artifact_dependencies?matter_id=eq.${matterId}&source_type=eq.entity&source_id=in.(${sourceIds.join(',')})&status=eq.active`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ status: 'stale' }) });
  await audit(c.env, { organization_id: matter.organization_id, matter_id: matterId, actor_id: user.id, action: 'entity.merged', resource_type: 'entity_resolution_decision', resource_id: decisionId, request_id: c.get('requestId'), metadata: { source_count: sourceIds.length } });
  return c.json({ data: { decision_id: decisionId, target_entity_id: targetId, source_entity_ids: sourceIds } });
});

entities.post('/matters/:matterId/entity-resolution/:decisionId/undo', async (c) => {
  const matterId = c.req.param('matterId'); const decisionId = c.req.param('decisionId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'reviewer');
  const matter = await matterRecord(c.env, matterId);
  const decisions = await serviceRest(c.env, `/entity_resolution_decisions?id=eq.${decisionId}&matter_id=eq.${matterId}&decision=eq.merged&select=*`);
  if (!decisions?.length) throw new ApiError(404, 'Merge decision not found', 'not_found');
  const snapshot = decisions[0].reversible_snapshot;
  for (const assignment of snapshot.mention_assignments ?? []) await serviceRest(c.env, `/entity_mentions?id=eq.${assignment.mention_id}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ entity_id: assignment.previous_entity_id, review_status: 'corrected' }) });
  for (const source of snapshot.source_entities ?? []) await serviceRest(c.env, `/entities?id=eq.${source.id}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ status: source.status ?? 'active', superseded_by: null, updated_at: new Date().toISOString() }) });
  const undoId = crypto.randomUUID();
  await serviceRest(c.env, '/entity_resolution_decisions', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: undoId, organization_id: matter.organization_id, matter_id: matterId, target_entity_id: decisions[0].target_entity_id, source_entity_ids: decisions[0].source_entity_ids, decision: 'undone', rationale: 'Undo merge', reversible_snapshot: snapshot, reviewer_id: user.id, reversed_decision_id: decisionId }) });
  return c.json({ data: { decision_id: undoId, reversed_decision_id: decisionId } });
});
