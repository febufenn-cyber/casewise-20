import { Hono } from 'hono';
import type { Env, Variables } from '../env';
import { buildOverviewSourceManifest, overviewReadiness, overviewSummary, validateOverviewSections } from '../../../../packages/core/src/matter-overview.mjs';
import type { OverviewSectionInput, ValidatedOverviewSection } from '../../../../packages/core/src/matter-overview.mjs';
import { narrativeSupportSetReadiness } from '../../../../packages/core/src/narrative-support.mjs';
import { audit } from '../lib/audit';
import { requireMatterRole } from '../lib/authorization';
import { ApiError, readJson } from '../lib/http';
import { serviceRest, userRest } from '../lib/supabase';

export const matterOverviews = new Hono<{ Bindings: Env; Variables: Variables }>();

type SentenceRow = Record<string, any> & { id: string; support_set_id: string; review_status: string; support_status: string; warnings: string[] };

async function activeMatter(env: Env, matterId: string) {
  const rows = await serviceRest(env, `/matters?id=eq.${matterId}&status=eq.active&select=id,organization_id&limit=1`) as Record<string, any>[];
  if (!rows?.length) throw new ApiError(409, 'Active matter required', 'invalid_matter_state');
  return rows[0];
}

async function loadSupportSet(env: Env, matterId: string, setId: string) {
  const sets = await serviceRest(env, `/narrative_support_sets?id=eq.${setId}&matter_id=eq.${matterId}&status=neq.deleted&select=*&limit=1`) as Record<string, any>[];
  if (!sets?.length) throw new ApiError(404, 'Narrative support set not found', 'not_found');
  const set = sets[0];
  const sentences = await serviceRest(env, `/narrative_sentences?support_set_id=eq.${setId}&matter_id=eq.${matterId}&status=eq.active&select=*`) as SentenceRow[];
  const sentenceIds = sentences.map((sentence) => sentence.id);
  const supports = sentenceIds.length
    ? await serviceRest(env, `/narrative_sentence_supports?sentence_id=in.(${sentenceIds.join(',')})&matter_id=eq.${matterId}&select=*`) as Record<string, any>[]
    : [];
  const counts = new Map<string, number>();
  for (const support of supports) counts.set(support.sentence_id, (counts.get(support.sentence_id) ?? 0) + 1);
  const normalized = sentences.map((sentence) => ({ ...sentence, support_count: counts.get(sentence.id) ?? 0 }));
  const setReadiness = narrativeSupportSetReadiness(normalized, { matrix_snapshot_attorney_approved: true, coverage_complete: set.coverage_summary?.complete === true });
  return { set, sentences: normalized, supports, setReadiness };
}

async function loadOverview(env: Env, matterId: string, snapshotId: string) {
  const snapshots = await serviceRest(env, `/matter_overview_snapshots?id=eq.${snapshotId}&matter_id=eq.${matterId}&status=neq.deleted&select=*&limit=1`) as Record<string, any>[];
  if (!snapshots?.length) throw new ApiError(404, 'Matter overview snapshot not found', 'not_found');
  const snapshot = snapshots[0];
  const sections = await serviceRest(env, `/matter_overview_sections?overview_snapshot_id=eq.${snapshotId}&matter_id=eq.${matterId}&status=eq.active&select=*&order=position.asc`) as Record<string, any>[];
  const links = await serviceRest(env, `/matter_overview_section_sentences?overview_snapshot_id=eq.${snapshotId}&matter_id=eq.${matterId}&select=*&order=position.asc`) as Record<string, any>[];
  const sentenceIds = [...new Set(links.map((link) => link.sentence_id))];
  const sentences = sentenceIds.length
    ? await serviceRest(env, `/narrative_sentences?id=in.(${sentenceIds.join(',')})&matter_id=eq.${matterId}&select=*`) as SentenceRow[]
    : [];
  const supports = sentenceIds.length
    ? await serviceRest(env, `/narrative_sentence_supports?sentence_id=in.(${sentenceIds.join(',')})&matter_id=eq.${matterId}&select=*`) as Record<string, any>[]
    : [];
  const sectionInputs: ValidatedOverviewSection[] = sections.map((section) => ({
    section_key: section.section_key,
    title: section.title,
    position: section.position,
    sentence_ids: links.filter((link) => link.section_id === section.id).sort((a, b) => a.position - b.position).map((link) => link.sentence_id),
  }));
  return { snapshot, sections: sectionInputs, sentences, supports };
}

matterOverviews.get('/matters/:matterId/matter-overviews', async (c) => {
  const matterId = c.req.param('matterId');
  await requireMatterRole(c.env, c.get('accessToken'), c.get('user').id, matterId, 'viewer');
  const rows = await userRest(c.env, c.get('accessToken'), `/matter_overview_snapshots?matter_id=eq.${matterId}&status=neq.deleted&select=*,matter_overview_sections(*,matter_overview_section_sentences(*))&order=version_number.desc`);
  return c.json({ data: rows });
});

matterOverviews.post('/matters/:matterId/matter-overviews', async (c) => {
  const matterId = c.req.param('matterId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'editor');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<{ support_set_id?: string; title?: string; sections?: OverviewSectionInput[] }>(c.req.raw);
  if (!body.support_set_id) throw new ApiError(400, 'support_set_id is required', 'invalid_request');
  const title = String(body.title ?? '').replace(/\s+/g, ' ').trim();
  if (!title) throw new ApiError(400, 'title is required', 'invalid_request');
  let sections: ValidatedOverviewSection[];
  try { sections = validateOverviewSections(body.sections ?? []); }
  catch (error) { throw new ApiError(400, error instanceof Error ? error.message : 'Invalid overview sections', 'invalid_overview'); }

  const context = await loadSupportSet(c.env, matterId, body.support_set_id);
  const sentenceIds = [...new Set(sections.flatMap((section) => section.sentence_ids))];
  const selected = context.sentences.filter((sentence) => sentenceIds.includes(sentence.id));
  const readiness = overviewReadiness(sections, selected, { support_set_ready: context.setReadiness.ready_for_overview, artifact_locks_complete: Boolean(context.set.artifact_locks?.matrix_snapshot_id) });
  const latest = await serviceRest(c.env, `/matter_overview_snapshots?matter_id=eq.${matterId}&select=version_number&order=version_number.desc&limit=1`) as Record<string, any>[];
  const versionNumber = Number(latest?.[0]?.version_number ?? 0) + 1;
  const snapshotId = crypto.randomUUID();
  const preview = buildOverviewSourceManifest({ id: snapshotId, support_set_id: context.set.id, artifact_locks: context.set.artifact_locks }, sections, selected, context.supports.filter((support) => sentenceIds.includes(support.sentence_id)));
  await serviceRest(c.env, '/matter_overview_snapshots', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: snapshotId, organization_id: matter.organization_id, matter_id: matterId, version_number: versionNumber, support_set_id: context.set.id, matrix_snapshot_id: context.set.matrix_snapshot_id, memory_snapshot_id: context.set.memory_snapshot_id, title, artifact_locks: context.set.artifact_locks, readiness, source_manifest_fingerprint: preview.manifest_fingerprint, section_count: sections.length, sentence_count: selected.length, approval_status: readiness.ready_for_review ? 'review_required' : 'blocked', production_use_allowed: false, created_by: user.id }) });

  for (const section of sections) {
    const sectionId = crypto.randomUUID();
    await serviceRest(c.env, '/matter_overview_sections', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: sectionId, organization_id: matter.organization_id, matter_id: matterId, overview_snapshot_id: snapshotId, section_key: section.section_key, title: section.title, position: section.position }) });
    await serviceRest(c.env, '/matter_overview_section_sentences', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(section.sentence_ids.map((sentenceId, position) => ({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, overview_snapshot_id: snapshotId, section_id: sectionId, sentence_id: sentenceId, position }))) });
  }
  await audit(c.env, { organization_id: matter.organization_id, matter_id: matterId, actor_id: user.id, action: 'matter_overview.created', resource_type: 'matter_overview_snapshot', resource_id: snapshotId, request_id: c.get('requestId'), metadata: { version_number: versionNumber, readiness, production_use_allowed: false } });
  return c.json({ data: { id: snapshotId, version_number: versionNumber, readiness, summary: overviewSummary(sections, selected), source_manifest_fingerprint: preview.manifest_fingerprint, production_use_allowed: false } }, 201);
});

matterOverviews.get('/matters/:matterId/matter-overviews/:snapshotId/source-manifest', async (c) => {
  const matterId = c.req.param('matterId'); const snapshotId = c.req.param('snapshotId');
  await requireMatterRole(c.env, c.get('accessToken'), c.get('user').id, matterId, 'viewer');
  const context = await loadOverview(c.env, matterId, snapshotId);
  const manifest = buildOverviewSourceManifest(context.snapshot, context.sections, context.sentences, context.supports);
  if (context.snapshot.source_manifest_fingerprint && context.snapshot.source_manifest_fingerprint !== manifest.manifest_fingerprint) throw new ApiError(409, 'Overview source manifest no longer matches its frozen fingerprint', 'overview_manifest_stale');
  return c.json({ data: { snapshot: context.snapshot, ...manifest } });
});

matterOverviews.post('/matters/:matterId/matter-overviews/:snapshotId/review', async (c) => {
  const matterId = c.req.param('matterId'); const snapshotId = c.req.param('snapshotId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'reviewer');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<{ decision?: string; rationale?: string }>(c.req.raw);
  if (!['accepted','rejected','unresolved'].includes(body.decision ?? '')) throw new ApiError(400, 'Invalid overview review decision', 'invalid_request');
  const context = await loadOverview(c.env, matterId, snapshotId);
  const counts = new Map<string, number>();
  for (const support of context.supports) counts.set(support.sentence_id, (counts.get(support.sentence_id) ?? 0) + 1);
  const normalized = context.sentences.map((sentence) => ({ ...sentence, support_count: counts.get(sentence.id) ?? 0 }));
  const readiness = overviewReadiness(context.sections, normalized, { support_set_ready: true, artifact_locks_complete: Boolean(context.snapshot.artifact_locks?.matrix_snapshot_id) });
  if (body.decision === 'accepted' && !readiness.ready_for_review) throw new ApiError(409, 'Overview has unresolved support blockers', 'overview_not_ready', readiness);
  const now = new Date().toISOString();
  const next = body.decision === 'accepted'
    ? { review_status: 'accepted', approval_status: 'ready', status: 'active', reviewed_by: user.id, reviewed_at: now, updated_at: now }
    : { review_status: body.decision === 'rejected' ? 'rejected' : 'unresolved', approval_status: body.decision === 'rejected' ? 'rejected' : 'review_required', status: body.decision === 'rejected' ? 'draft' : context.snapshot.status, reviewed_by: user.id, reviewed_at: now, updated_at: now };
  if (body.decision === 'accepted') {
    await serviceRest(c.env, `/narrative_support_sets?id=eq.${context.snapshot.support_set_id}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ status: 'active', review_status: 'accepted', reviewed_by: user.id, reviewed_at: now, updated_at: now }) });
  }
  await serviceRest(c.env, `/matter_overview_snapshots?id=eq.${snapshotId}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify(next) });
  await serviceRest(c.env, '/matter_overview_reviews', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, overview_snapshot_id: snapshotId, reviewer_id: user.id, decision: body.decision, readiness, previous_value: context.snapshot, new_value: next, rationale: body.rationale ?? null }) });
  await audit(c.env, { organization_id: matter.organization_id, matter_id: matterId, actor_id: user.id, action: 'matter_overview.reviewed', resource_type: 'matter_overview_snapshot', resource_id: snapshotId, request_id: c.get('requestId'), metadata: { decision: body.decision, readiness } });
  return c.json({ data: { id: snapshotId, ...next, readiness } });
});
