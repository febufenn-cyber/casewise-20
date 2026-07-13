import { Hono } from 'hono';
import type { Env, Variables } from '../env';
import { filingVersionReadiness, snapshotGraphMembers, validateFilingVersion } from '../../../../packages/core/src/filing-versions.mjs';
import { audit } from '../lib/audit';
import { requireMatterRole } from '../lib/authorization';
import { ApiError, readJson } from '../lib/http';
import { serviceRest, userRest } from '../lib/supabase';

export const filingVersions = new Hono<{ Bindings: Env; Variables: Variables }>();

type ObjectInput = {
  object_type?: string;
  object_id?: string;
  source_span_ids?: string[];
  logical_document_id?: string | null;
  party_entity_ids?: string[];
  review_status?: string;
};

const OBJECT_TABLES: Record<string, string> = {
  allegation: 'allegations',
  response: 'responses',
  response_search: 'allegation_response_searches',
  event_assertion: 'event_assertions',
  candidate_event: 'candidate_events',
  evidence_item: 'evidence_items',
  evidence_relationship: 'proposition_evidence_links',
  contradiction_candidate: 'contradiction_candidates',
  missing_information: 'missing_information_items',
  date_mention: 'date_mentions',
  amount_mention: 'amount_mentions',
  document_reference: 'document_references',
  entity: 'entities',
  entity_role: 'entity_roles',
};

async function activeMatter(env: Env, matterId: string) {
  const rows = await serviceRest(env, `/matters?id=eq.${matterId}&status=eq.active&select=id,organization_id&limit=1`) as Record<string, any>[];
  if (!rows?.length) throw new ApiError(409, 'Active matter required', 'invalid_matter_state');
  return rows[0];
}

async function requireMatterReference(env: Env, matterId: string, table: string, id: string | null | undefined) {
  if (!id) return;
  const rows = await serviceRest(env, `/${table}?id=eq.${id}&matter_id=eq.${matterId}&select=id&limit=1`) as Record<string, any>[];
  if (!rows?.length) throw new ApiError(400, `${table} reference must belong to the matter`, 'invalid_matter_reference');
}

async function loadGraphObjects(env: Env, matterId: string, inputs: ObjectInput[]) {
  const grouped = new Map<string, string[]>();
  for (const item of inputs) {
    const type = item.object_type ?? '';
    const table = OBJECT_TABLES[type];
    if (!table || !item.object_id) throw new ApiError(400, 'Invalid graph object reference', 'invalid_graph_object');
    const ids = grouped.get(type) ?? [];
    ids.push(item.object_id);
    grouped.set(type, ids);
  }

  const objectRows = new Map<string, Record<string, any>>();
  for (const [type, rawIds] of grouped) {
    const ids = [...new Set(rawIds)];
    const table = OBJECT_TABLES[type];
    const rows = await serviceRest(env, `/${table}?id=in.(${ids.join(',')})&matter_id=eq.${matterId}&select=*`) as Record<string, any>[];
    if ((rows ?? []).length !== ids.length) throw new ApiError(400, `${type} objects must belong to the matter`, 'invalid_graph_object');
    for (const row of rows ?? []) objectRows.set(`${type}:${row.id}`, row);
  }

  const sourceIds = [...new Set(inputs.flatMap((item) => item.source_span_ids ?? []))];
  if (!sourceIds.length) throw new ApiError(400, 'Every graph object requires source spans', 'missing_sources');
  const sourceRows = await serviceRest(env, `/source_spans?id=in.(${sourceIds.join(',')})&matter_id=eq.${matterId}&select=id`) as Record<string, any>[];
  if ((sourceRows ?? []).length !== sourceIds.length) throw new ApiError(400, 'Source spans must belong to the matter', 'invalid_sources');

  return inputs.map((item) => {
    const type = item.object_type ?? '';
    const objectId = item.object_id ?? '';
    const payload = objectRows.get(`${type}:${objectId}`);
    if (!payload) throw new ApiError(400, 'Graph object not found', 'invalid_graph_object');
    return {
      object_type: type,
      object_id: objectId,
      source_span_ids: item.source_span_ids ?? [],
      logical_document_id: item.logical_document_id ?? payload.logical_document_id ?? payload.referring_document_id ?? null,
      party_entity_ids: item.party_entity_ids ?? [],
      review_status: item.review_status ?? payload.review_status ?? 'unreviewed',
      payload,
    };
  });
}

filingVersions.get('/matters/:matterId/filing-versions', async (c) => {
  const matterId = c.req.param('matterId');
  await requireMatterRole(c.env, c.get('accessToken'), c.get('user').id, matterId, 'viewer');
  const rows = await userRest(c.env, c.get('accessToken'), `/filing_versions?matter_id=eq.${matterId}&status=neq.deleted&select=*,filing_version_members(*)&order=version_number.desc`);
  return c.json({ data: rows });
});

filingVersions.post('/matters/:matterId/filing-versions', async (c) => {
  const matterId = c.req.param('matterId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'reviewer');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<Record<string, unknown>>(c.req.raw);
  let value;
  try { value = validateFilingVersion(body); }
  catch (error) { throw new ApiError(400, error instanceof Error ? error.message : 'Invalid filing version', 'invalid_filing_version'); }
  await requireMatterReference(c.env, matterId, 'filing_versions', value.parent_version_id);
  await requireMatterReference(c.env, matterId, 'uploaded_files', value.uploaded_file_id);
  await requireMatterReference(c.env, matterId, 'logical_documents', value.logical_document_id);
  await requireMatterReference(c.env, matterId, 'matter_matrix_snapshots', value.matrix_snapshot_id);
  const latest = await serviceRest(c.env, `/filing_versions?matter_id=eq.${matterId}&select=version_number&order=version_number.desc&limit=1`) as Record<string, any>[];
  const versionNumber = Number(latest?.[0]?.version_number ?? 0) + 1;
  const id = crypto.randomUUID();
  await serviceRest(c.env, '/filing_versions', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id, organization_id: matter.organization_id, matter_id: matterId, version_number: versionNumber, ...value, created_by: user.id }) });
  await audit(c.env, { organization_id: matter.organization_id, matter_id: matterId, actor_id: user.id, action: 'filing_version.created', resource_type: 'filing_version', resource_id: id, request_id: c.get('requestId'), metadata: { version_number: versionNumber, filing_kind: value.filing_kind } });
  return c.json({ data: { id, version_number: versionNumber, status: 'draft' } }, 201);
});

filingVersions.post('/matters/:matterId/filing-versions/:versionId/capture', async (c) => {
  const matterId = c.req.param('matterId'); const versionId = c.req.param('versionId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'reviewer');
  const matter = await activeMatter(c.env, matterId);
  const versionRows = await serviceRest(c.env, `/filing_versions?id=eq.${versionId}&matter_id=eq.${matterId}&status=eq.draft&select=id&limit=1`) as Record<string, any>[];
  if (!versionRows?.length) throw new ApiError(404, 'Draft filing version not found', 'not_found');
  const body = await readJson<{ objects?: ObjectInput[] }>(c.req.raw);
  const loaded = await loadGraphObjects(c.env, matterId, body.objects ?? []);
  let members;
  try { members = snapshotGraphMembers(loaded); }
  catch (error) { throw new ApiError(400, error instanceof Error ? error.message : 'Invalid graph snapshot', 'invalid_graph_snapshot'); }
  await serviceRest(c.env, `/filing_version_members?filing_version_id=eq.${versionId}`, { method: 'DELETE', prefer: 'return=minimal' });
  await serviceRest(c.env, '/filing_version_members', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(members.map((member) => ({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, filing_version_id: versionId, ...member }))) });
  await serviceRest(c.env, `/filing_versions?id=eq.${versionId}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ object_count: members.length }) });
  return c.json({ data: { filing_version_id: versionId, object_count: members.length, readiness: filingVersionReadiness(members) } }, 201);
});

filingVersions.post('/matters/:matterId/filing-versions/:versionId/activate', async (c) => {
  const matterId = c.req.param('matterId'); const versionId = c.req.param('versionId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'reviewer');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<{ rationale?: string }>(c.req.raw);
  const versions = await serviceRest(c.env, `/filing_versions?id=eq.${versionId}&matter_id=eq.${matterId}&status=eq.draft&select=*&limit=1`) as Record<string, any>[];
  if (!versions?.length) throw new ApiError(404, 'Draft filing version not found', 'not_found');
  const members = await serviceRest(c.env, `/filing_version_members?filing_version_id=eq.${versionId}&matter_id=eq.${matterId}&select=review_status,source_span_ids`) as Record<string, any>[];
  const readiness = filingVersionReadiness(members ?? []);
  if (!readiness.ready) throw new ApiError(409, 'Filing version has unresolved readiness blockers', 'filing_version_not_ready', readiness);
  await serviceRest(c.env, `/filing_versions?matter_id=eq.${matterId}&status=eq.active`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ status: 'superseded' }) });
  const activatedAt = new Date().toISOString();
  await serviceRest(c.env, `/filing_versions?id=eq.${versionId}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ status: 'active', review_status: 'accepted', reviewed_by: user.id, reviewed_at: activatedAt, activated_at: activatedAt }) });
  await serviceRest(c.env, '/filing_version_reviews', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, filing_version_id: versionId, reviewer_id: user.id, decision: 'activated', readiness, rationale: body.rationale ?? null }) });
  await audit(c.env, { organization_id: matter.organization_id, matter_id: matterId, actor_id: user.id, action: 'filing_version.activated', resource_type: 'filing_version', resource_id: versionId, request_id: c.get('requestId'), metadata: readiness });
  return c.json({ data: { id: versionId, status: 'active', readiness } });
});
