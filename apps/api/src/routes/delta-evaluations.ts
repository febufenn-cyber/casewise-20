import { Hono } from 'hono';
import type { Env, Variables } from '../env';
import { computeDeltaEvaluation, evaluateDeltaGate, validateDeltaEvaluationInput } from '../../../../packages/core/src/delta-evaluation.mjs';
import { audit } from '../lib/audit';
import { requireMatterRole } from '../lib/authorization';
import { ApiError, readJson } from '../lib/http';
import { serviceRest, userRest } from '../lib/supabase';

export const deltaEvaluations = new Hono<{ Bindings: Env; Variables: Variables }>();

type DeltaEvaluationObservation = {
  delta_item_id: string | null;
  expected_change_type: string | null;
  predicted_change_type: string | null;
  outcome: string;
  materiality: string;
  source_pair_verified: boolean;
  notes: string | null;
};

type ValidatedDeltaEvaluation = {
  pack_label: string;
  baseline_minutes: number;
  casewise_minutes: number;
  observations: DeltaEvaluationObservation[];
  notes: string | null;
};

async function activeMatter(env: Env, matterId: string) {
  const rows = await serviceRest(env, `/matters?id=eq.${matterId}&status=eq.active&select=id,organization_id&limit=1`) as Record<string, any>[];
  if (!rows?.length) throw new ApiError(409, 'Active matter required', 'invalid_matter_state');
  return rows[0];
}

deltaEvaluations.get('/matters/:matterId/delta-evaluations', async (c) => {
  const matterId = c.req.param('matterId');
  await requireMatterRole(c.env, c.get('accessToken'), c.get('user').id, matterId, 'viewer');
  const rows = await userRest(c.env, c.get('accessToken'), `/delta_evaluation_runs?matter_id=eq.${matterId}&select=*,delta_evaluation_items(*)&order=created_at.desc`);
  return c.json({ data: rows });
});

deltaEvaluations.post('/matters/:matterId/delta-evaluations', async (c) => {
  const matterId = c.req.param('matterId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'reviewer');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<Record<string, any>>(c.req.raw);
  if (!body.delta_snapshot_id) throw new ApiError(400, 'delta_snapshot_id is required', 'invalid_request');
  let value: ValidatedDeltaEvaluation;
  try { value = validateDeltaEvaluationInput(body) as ValidatedDeltaEvaluation; }
  catch (error) { throw new ApiError(400, error instanceof Error ? error.message : 'Invalid delta evaluation', 'invalid_delta_evaluation'); }
  const snapshots = await serviceRest(c.env, `/delta_snapshots?id=eq.${body.delta_snapshot_id}&matter_id=eq.${matterId}&approval_status=eq.attorney_approved&select=id&limit=1`) as Record<string, any>[];
  if (!snapshots?.length) throw new ApiError(400, 'Evaluation requires an attorney-approved delta snapshot', 'invalid_delta_snapshot');
  const deltaItemIds = [...new Set(value.observations.map((item: DeltaEvaluationObservation) => item.delta_item_id).filter((itemId): itemId is string => Boolean(itemId)))];
  if (deltaItemIds.length) {
    const deltaItems = await serviceRest(c.env, `/delta_items?id=in.(${deltaItemIds.join(',')})&matter_id=eq.${matterId}&delta_snapshot_id=eq.${body.delta_snapshot_id}&select=id`) as Record<string, any>[];
    if ((deltaItems ?? []).length !== deltaItemIds.length) throw new ApiError(400, 'Evaluation items must belong to the approved delta snapshot', 'invalid_evaluation_items');
  }
  const metrics = computeDeltaEvaluation(value.observations, value);
  const gate = evaluateDeltaGate(metrics, body.thresholds ?? {});
  const runId = crypto.randomUUID();
  await serviceRest(c.env, '/delta_evaluation_runs', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: runId, organization_id: matter.organization_id, matter_id: matterId, delta_snapshot_id: body.delta_snapshot_id, pack_label: value.pack_label, baseline_minutes: value.baseline_minutes, casewise_minutes: value.casewise_minutes, metrics, thresholds: gate.thresholds, gate_status: gate.gate_status, gate_reasons: gate.reasons, notes: value.notes, evaluator_id: user.id }) });
  await serviceRest(c.env, '/delta_evaluation_items', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(value.observations.map((item: DeltaEvaluationObservation) => ({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, evaluation_run_id: runId, ...item }))) });
  await audit(c.env, { organization_id: matter.organization_id, matter_id: matterId, actor_id: user.id, action: 'delta_evaluation.created', resource_type: 'delta_evaluation_run', resource_id: runId, request_id: c.get('requestId'), metadata: { delta_snapshot_id: body.delta_snapshot_id, pack_label: value.pack_label, gate_status: gate.gate_status, ...metrics } });
  return c.json({ data: { id: runId, metrics, ...gate } }, 201);
});
