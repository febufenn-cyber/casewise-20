import { Hono } from 'hono';
import type { Env, Variables } from '../env';
import { chronologyLanes, clusterEventAssertions, createChronologyReviewTasks } from '../../../../packages/core/src/chronology.mjs';
import { audit } from '../lib/audit';
import { requireMatterRole } from '../lib/authorization';
import { ApiError, readJson } from '../lib/http';
import { serviceRest, userRest } from '../lib/supabase';

export const chronology = new Hono<{ Bindings: Env; Variables: Variables }>();

async function activeMatter(env: Env, matterId: string) {
  const rows = await serviceRest(env, `/matters?id=eq.${matterId}&status=eq.active&select=id,organization_id&limit=1`);
  if (!rows?.length) throw new ApiError(409, 'Active matter required', 'invalid_matter_state');
  return rows[0];
}

chronology.get('/matters/:matterId/chronology', async (c) => {
  const matterId = c.req.param('matterId');
  await requireMatterRole(c.env, c.get('accessToken'), c.get('user').id, matterId, 'viewer');
  const [events, entities] = await Promise.all([
    userRest(c.env, c.get('accessToken'), `/candidate_events?matter_id=eq.${matterId}&status=eq.active&select=*,candidate_event_members(event_assertions(*,event_assertion_sources(*)))&order=date_start.asc.nullslast,created_at.asc`),
    userRest(c.env, c.get('accessToken'), `/entities?matter_id=eq.${matterId}&status=eq.active&select=id,display_name`),
  ]);
  const normalized = (events ?? []).map((event: Record<string, any>) => ({ ...event, assertions: (event.candidate_event_members ?? []).map((member: Record<string, any>) => member.event_assertions) }));
  return c.json({ data: chronologyLanes(normalized, entities ?? []) });
});

chronology.post('/matters/:matterId/chronology/rebuild', async (c) => {
  const matterId = c.req.param('matterId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'reviewer');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<{ threshold?: number; processing_version?: string }>(c.req.raw);
  const assertions = await serviceRest(c.env, `/event_assertions?matter_id=eq.${matterId}&status=eq.active&review_status=neq.rejected&select=*`);
  const dateIds = [...new Set((assertions ?? []).flatMap((item: Record<string, any>) => item.date_mention_ids ?? []))];
  const dates = dateIds.length ? await serviceRest(c.env, `/date_mentions?id=in.(${dateIds.join(',')})&matter_id=eq.${matterId}&select=id,normalized_start,normalized_end,precision`) : [];
  const dateMap = new Map((dates ?? []).map((item: Record<string, any>) => [item.id, item]));
  const hydrated = (assertions ?? []).map((item: Record<string, any>) => {
    const date = (item.date_mention_ids ?? []).map((id: string) => dateMap.get(id)).find(Boolean) as Record<string, any> | undefined;
    return { ...item, date_start: date?.normalized_start ?? null, date_end: date?.normalized_end ?? null, date_precision: date?.precision ?? 'unknown' };
  });
  const clusters = clusterEventAssertions(hydrated, { threshold: body.threshold });
  const versions = await serviceRest(c.env, `/chronology_snapshots?matter_id=eq.${matterId}&select=version_number&order=version_number.desc&limit=1`);
  const versionNumber = Number(versions?.[0]?.version_number ?? 0) + 1; const snapshotId = crypto.randomUUID(); const processingVersion = body.processing_version ?? 'phase2-chronology-v1';
  await serviceRest(c.env, `/chronology_snapshots?matter_id=eq.${matterId}&status=eq.active`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ status: 'superseded' }) });
  await serviceRest(c.env, `/candidate_events?matter_id=eq.${matterId}&status=eq.active`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ status: 'stale', updated_at: new Date().toISOString() }) });
  await serviceRest(c.env, `/review_tasks?matter_id=eq.${matterId}&status=in.(open,in_progress)`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ status: 'stale' }) });
  await serviceRest(c.env, '/chronology_snapshots', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: snapshotId, organization_id: matter.organization_id, matter_id: matterId, version_number: versionNumber, processing_version: processingVersion, event_count: clusters.length, status: 'active', created_by: user.id, activated_at: new Date().toISOString() }) });
  const eventIds = new Map<string, string>();
  for (const cluster of clusters) {
    const eventId = crypto.randomUUID(); eventIds.set(cluster.temporary_id, eventId);
    await serviceRest(c.env, '/candidate_events', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: eventId, organization_id: matter.organization_id, matter_id: matterId, chronology_snapshot_id: snapshotId, event_type: cluster.event_type, title: null, date_start: cluster.date_start, date_end: cluster.date_end, date_precision: cluster.date_start === cluster.date_end ? 'day' : cluster.date_start ? 'range' : 'unknown', actor_entity_ids: cluster.actor_entity_ids, object_entity_ids: cluster.object_entity_ids, event_status: cluster.event_status, independent_source_keys: cluster.independent_source_keys, processing_version: processingVersion, created_by: user.id }) });
    await serviceRest(c.env, '/candidate_event_members', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(cluster.assertion_ids.map((assertionId: string) => ({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, candidate_event_id: eventId, event_assertion_id: assertionId, member_role: 'assertion' }))) });
  }
  const tasks = createChronologyReviewTasks(clusters);
  if (tasks.length) await serviceRest(c.env, '/review_tasks', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(tasks.map((task) => ({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, task_type: task.task_type, object_type: 'candidate_event', object_id: eventIds.get(task.object_id), priority: task.priority, reason: task.task_type }))) });
  await audit(c.env, { organization_id: matter.organization_id, matter_id: matterId, actor_id: user.id, action: 'chronology.rebuilt', resource_type: 'chronology_snapshot', resource_id: snapshotId, request_id: c.get('requestId'), metadata: { version_number: versionNumber, events: clusters.length, review_tasks: tasks.length } });
  return c.json({ data: { snapshot_id: snapshotId, version_number: versionNumber, event_count: clusters.length, review_task_count: tasks.length } }, 201);
});

chronology.post('/matters/:matterId/candidate-events/:eventId/review', async (c) => {
  const matterId = c.req.param('matterId'); const eventId = c.req.param('eventId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'reviewer');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<{ decision?: string; event_status?: string; title?: string; date_start?: string | null; date_end?: string | null; rationale?: string }>(c.req.raw);
  if (!['accepted','corrected','excluded','unresolved'].includes(body.decision ?? '')) throw new ApiError(400, 'invalid review decision', 'invalid_request');
  const current = await serviceRest(c.env, `/candidate_events?id=eq.${eventId}&matter_id=eq.${matterId}&status=eq.active&select=*&limit=1`);
  if (!current?.length) throw new ApiError(404, 'Candidate event not found', 'not_found');
  const next = { title: body.title ?? current[0].title, date_start: body.date_start === undefined ? current[0].date_start : body.date_start, date_end: body.date_end === undefined ? current[0].date_end : body.date_end, event_status: body.decision === 'excluded' ? 'excluded' : body.event_status ?? current[0].event_status, review_status: body.decision, updated_at: new Date().toISOString() };
  await serviceRest(c.env, `/candidate_events?id=eq.${eventId}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify(next) });
  await serviceRest(c.env, '/candidate_event_reviews', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, candidate_event_id: eventId, reviewer_id: user.id, decision: body.decision, previous_value: current[0], new_value: next, rationale: body.rationale ?? null }) });
  await serviceRest(c.env, '/object_revisions', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, object_type: 'candidate_event', object_id: eventId, previous_value: current[0], new_value: next, reason: body.rationale ?? body.decision, reviewer_id: user.id }) });
  await serviceRest(c.env, `/artifact_dependencies?matter_id=eq.${matterId}&source_type=eq.candidate_event&source_id=eq.${eventId}&status=eq.active`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ status: 'stale' }) });
  await serviceRest(c.env, '/regeneration_requests', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, source_type: 'candidate_event', source_id: eventId, target_types: ['chronology_view'], reason: 'candidate_event_reviewed', requested_by: user.id }) });
  return c.json({ data: { id: eventId, ...next } });
});

chronology.get('/matters/:matterId/review-tasks', async (c) => {
  const matterId = c.req.param('matterId');
  await requireMatterRole(c.env, c.get('accessToken'), c.get('user').id, matterId, 'reviewer');
  const rows = await userRest(c.env, c.get('accessToken'), `/review_tasks?matter_id=eq.${matterId}&status=in.(open,in_progress)&select=*&order=priority.desc,created_at.asc`);
  return c.json({ data: rows });
});

chronology.post('/matters/:matterId/review-tasks/:taskId/resolve', async (c) => {
  const matterId = c.req.param('matterId'); const taskId = c.req.param('taskId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'reviewer');
  const body = await readJson<{ resolution?: string; dismiss?: boolean }>(c.req.raw);
  if (!body.resolution?.trim()) throw new ApiError(400, 'resolution is required', 'invalid_request');
  await serviceRest(c.env, `/review_tasks?id=eq.${taskId}&matter_id=eq.${matterId}&status=in.(open,in_progress)`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ status: body.dismiss ? 'dismissed' : 'resolved', resolution: body.resolution.trim(), resolved_by: user.id, resolved_at: new Date().toISOString() }) });
  return c.json({ data: { id: taskId, status: body.dismiss ? 'dismissed' : 'resolved' } });
});
