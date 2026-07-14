import { Hono } from 'hono';
import type { Env, Variables } from '../env';
import { computePhase5Evaluation, evaluatePhase5Gate, validatePhase5EvaluationInput } from '../../../../packages/core/src/phase5-evaluation.mjs';
import type { Phase5EvaluationInput, ValidatedPhase5Observation } from '../../../../packages/core/src/phase5-evaluation.mjs';
import { audit } from '../lib/audit';
import { requireMatterRole } from '../lib/authorization';
import { ApiError, readJson } from '../lib/http';
import { serviceRest, userRest } from '../lib/supabase';

export const phase5Evaluations = new Hono<{ Bindings: Env; Variables: Variables }>();

async function activeMatter(env: Env, matterId: string) {
  const rows = await serviceRest(env, `/matters?id=eq.${matterId}&status=eq.active&select=id,organization_id&limit=1`) as Record<string, any>[];
  if (!rows?.length) throw new ApiError(409, 'Active matter required', 'invalid_matter_state');
  return rows[0];
}

async function requireApprovedArtifacts(env: Env, matterId: string, overviewId: string, planId: string, exportPackageId?: string | null) {
  const overviews = await serviceRest(env, `/matter_overview_snapshots?id=eq.${overviewId}&matter_id=eq.${matterId}&status=eq.active&approval_status=eq.attorney_approved&select=id,version_number&limit=1`) as Record<string, any>[];
  if (!overviews?.length) throw new ApiError(400, 'Evaluation requires an active attorney-approved overview snapshot', 'invalid_overview_snapshot');
  const plans = await serviceRest(env, `/response_plan_snapshots?id=eq.${planId}&matter_id=eq.${matterId}&overview_snapshot_id=eq.${overviewId}&status=eq.active&approval_status=eq.attorney_approved&select=id,version_number&limit=1`) as Record<string, any>[];
  if (!plans?.length) throw new ApiError(400, 'Evaluation requires an active attorney-approved response plan locked to the overview', 'invalid_response_plan');
  if (exportPackageId) {
    const exports = await serviceRest(env, `/phase5_internal_export_packages?id=eq.${exportPackageId}&matter_id=eq.${matterId}&overview_snapshot_id=eq.${overviewId}&response_plan_snapshot_id=eq.${planId}&export_status=eq.active&select=id&limit=1`) as Record<string, any>[];
    if (!exports?.length) throw new ApiError(400, 'Export package must be active and match the approved artifacts', 'invalid_export_package');
  }
  return { overview: overviews[0], plan: plans[0] };
}

async function validateObservationArtifacts(env: Env, matterId: string, overviewId: string, planId: string, observations: ValidatedPhase5Observation[]) {
  const overviewIds = [...new Set(observations.filter((item) => item.artifact_type === 'overview_sentence').map((item) => item.artifact_id).filter((id): id is string => Boolean(id)))];
  const planIds = [...new Set(observations.filter((item) => item.artifact_type === 'response_plan_node').map((item) => item.artifact_id).filter((id): id is string => Boolean(id)))];

  if (overviewIds.length) {
    const links = await serviceRest(env, `/matter_overview_section_sentences?overview_snapshot_id=eq.${overviewId}&matter_id=eq.${matterId}&sentence_id=in.(${overviewIds.join(',')})&select=sentence_id`) as Record<string, any>[];
    if (new Set((links ?? []).map((row) => row.sentence_id)).size !== overviewIds.length) throw new ApiError(400, 'Overview evaluation observations must belong to the approved overview snapshot', 'invalid_evaluation_items');
  }
  if (planIds.length) {
    const nodes = await serviceRest(env, `/response_plan_nodes?plan_snapshot_id=eq.${planId}&matter_id=eq.${matterId}&id=in.(${planIds.join(',')})&select=id`) as Record<string, any>[];
    if (new Set((nodes ?? []).map((row) => row.id)).size !== planIds.length) throw new ApiError(400, 'Plan evaluation observations must belong to the approved response plan snapshot', 'invalid_evaluation_items');
  }
}

phase5Evaluations.get('/matters/:matterId/phase5/evaluations', async (c) => {
  const matterId = c.req.param('matterId');
  await requireMatterRole(c.env, c.get('accessToken'), c.get('user').id, matterId, 'viewer');
  const rows = await userRest(c.env, c.get('accessToken'), `/phase5_evaluation_runs?matter_id=eq.${matterId}&select=*,phase5_evaluation_items(*)&order=created_at.desc`);
  return c.json({ data: rows });
});

phase5Evaluations.post('/matters/:matterId/phase5/evaluations', async (c) => {
  const matterId = c.req.param('matterId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'reviewer');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<Phase5EvaluationInput & { overview_snapshot_id?: string; response_plan_snapshot_id?: string; export_package_id?: string | null; thresholds?: Record<string, number> }>(c.req.raw);
  if (!body.overview_snapshot_id || !body.response_plan_snapshot_id) throw new ApiError(400, 'overview_snapshot_id and response_plan_snapshot_id are required', 'invalid_request');
  await requireApprovedArtifacts(c.env, matterId, body.overview_snapshot_id, body.response_plan_snapshot_id, body.export_package_id);
  let value;
  try { value = validatePhase5EvaluationInput(body); }
  catch (error) { throw new ApiError(400, error instanceof Error ? error.message : 'Invalid Phase 5 evaluation', 'invalid_phase5_evaluation'); }
  await validateObservationArtifacts(c.env, matterId, body.overview_snapshot_id, body.response_plan_snapshot_id, value.observations);
  const metrics = computePhase5Evaluation(value.observations, value);
  const gate = evaluatePhase5Gate(metrics, body.thresholds ?? {});
  const runId = crypto.randomUUID();
  await serviceRest(c.env, '/phase5_evaluation_runs', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: runId, organization_id: matter.organization_id, matter_id: matterId, overview_snapshot_id: body.overview_snapshot_id, response_plan_snapshot_id: body.response_plan_snapshot_id, export_package_id: body.export_package_id ?? null, pack_label: value.pack_label, baseline_minutes: value.baseline_minutes, casewise_minutes: value.casewise_minutes, metrics, thresholds: gate.thresholds, gate_status: gate.gate_status, gate_reasons: gate.reasons, notes: value.notes, evaluator_id: user.id }) });
  await serviceRest(c.env, '/phase5_evaluation_items', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(value.observations.map((item) => ({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, evaluation_run_id: runId, ...item }))) });
  await audit(c.env, { organization_id: matter.organization_id, matter_id: matterId, actor_id: user.id, action: 'phase5_evaluation.created', resource_type: 'phase5_evaluation_run', resource_id: runId, request_id: c.get('requestId'), metadata: { overview_snapshot_id: body.overview_snapshot_id, response_plan_snapshot_id: body.response_plan_snapshot_id, pack_label: value.pack_label, gate_status: gate.gate_status, production_use_allowed: false, ...metrics } });
  return c.json({ data: { id: runId, metrics, ...gate, production_use_allowed: false } }, 201);
});
