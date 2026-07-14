import { Hono } from 'hono';
import type { Env, Variables } from '../env';
import { narrativeSentenceReadiness, narrativeSupportSetReadiness, validateNarrativeSentence } from '../../../../packages/core/src/narrative-support.mjs';
import { audit } from '../lib/audit';
import { requireMatterRole } from '../lib/authorization';
import { ApiError, readJson } from '../lib/http';
import { serviceRest, userRest } from '../lib/supabase';

export const narrativeSupport = new Hono<{ Bindings: Env; Variables: Variables }>();

type SupportBindingInput = { object_type?: string; object_id?: string; source_span_id?: string; support_role?: string };
type SentenceInput = {
  section_key?: string;
  position?: number;
  sentence_text?: string;
  claim_type?: string;
  materiality?: string;
  attribution_entity_id?: string | null;
  dispute_status?: string;
  uncertainty_status?: string;
  omission_status?: string;
  creation_method?: string;
  processing_version?: string;
  support_bindings?: SupportBindingInput[];
};

type SentenceRecord = Record<string, any> & { id: string; matter_id: string; support_set_id: string; warnings?: string[]; support_status?: string; review_status?: string };

const OBJECT_TABLES: Record<string, string> = {
  logical_document: 'logical_documents',
  entity: 'entities',
  entity_role: 'entity_roles',
  date_mention: 'date_mentions',
  amount_mention: 'amount_mentions',
  event_assertion: 'event_assertions',
  candidate_event: 'candidate_events',
  allegation: 'allegations',
  response: 'responses',
  evidence_item: 'evidence_items',
  evidence_relationship: 'proposition_evidence_links',
  contradiction_candidate: 'contradiction_candidates',
  missing_information: 'missing_information_items',
  matrix_row: 'matter_matrix_rows',
  delta_item: 'delta_items',
  matter_memory_entry: 'matter_memory_entries',
};

async function activeMatter(env: Env, matterId: string) {
  const rows = await serviceRest(env, `/matters?id=eq.${matterId}&status=eq.active&select=id,organization_id&limit=1`) as Record<string, any>[];
  if (!rows?.length) throw new ApiError(409, 'Active matter required', 'invalid_matter_state');
  return rows[0];
}

async function requireApprovedInputs(env: Env, matterId: string, matrixSnapshotId: string, memorySnapshotId?: string | null) {
  const matrices = await serviceRest(env, `/matter_matrix_snapshots?id=eq.${matrixSnapshotId}&matter_id=eq.${matterId}&export_status=eq.attorney_approved&select=id,version_number,processing_version&limit=1`) as Record<string, any>[];
  if (!matrices?.length) throw new ApiError(400, 'An attorney-approved matter matrix snapshot is required', 'invalid_matrix_snapshot');
  let memory: Record<string, any> | null = null;
  if (memorySnapshotId) {
    const memories = await serviceRest(env, `/matter_memory_snapshots?id=eq.${memorySnapshotId}&matter_id=eq.${matterId}&status=eq.active&select=id,version_number&limit=1`) as Record<string, any>[];
    if (!memories?.length) throw new ApiError(400, 'Matter-memory snapshot must be active and belong to the matter', 'invalid_memory_snapshot');
    memory = memories[0];
  }
  return { matrix: matrices[0], memory };
}

async function verifySupportBindings(env: Env, matterId: string, bindings: Array<{ object_type: string; object_id: string; source_span_id: string }>) {
  const sourceIds = [...new Set(bindings.map((binding) => binding.source_span_id))];
  if (!sourceIds.length) throw new ApiError(400, 'At least one exact source span is required', 'missing_sources');
  const sourceRows = await serviceRest(env, `/source_spans?id=in.(${sourceIds.join(',')})&matter_id=eq.${matterId}&status=neq.deleted&select=id`) as Record<string, any>[];
  if ((sourceRows ?? []).length !== sourceIds.length) throw new ApiError(400, 'Source spans must belong to the matter and remain available', 'invalid_sources');

  const grouped = new Map<string, string[]>();
  for (const binding of bindings) {
    const table = OBJECT_TABLES[binding.object_type];
    if (!table) throw new ApiError(400, `Unsupported narrative object type: ${binding.object_type}`, 'invalid_support_object');
    const ids = grouped.get(binding.object_type) ?? [];
    ids.push(binding.object_id);
    grouped.set(binding.object_type, ids);
  }
  for (const [objectType, rawIds] of grouped) {
    const ids = [...new Set(rawIds)];
    const table = OBJECT_TABLES[objectType];
    const rows = await serviceRest(env, `/${table}?id=in.(${ids.join(',')})&matter_id=eq.${matterId}&select=id`) as Record<string, any>[];
    if ((rows ?? []).length !== ids.length) throw new ApiError(400, `${objectType} support objects must belong to the matter`, 'invalid_support_object');
  }
}

async function setReadiness(env: Env, matterId: string, setId: string) {
  const sets = await serviceRest(env, `/narrative_support_sets?id=eq.${setId}&matter_id=eq.${matterId}&status=neq.deleted&select=*&limit=1`) as Record<string, any>[];
  if (!sets?.length) throw new ApiError(404, 'Narrative support set not found', 'not_found');
  const set = sets[0];
  const sentences = await serviceRest(env, `/narrative_sentences?support_set_id=eq.${setId}&matter_id=eq.${matterId}&status=eq.active&select=*`) as SentenceRecord[];
  const sentenceIds = (sentences ?? []).map((sentence) => sentence.id);
  const supports = sentenceIds.length
    ? await serviceRest(env, `/narrative_sentence_supports?sentence_id=in.(${sentenceIds.join(',')})&matter_id=eq.${matterId}&select=id,sentence_id`) as Record<string, any>[]
    : [];
  const supportCounts = new Map<string, number>();
  for (const support of supports ?? []) supportCounts.set(support.sentence_id, (supportCounts.get(support.sentence_id) ?? 0) + 1);
  const normalized = (sentences ?? []).map((sentence) => ({ ...sentence, support_count: supportCounts.get(sentence.id) ?? 0 }));
  const readiness = narrativeSupportSetReadiness(normalized, {
    matrix_snapshot_attorney_approved: true,
    coverage_complete: set.coverage_summary?.complete === true,
  });
  return { set, sentences: normalized, readiness };
}

narrativeSupport.get('/matters/:matterId/narrative-support-sets', async (c) => {
  const matterId = c.req.param('matterId');
  await requireMatterRole(c.env, c.get('accessToken'), c.get('user').id, matterId, 'viewer');
  const rows = await userRest(c.env, c.get('accessToken'), `/narrative_support_sets?matter_id=eq.${matterId}&status=neq.deleted&select=*,narrative_sentences(*,narrative_sentence_supports(*))&order=version_number.desc`);
  return c.json({ data: rows });
});

narrativeSupport.post('/matters/:matterId/narrative-support-sets', async (c) => {
  const matterId = c.req.param('matterId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'editor');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<{ matrix_snapshot_id?: string; memory_snapshot_id?: string | null; artifact_locks?: Record<string, unknown>; coverage_summary?: Record<string, unknown>; creation_method?: string; processing_version?: string }>(c.req.raw);
  if (!body.matrix_snapshot_id) throw new ApiError(400, 'matrix_snapshot_id is required', 'invalid_request');
  const approved = await requireApprovedInputs(c.env, matterId, body.matrix_snapshot_id, body.memory_snapshot_id);
  if (body.coverage_summary?.complete !== true) throw new ApiError(409, 'Complete processing coverage must be declared before narrative support begins', 'coverage_incomplete');
  const latest = await serviceRest(c.env, `/narrative_support_sets?matter_id=eq.${matterId}&select=version_number&order=version_number.desc&limit=1`) as Record<string, any>[];
  const versionNumber = Number(latest?.[0]?.version_number ?? 0) + 1;
  const id = crypto.randomUUID();
  const artifactLocks = { matrix_snapshot_id: body.matrix_snapshot_id, matrix_version: approved.matrix.version_number, memory_snapshot_id: body.memory_snapshot_id ?? null, memory_version: approved.memory?.version_number ?? null, ...(body.artifact_locks ?? {}) };
  await serviceRest(c.env, '/narrative_support_sets', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id, organization_id: matter.organization_id, matter_id: matterId, version_number: versionNumber, matrix_snapshot_id: body.matrix_snapshot_id, memory_snapshot_id: body.memory_snapshot_id ?? null, artifact_locks: artifactLocks, coverage_summary: body.coverage_summary, creation_method: body.creation_method ?? 'manual', processing_version: body.processing_version ?? 'phase5a-v1', production_use_allowed: false, created_by: user.id }) });
  await audit(c.env, { organization_id: matter.organization_id, matter_id: matterId, actor_id: user.id, action: 'narrative_support_set.created', resource_type: 'narrative_support_set', resource_id: id, request_id: c.get('requestId'), metadata: { version_number: versionNumber, production_use_allowed: false, external_gates: 'repository_only' } });
  return c.json({ data: { id, version_number: versionNumber, status: 'draft', production_use_allowed: false } }, 201);
});

narrativeSupport.post('/matters/:matterId/narrative-support-sets/:setId/sentences', async (c) => {
  const matterId = c.req.param('matterId'); const setId = c.req.param('setId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'editor');
  const matter = await activeMatter(c.env, matterId);
  const sets = await serviceRest(c.env, `/narrative_support_sets?id=eq.${setId}&matter_id=eq.${matterId}&status=eq.draft&select=id&limit=1`) as Record<string, any>[];
  if (!sets?.length) throw new ApiError(404, 'Draft narrative support set not found', 'not_found');
  const body = await readJson<SentenceInput>(c.req.raw);
  let value;
  try { value = validateNarrativeSentence(body); }
  catch (error) { throw new ApiError(400, error instanceof Error ? error.message : 'Invalid narrative sentence', 'invalid_narrative_sentence'); }
  await verifySupportBindings(c.env, matterId, value.support_bindings);
  if (value.attribution_entity_id) {
    const entities = await serviceRest(c.env, `/entities?id=eq.${value.attribution_entity_id}&matter_id=eq.${matterId}&select=id&limit=1`) as Record<string, any>[];
    if (!entities?.length) throw new ApiError(400, 'Attribution entity must belong to the matter', 'invalid_attribution');
  }
  const sentenceId = crypto.randomUUID();
  const { support_bindings: supportBindings, ...sentence } = value;
  await serviceRest(c.env, '/narrative_sentences', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: sentenceId, organization_id: matter.organization_id, matter_id: matterId, support_set_id: setId, ...sentence, created_by: user.id }) });
  await serviceRest(c.env, '/narrative_sentence_supports', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(supportBindings.map((binding) => ({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, sentence_id: sentenceId, ...binding }))) });
  const readiness = narrativeSentenceReadiness({ ...sentence, support_count: supportBindings.length });
  const allSentences = await serviceRest(c.env, `/narrative_sentences?support_set_id=eq.${setId}&status=eq.active&select=support_status`) as Record<string, any>[];
  await serviceRest(c.env, `/narrative_support_sets?id=eq.${setId}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ sentence_count: allSentences.length, blocked_sentence_count: allSentences.filter((item) => item.support_status === 'blocked').length, updated_at: new Date().toISOString() }) });
  return c.json({ data: { id: sentenceId, ...sentence, support_count: supportBindings.length, readiness } }, 201);
});

narrativeSupport.get('/matters/:matterId/narrative-support-sets/:setId/readiness', async (c) => {
  const matterId = c.req.param('matterId'); const setId = c.req.param('setId');
  await requireMatterRole(c.env, c.get('accessToken'), c.get('user').id, matterId, 'viewer');
  const context = await setReadiness(c.env, matterId, setId);
  return c.json({ data: context.readiness });
});

narrativeSupport.post('/matters/:matterId/narrative-sentences/:sentenceId/review', async (c) => {
  const matterId = c.req.param('matterId'); const sentenceId = c.req.param('sentenceId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'reviewer');
  const matter = await activeMatter(c.env, matterId);
  const rows = await serviceRest(c.env, `/narrative_sentences?id=eq.${sentenceId}&matter_id=eq.${matterId}&status=eq.active&select=*&limit=1`) as SentenceRecord[];
  if (!rows?.length) throw new ApiError(404, 'Narrative sentence not found', 'not_found');
  const current = rows[0];
  const supports = await serviceRest(c.env, `/narrative_sentence_supports?sentence_id=eq.${sentenceId}&matter_id=eq.${matterId}&select=*`) as Record<string, any>[];
  const body = await readJson<{ decision?: string; rationale?: string; sentence_text?: string }>(c.req.raw);
  if (!['accepted','corrected','rejected','unresolved'].includes(body.decision ?? '')) throw new ApiError(400, 'Invalid narrative review decision', 'invalid_request');
  let next: Record<string, any> = { review_status: body.decision };
  if (body.decision === 'accepted') {
    const readiness = narrativeSentenceReadiness({ ...current, support_count: supports.length });
    if (!readiness.ready_for_acceptance) throw new ApiError(409, 'Sentence has unresolved support or language blockers', 'sentence_not_ready', readiness);
  }
  if (body.decision === 'corrected') {
    const replacement: SentenceInput = { ...current, sentence_text: body.sentence_text, support_bindings: supports.map((support) => ({ object_type: support.object_type, object_id: support.object_id, source_span_id: support.source_span_id, support_role: support.support_role })) };
    let corrected;
    try { corrected = validateNarrativeSentence(replacement); }
    catch (error) { throw new ApiError(400, error instanceof Error ? error.message : 'Invalid corrected sentence', 'invalid_narrative_sentence'); }
    if (corrected.support_status === 'blocked') throw new ApiError(409, 'Corrected sentence still has blockers', 'sentence_not_ready', corrected);
    next = { sentence_text: corrected.sentence_text, warnings: corrected.warnings, support_status: corrected.support_status, review_status: 'corrected', updated_at: new Date().toISOString() };
  }
  await serviceRest(c.env, `/narrative_sentences?id=eq.${sentenceId}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify(next) });
  await serviceRest(c.env, '/narrative_sentence_reviews', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, sentence_id: sentenceId, reviewer_id: user.id, decision: body.decision, previous_value: current, new_value: next, rationale: body.rationale ?? null }) });
  await audit(c.env, { organization_id: matter.organization_id, matter_id: matterId, actor_id: user.id, action: 'narrative_sentence.reviewed', resource_type: 'narrative_sentence', resource_id: sentenceId, request_id: c.get('requestId'), metadata: { decision: body.decision } });
  return c.json({ data: { id: sentenceId, ...next } });
});
