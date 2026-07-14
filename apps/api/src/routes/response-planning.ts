import { Hono } from 'hono';
import type { Env, Variables } from '../env';
import { responsePlanReadiness, responsePlanSummary, validatePlanDependencies, validatePlanNode } from '../../../../packages/core/src/response-planning.mjs';
import type { PlanDependency, PlanNodeInput } from '../../../../packages/core/src/response-planning.mjs';
import { audit } from '../lib/audit';
import { requireMatterRole } from '../lib/authorization';
import { ApiError, readJson } from '../lib/http';
import { serviceRest, userRest } from '../lib/supabase';

export const responsePlanning = new Hono<{ Bindings: Env; Variables: Variables }>();

type PlanNodeRow = Record<string, any> & { id: string; plan_snapshot_id: string; review_status: string; node_status: string };

const OBJECT_TABLES: Record<string, string> = {
  narrative_sentence: 'narrative_sentences',
  allegation: 'allegations',
  response: 'responses',
  evidence_item: 'evidence_items',
  evidence_relationship: 'proposition_evidence_links',
  contradiction_candidate: 'contradiction_candidates',
  missing_information: 'missing_information_items',
  matrix_row: 'matter_matrix_rows',
  candidate_event: 'candidate_events',
  date_mention: 'date_mentions',
  amount_mention: 'amount_mentions',
  document_reference: 'document_references',
  matter_memory_entry: 'matter_memory_entries',
};

async function activeMatter(env: Env, matterId: string) {
  const rows = await serviceRest(env, `/matters?id=eq.${matterId}&status=eq.active&select=id,organization_id&limit=1`) as Record<string, any>[];
  if (!rows?.length) throw new ApiError(409, 'Active matter required', 'invalid_matter_state');
  return rows[0];
}

async function loadPlan(env: Env, matterId: string, planId: string) {
  const plans = await serviceRest(env, `/response_plan_snapshots?id=eq.${planId}&matter_id=eq.${matterId}&status=neq.deleted&select=*&limit=1`) as Record<string, any>[];
  if (!plans?.length) throw new ApiError(404, 'Response plan snapshot not found', 'not_found');
  const plan = plans[0];
  const nodes = await serviceRest(env, `/response_plan_nodes?plan_snapshot_id=eq.${planId}&matter_id=eq.${matterId}&status=eq.active&select=*&order=position.asc`) as PlanNodeRow[];
  const nodeIds = nodes.map((node) => node.id);
  const supports = nodeIds.length
    ? await serviceRest(env, `/response_plan_node_supports?plan_node_id=in.(${nodeIds.join(',')})&matter_id=eq.${matterId}&select=*`) as Record<string, any>[]
    : [];
  const dependencies = await serviceRest(env, `/response_plan_dependencies?plan_snapshot_id=eq.${planId}&matter_id=eq.${matterId}&select=node_id,depends_on_node_id,dependency_type`) as Record<string, any>[];
  const counts = new Map<string, number>();
  for (const support of supports) counts.set(support.plan_node_id, (counts.get(support.plan_node_id) ?? 0) + 1);
  return { plan, nodes: nodes.map((node) => ({ ...node, support_count: counts.get(node.id) ?? 0 })), supports, dependencies };
}

async function verifySupportBindings(env: Env, matterId: string, bindings: Array<{ object_type: string; object_id: string; source_span_id: string }>) {
  const sourceIds = [...new Set(bindings.map((binding) => binding.source_span_id))];
  const sourceRows = await serviceRest(env, `/source_spans?id=in.(${sourceIds.join(',')})&matter_id=eq.${matterId}&status=neq.deleted&select=id`) as Record<string, any>[];
  if ((sourceRows ?? []).length !== sourceIds.length) throw new ApiError(400, 'Plan-node source spans must belong to the matter', 'invalid_sources');
  const grouped = new Map<string, string[]>();
  for (const binding of bindings) {
    const table = OBJECT_TABLES[binding.object_type];
    if (!table) throw new ApiError(400, `Unsupported plan support object type: ${binding.object_type}`, 'invalid_support_object');
    const ids = grouped.get(binding.object_type) ?? [];
    ids.push(binding.object_id);
    grouped.set(binding.object_type, ids);
  }
  for (const [type, rawIds] of grouped) {
    const ids = [...new Set(rawIds)];
    const rows = await serviceRest(env, `/${OBJECT_TABLES[type]}?id=in.(${ids.join(',')})&matter_id=eq.${matterId}&select=id`) as Record<string, any>[];
    if ((rows ?? []).length !== ids.length) throw new ApiError(400, `${type} support objects must belong to the matter`, 'invalid_support_object');
  }
}

responsePlanning.get('/matters/:matterId/response-plans', async (c) => {
  const matterId = c.req.param('matterId');
  await requireMatterRole(c.env, c.get('accessToken'), c.get('user').id, matterId, 'viewer');
  const rows = await userRest(c.env, c.get('accessToken'), `/response_plan_snapshots?matter_id=eq.${matterId}&status=neq.deleted&select=*,response_plan_nodes(*,response_plan_node_supports(*)),response_plan_dependencies(*)&order=version_number.desc`);
  return c.json({ data: rows });
});

responsePlanning.post('/matters/:matterId/response-plans', async (c) => {
  const matterId = c.req.param('matterId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'editor');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<{ matrix_snapshot_id?: string; overview_snapshot_id?: string; title?: string }>(c.req.raw);
  if (!body.matrix_snapshot_id || !body.overview_snapshot_id) throw new ApiError(400, 'matrix_snapshot_id and overview_snapshot_id are required', 'invalid_request');
  const matrices = await serviceRest(c.env, `/matter_matrix_snapshots?id=eq.${body.matrix_snapshot_id}&matter_id=eq.${matterId}&export_status=eq.attorney_approved&select=id,version_number&limit=1`) as Record<string, any>[];
  if (!matrices?.length) throw new ApiError(400, 'An attorney-approved matrix snapshot is required', 'invalid_matrix_snapshot');
  const overviews = await serviceRest(c.env, `/matter_overview_snapshots?id=eq.${body.overview_snapshot_id}&matter_id=eq.${matterId}&approval_status=in.(ready,attorney_approved)&status=eq.active&select=id,version_number,source_manifest_fingerprint&limit=1`) as Record<string, any>[];
  if (!overviews?.length) throw new ApiError(400, 'A reviewed active overview snapshot is required', 'invalid_overview_snapshot');
  const title = String(body.title ?? '').replace(/\s+/g, ' ').trim();
  if (!title) throw new ApiError(400, 'title is required', 'invalid_request');
  const latest = await serviceRest(c.env, `/response_plan_snapshots?matter_id=eq.${matterId}&select=version_number&order=version_number.desc&limit=1`) as Record<string, any>[];
  const versionNumber = Number(latest?.[0]?.version_number ?? 0) + 1;
  const id = crypto.randomUUID();
  const artifactLocks = { matrix_snapshot_id: body.matrix_snapshot_id, matrix_version: matrices[0].version_number, overview_snapshot_id: body.overview_snapshot_id, overview_version: overviews[0].version_number, overview_source_manifest_fingerprint: overviews[0].source_manifest_fingerprint };
  await serviceRest(c.env, '/response_plan_snapshots', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id, organization_id: matter.organization_id, matter_id: matterId, version_number: versionNumber, matrix_snapshot_id: body.matrix_snapshot_id, overview_snapshot_id: body.overview_snapshot_id, title, artifact_locks: artifactLocks, production_use_allowed: false, created_by: user.id }) });
  await audit(c.env, { organization_id: matter.organization_id, matter_id: matterId, actor_id: user.id, action: 'response_plan.created', resource_type: 'response_plan_snapshot', resource_id: id, request_id: c.get('requestId'), metadata: { version_number: versionNumber, production_use_allowed: false } });
  return c.json({ data: { id, version_number: versionNumber, status: 'draft', production_use_allowed: false } }, 201);
});

responsePlanning.post('/matters/:matterId/response-plans/:planId/nodes', async (c) => {
  const matterId = c.req.param('matterId'); const planId = c.req.param('planId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'editor');
  const matter = await activeMatter(c.env, matterId);
  const plans = await serviceRest(c.env, `/response_plan_snapshots?id=eq.${planId}&matter_id=eq.${matterId}&status=eq.draft&select=*&limit=1`) as Record<string, any>[];
  if (!plans?.length) throw new ApiError(404, 'Draft response plan not found', 'not_found');
  const body = await readJson<PlanNodeInput>(c.req.raw);
  let value;
  try { value = validatePlanNode(body); }
  catch (error) { throw new ApiError(400, error instanceof Error ? error.message : 'Invalid response plan node', 'invalid_plan_node'); }
  const matrixRows = await serviceRest(c.env, `/matter_matrix_rows?id=eq.${value.matrix_row_id}&matter_id=eq.${matterId}&snapshot_id=eq.${plans[0].matrix_snapshot_id}&allegation_id=eq.${value.allegation_id}&select=id&limit=1`) as Record<string, any>[];
  if (!matrixRows?.length) throw new ApiError(400, 'Plan node must reference an allegation row in the locked matrix snapshot', 'invalid_matrix_row');
  if (value.assigned_to) {
    const memberships = await serviceRest(c.env, `/matter_memberships?matter_id=eq.${matterId}&user_id=eq.${value.assigned_to}&status=eq.active&select=user_id&limit=1`) as Record<string, any>[];
    if (!memberships?.length) throw new ApiError(400, 'Assigned user must be an active matter member', 'invalid_assignee');
  }
  await verifySupportBindings(c.env, matterId, value.support_bindings);
  const nodeId = crypto.randomUUID(); const { support_bindings: supports, ...node } = value;
  await serviceRest(c.env, '/response_plan_nodes', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: nodeId, organization_id: matter.organization_id, matter_id: matterId, plan_snapshot_id: planId, ...node, created_by: user.id }) });
  await serviceRest(c.env, '/response_plan_node_supports', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(supports.map((support) => ({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, plan_node_id: nodeId, ...support }))) });
  const nodes = await serviceRest(c.env, `/response_plan_nodes?plan_snapshot_id=eq.${planId}&status=eq.active&select=node_status`) as Record<string, any>[];
  await serviceRest(c.env, `/response_plan_snapshots?id=eq.${planId}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ node_count: nodes.length, blocked_node_count: nodes.filter((item) => item.node_status === 'blocked').length, updated_at: new Date().toISOString() }) });
  return c.json({ data: { id: nodeId, ...node, support_count: supports.length } }, 201);
});

responsePlanning.post('/matters/:matterId/response-plans/:planId/dependencies', async (c) => {
  const matterId = c.req.param('matterId'); const planId = c.req.param('planId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'editor');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<{ node_id?: string; depends_on_node_id?: string; dependency_type?: string }>(c.req.raw);
  if (!body.node_id || !body.depends_on_node_id) throw new ApiError(400, 'node_id and depends_on_node_id are required', 'invalid_request');
  const nodes = await serviceRest(c.env, `/response_plan_nodes?plan_snapshot_id=eq.${planId}&matter_id=eq.${matterId}&status=eq.active&select=id`) as PlanNodeRow[];
  const existing = await serviceRest(c.env, `/response_plan_dependencies?plan_snapshot_id=eq.${planId}&matter_id=eq.${matterId}&select=node_id,depends_on_node_id`) as PlanDependency[];
  const candidate: PlanDependency = { node_id: body.node_id, depends_on_node_id: body.depends_on_node_id };
  try { validatePlanDependencies(nodes, [...existing, candidate]); }
  catch (error) { throw new ApiError(400, error instanceof Error ? error.message : 'Invalid plan dependency', 'invalid_plan_dependency'); }
  const id = crypto.randomUUID();
  await serviceRest(c.env, '/response_plan_dependencies', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id, organization_id: matter.organization_id, matter_id: matterId, plan_snapshot_id: planId, node_id: body.node_id, depends_on_node_id: body.depends_on_node_id, dependency_type: body.dependency_type ?? 'blocks' }) });
  return c.json({ data: { id, ...candidate, dependency_type: body.dependency_type ?? 'blocks' } }, 201);
});

responsePlanning.post('/matters/:matterId/response-plan-nodes/:nodeId/review', async (c) => {
  const matterId = c.req.param('matterId'); const nodeId = c.req.param('nodeId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'reviewer');
  const matter = await activeMatter(c.env, matterId);
  const rows = await serviceRest(c.env, `/response_plan_nodes?id=eq.${nodeId}&matter_id=eq.${matterId}&status=eq.active&select=*&limit=1`) as PlanNodeRow[];
  if (!rows?.length) throw new ApiError(404, 'Response plan node not found', 'not_found');
  const body = await readJson<{ decision?: string; node_status?: string; rationale?: string }>(c.req.raw);
  if (!['accepted','rejected','unresolved','status_changed'].includes(body.decision ?? '')) throw new ApiError(400, 'Invalid plan-node decision', 'invalid_request');
  const supportRows = await serviceRest(c.env, `/response_plan_node_supports?plan_node_id=eq.${nodeId}&matter_id=eq.${matterId}&select=id`) as Record<string, any>[];
  if (body.decision === 'accepted' && !supportRows.length) throw new ApiError(409, 'A plan node cannot be accepted without exact source support', 'plan_node_not_ready');
  const next: Record<string, any> = { review_status: body.decision === 'accepted' ? 'accepted' : body.decision === 'rejected' ? 'rejected' : body.decision === 'unresolved' ? 'unresolved' : rows[0].review_status, updated_at: new Date().toISOString() };
  if (body.decision === 'status_changed') {
    if (!['open','in_progress','blocked','resolved','dismissed'].includes(body.node_status ?? '')) throw new ApiError(400, 'Invalid node_status', 'invalid_request');
    next.node_status = body.node_status;
  }
  await serviceRest(c.env, `/response_plan_nodes?id=eq.${nodeId}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify(next) });
  await serviceRest(c.env, '/response_plan_reviews', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, plan_snapshot_id: rows[0].plan_snapshot_id, plan_node_id: nodeId, reviewer_id: user.id, decision: body.decision, previous_value: rows[0], new_value: next, rationale: body.rationale ?? null }) });
  await audit(c.env, { organization_id: matter.organization_id, matter_id: matterId, actor_id: user.id, action: 'response_plan_node.reviewed', resource_type: 'response_plan_node', resource_id: nodeId, request_id: c.get('requestId'), metadata: { decision: body.decision, node_status: next.node_status ?? rows[0].node_status } });
  return c.json({ data: { id: nodeId, ...next } });
});

responsePlanning.get('/matters/:matterId/response-plans/:planId/readiness', async (c) => {
  const matterId = c.req.param('matterId'); const planId = c.req.param('planId');
  await requireMatterRole(c.env, c.get('accessToken'), c.get('user').id, matterId, 'viewer');
  const context = await loadPlan(c.env, matterId, planId);
  const readiness = responsePlanReadiness(context.nodes, context.dependencies, { matrix_snapshot_attorney_approved: true, overview_ready: true });
  return c.json({ data: { readiness, summary: responsePlanSummary(context.nodes) } });
});
