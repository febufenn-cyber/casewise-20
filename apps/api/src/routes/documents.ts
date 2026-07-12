import { Hono } from 'hono';
import type { Env, Variables } from '../env';
import { proposeBoundaries, validateSegments } from '../../../../packages/core/src/segmentation.mjs';
import { audit } from '../lib/audit';
import { requireMatterRole } from '../lib/authorization';
import { ApiError, readJson } from '../lib/http';
import { serviceRest, userRest } from '../lib/supabase';

export const documents = new Hono<{ Bindings: Env; Variables: Variables }>();

async function fileForMatter(env: Env, fileId: string, matterId: string) {
  const rows = await serviceRest(env, `/uploaded_files?id=eq.${encodeURIComponent(fileId)}&matter_id=eq.${encodeURIComponent(matterId)}&select=id,organization_id,matter_id,page_count,status&limit=1`);
  if (!rows?.length) throw new ApiError(404, 'File not found', 'not_found');
  if (['deletion_pending', 'deleted'].includes(rows[0].status)) throw new ApiError(410, 'File unavailable', 'source_unavailable');
  if (!Number.isInteger(rows[0].page_count) || rows[0].page_count < 1) throw new ApiError(409, 'File page count is unavailable', 'page_count_unavailable');
  return rows[0];
}

documents.get('/matters/:matterId/documents', async (c) => {
  const matterId = c.req.param('matterId');
  await requireMatterRole(c.env, c.get('accessToken'), c.get('user').id, matterId, 'viewer');
  const rows = await userRest(c.env, c.get('accessToken'), `/logical_documents?matter_id=eq.${matterId}&status=eq.active&select=*&order=uploaded_file_id.asc,start_pdf_page_index.asc`);
  return c.json({ data: rows });
});

documents.post('/matters/:matterId/files/:fileId/segmentation-proposals', async (c) => {
  const matterId = c.req.param('matterId'); const fileId = c.req.param('fileId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'editor');
  const file = await fileForMatter(c.env, fileId, matterId);
  const body = await readJson<{ pages?: Array<Record<string, unknown>>; source_processing_version?: string; threshold?: number }>(c.req.raw);
  if (!Array.isArray(body.pages) || body.pages.length !== file.page_count) throw new ApiError(400, 'pages must cover the complete file', 'invalid_page_signals');
  const versions = await serviceRest(c.env, `/segmentation_versions?uploaded_file_id=eq.${fileId}&select=version_number&order=version_number.desc&limit=1`);
  const versionNumber = Number(versions?.[0]?.version_number ?? 0) + 1; const versionId = crypto.randomUUID();
  const proposals = proposeBoundaries(body.pages, { threshold: body.threshold });
  await serviceRest(c.env, '/segmentation_versions', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: versionId, organization_id: file.organization_id, matter_id: matterId, uploaded_file_id: fileId, version_number: versionNumber, source_processing_version: body.source_processing_version ?? 'unknown', created_by: user.id }) });
  if (proposals.length) await serviceRest(c.env, '/segmentation_boundary_proposals', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(proposals.map((proposal) => ({ id: crypto.randomUUID(), organization_id: file.organization_id, matter_id: matterId, uploaded_file_id: fileId, segmentation_version_id: versionId, pdf_page_index: proposal.pdf_page_index, score: proposal.score, reasons: proposal.reasons, proposal_status: proposal.status }))) });
  await audit(c.env, { organization_id: file.organization_id, matter_id: matterId, actor_id: user.id, action: 'segmentation.proposed', resource_type: 'segmentation_version', resource_id: versionId, request_id: c.get('requestId'), metadata: { proposals: proposals.length } });
  return c.json({ data: { id: versionId, version_number: versionNumber, proposals } }, 201);
});

documents.put('/matters/:matterId/segmentations/:versionId/segments', async (c) => {
  const matterId = c.req.param('matterId'); const versionId = c.req.param('versionId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'editor');
  const versions = await serviceRest(c.env, `/segmentation_versions?id=eq.${versionId}&matter_id=eq.${matterId}&select=*,uploaded_files(page_count)&limit=1`);
  if (!versions?.length || versions[0].status !== 'draft') throw new ApiError(409, 'Draft segmentation version required', 'invalid_segmentation_state');
  const body = await readJson<{ segments?: Array<Record<string, unknown>> }>(c.req.raw);
  const segments = validateSegments(Number(versions[0].uploaded_files.page_count), body.segments ?? []);
  await serviceRest(c.env, `/logical_documents?segmentation_version_id=eq.${versionId}`, { method: 'DELETE', prefer: 'return=minimal' });
  await serviceRest(c.env, '/logical_documents', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(segments.map((segment) => ({ id: crypto.randomUUID(), organization_id: versions[0].organization_id, matter_id: matterId, uploaded_file_id: versions[0].uploaded_file_id, segmentation_version_id: versionId, ordinal: segment.ordinal, title: String(segment.title ?? `Document ${segment.ordinal}`), document_type: String(segment.document_subtype ?? segment.document_family ?? 'unknown'), document_family: String(segment.document_family ?? 'unknown'), document_subtype: String(segment.document_subtype ?? 'unknown'), annexure_label: segment.annexure_label ?? null, start_pdf_page_index: segment.start_pdf_page_index, end_pdf_page_index: segment.end_pdf_page_index, classification_basis: String(segment.classification_basis ?? 'unreviewed'), review_status: String(segment.review_status ?? 'unreviewed'), metadata: segment.metadata ?? {} }))) });
  return c.json({ data: { segmentation_version_id: versionId, segments } });
});

documents.post('/matters/:matterId/segmentations/:versionId/activate', async (c) => {
  const matterId = c.req.param('matterId'); const versionId = c.req.param('versionId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'matter_manager');
  const rows = await serviceRest(c.env, `/segmentation_versions?id=eq.${versionId}&matter_id=eq.${matterId}&select=*&limit=1`);
  if (!rows?.length || rows[0].status !== 'draft') throw new ApiError(409, 'Draft segmentation version required', 'invalid_segmentation_state');
  const documentsForVersion = await serviceRest(c.env, `/logical_documents?segmentation_version_id=eq.${versionId}&select=id&limit=1`);
  if (!documentsForVersion?.length) throw new ApiError(409, 'Segmentation has no documents', 'empty_segmentation');
  await serviceRest(c.env, `/segmentation_versions?uploaded_file_id=eq.${rows[0].uploaded_file_id}&status=eq.active`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ status: 'superseded' }) });
  await serviceRest(c.env, `/logical_documents?uploaded_file_id=eq.${rows[0].uploaded_file_id}&segmentation_version_id=neq.${versionId}&status=eq.active`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ status: 'stale' }) });
  await serviceRest(c.env, `/segmentation_versions?id=eq.${versionId}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ status: 'active', activated_at: new Date().toISOString() }) });
  await serviceRest(c.env, `/artifact_dependencies?matter_id=eq.${matterId}&source_type=eq.segmentation_version&status=eq.active`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ status: 'stale' }) });
  await serviceRest(c.env, '/segmentation_reviews', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: crypto.randomUUID(), organization_id: rows[0].organization_id, matter_id: matterId, segmentation_version_id: versionId, reviewer_id: user.id, decision: 'accepted' }) });
  await audit(c.env, { organization_id: rows[0].organization_id, matter_id: matterId, actor_id: user.id, action: 'segmentation.activated', resource_type: 'segmentation_version', resource_id: versionId, request_id: c.get('requestId') });
  return c.json({ data: { id: versionId, status: 'active' } });
});
