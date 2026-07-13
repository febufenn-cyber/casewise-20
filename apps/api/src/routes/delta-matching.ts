import { Hono } from 'hono';
import type { Env, Variables } from '../env';
import { matchFilingVersionMembers, matchRunReadiness, validateVersionPair } from '../../../../packages/core/src/delta-matching.mjs';
import { audit } from '../lib/audit';
import { requireMatterRole } from '../lib/authorization';
import { ApiError, readJson } from '../lib/http';
import { serviceRest, userRest } from '../lib/supabase';

export const deltaMatching = new Hono<{ Bindings: Env; Variables: Variables }>();

async function activeMatter(env: Env, matterId: string) {
  const rows = await serviceRest(env, `/matters?id=eq.${matterId}&status=eq.active&select=id,organization_id&limit=1`) as Record<string, any>[];
  if (!rows?.length) throw new ApiError(409, 'Active matter required', 'invalid_matter_state');
  return rows[0];
}

async function requireMember(env: Env, matterId: string, versionId: string, objectType: string, memberId: string | null | undefined) {
  if (!memberId) return null;
  const rows = await serviceRest(env, `/filing_version_members?id=eq.${memberId}&matter_id=eq.${matterId}&filing_version_id=eq.${versionId}&object_type=eq.${objectType}&select=id&limit=1`) as Record<string, any>[];
  if (!rows?.length) throw new ApiError(400, 'Corrected match member is outside the required filing version', 'invalid_match_member');
  return rows[0];
}

deltaMatching.get('/matters/:matterId/delta-match-runs', async (c) => {
  const matterId = c.req.param('matterId');
  await requireMatterRole(c.env, c.get('accessToken'), c.get('user').id, matterId, 'viewer');
  const rows = await userRest(c.env, c.get('accessToken'), `/delta_match_runs?matter_id=eq.${matterId}&status=neq.deleted&select=*,delta_match_candidates(*)&order=created_at.desc`);
  return c.json({ data: rows });
});

deltaMatching.post('/matters/:matterId/delta-match-runs/rebuild', async (c) => {
  const matterId = c.req.param('matterId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'reviewer');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<{ prior_version_id?: string; current_version_id?: string; processing_version?: string; probable_threshold?: number; ambiguous_threshold?: number; ambiguity_margin?: number }>(c.req.raw);
  if (!body.prior_version_id || !body.current_version_id) throw new ApiError(400, 'Both filing version ids are required', 'invalid_request');
  const versions = await serviceRest(c.env, `/filing_versions?id=in.(${body.prior_version_id},${body.current_version_id})&matter_id=eq.${matterId}&status=in.(active,superseded)&review_status=in.(accepted,corrected)&select=*`) as Record<string, any>[];
  if ((versions ?? []).length !== 2) throw new ApiError(400, 'Both filing versions must be reviewed and activated', 'invalid_filing_versions');
  const priorVersion = versions.find((item) => item.id === body.prior_version_id);
  const currentVersion = versions.find((item) => item.id === body.current_version_id);
  try { validateVersionPair(priorVersion, currentVersion); }
  catch (error) { throw new ApiError(400, error instanceof Error ? error.message : 'Invalid filing version pair', 'invalid_filing_versions'); }

  const [priorMembers, currentMembers] = await Promise.all([
    serviceRest(c.env, `/filing_version_members?filing_version_id=eq.${body.prior_version_id}&matter_id=eq.${matterId}&select=*`) as Promise<Record<string, any>[]>,
    serviceRest(c.env, `/filing_version_members?filing_version_id=eq.${body.current_version_id}&matter_id=eq.${matterId}&select=*`) as Promise<Record<string, any>[]>,
  ]);
  const thresholds = { probable_threshold: body.probable_threshold ?? 0.72, ambiguous_threshold: body.ambiguous_threshold ?? 0.45, ambiguity_margin: body.ambiguity_margin ?? 0.06 };
  const matches = matchFilingVersionMembers(priorMembers ?? [], currentMembers ?? [], thresholds);
  const readiness = matchRunReadiness(matches);
  const runId = crypto.randomUUID();
  await serviceRest(c.env, `/delta_match_runs?matter_id=eq.${matterId}&prior_version_id=eq.${body.prior_version_id}&current_version_id=eq.${body.current_version_id}&status=eq.active`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ status: 'superseded' }) });
  await serviceRest(c.env, '/delta_match_runs', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: runId, organization_id: matter.organization_id, matter_id: matterId, prior_version_id: body.prior_version_id, current_version_id: body.current_version_id, processing_version: body.processing_version ?? 'phase4-matching-v1', thresholds, match_count: matches.length, ambiguous_count: readiness.ambiguous_count, created_by: user.id }) });
  if (matches.length) {
    await serviceRest(c.env, '/delta_match_candidates', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(matches.map((match) => ({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, match_run_id: runId, ...match, review_status: match.match_status === 'exact' ? 'accepted' : 'unreviewed' }))) });
  }
  const ambiguousMatches = matches.filter((match) => match.match_status === 'ambiguous');
  if (ambiguousMatches.length) {
    await serviceRest(c.env, '/review_tasks', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(ambiguousMatches.map((match) => ({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, task_type: 'delta_match_review', object_type: 'filing_version', object_id: body.current_version_id, priority: 70, reason: `${match.object_type}:ambiguous_cross_version_match` }))) });
  }
  await audit(c.env, { organization_id: matter.organization_id, matter_id: matterId, actor_id: user.id, action: 'delta_match_run.rebuilt', resource_type: 'delta_match_run', resource_id: runId, request_id: c.get('requestId'), metadata: { prior_version_id: body.prior_version_id, current_version_id: body.current_version_id, ...readiness } });
  return c.json({ data: { run_id: runId, ...readiness } }, 201);
});

deltaMatching.get('/matters/:matterId/delta-match-runs/:runId/readiness', async (c) => {
  const matterId = c.req.param('matterId'); const runId = c.req.param('runId');
  await requireMatterRole(c.env, c.get('accessToken'), c.get('user').id, matterId, 'viewer');
  const rows = await userRest(c.env, c.get('accessToken'), `/delta_match_candidates?match_run_id=eq.${runId}&matter_id=eq.${matterId}&selected=eq.true&select=*`) as Record<string, any>[];
  return c.json({ data: matchRunReadiness(rows ?? []) });
});

deltaMatching.post('/matters/:matterId/delta-match-candidates/:candidateId/review', async (c) => {
  const matterId = c.req.param('matterId'); const candidateId = c.req.param('candidateId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'reviewer');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<{ decision?: string; prior_member_id?: string | null; current_member_id?: string | null; match_status?: string; rationale?: string }>(c.req.raw);
  if (!['accepted','corrected','rejected','unresolved'].includes(body.decision ?? '')) throw new ApiError(400, 'Invalid match review decision', 'invalid_request');
  if (body.match_status && !['exact','probable','ambiguous','new','removed'].includes(body.match_status)) throw new ApiError(400, 'Invalid match status', 'invalid_request');
  const candidates = await serviceRest(c.env, `/delta_match_candidates?id=eq.${candidateId}&matter_id=eq.${matterId}&select=*&limit=1`) as Record<string, any>[];
  if (!candidates?.length) throw new ApiError(404, 'Match candidate not found', 'not_found');
  const current = candidates[0];
  const runs = await serviceRest(c.env, `/delta_match_runs?id=eq.${current.match_run_id}&matter_id=eq.${matterId}&select=prior_version_id,current_version_id&limit=1`) as Record<string, any>[];
  if (!runs?.length) throw new ApiError(404, 'Match run not found', 'not_found');
  const run = runs[0];
  const priorMemberId = body.prior_member_id === undefined ? current.prior_member_id : body.prior_member_id;
  const currentMemberId = body.current_member_id === undefined ? current.current_member_id : body.current_member_id;
  await requireMember(c.env, matterId, run.prior_version_id, current.object_type, priorMemberId);
  await requireMember(c.env, matterId, run.current_version_id, current.object_type, currentMemberId);
  const next = {
    prior_member_id: priorMemberId,
    current_member_id: currentMemberId,
    match_status: body.match_status ?? current.match_status,
    selected: body.decision !== 'rejected',
    review_status: body.decision,
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
  };
  await serviceRest(c.env, `/delta_match_candidates?id=eq.${candidateId}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify(next) });
  await serviceRest(c.env, '/delta_match_reviews', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, match_candidate_id: candidateId, reviewer_id: user.id, decision: body.decision, previous_value: current, new_value: next, rationale: body.rationale ?? null }) });
  return c.json({ data: { id: candidateId, ...next } });
});
