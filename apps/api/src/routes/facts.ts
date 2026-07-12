import { Hono } from 'hono';
import type { Env, Variables } from '../env';
import { compareAmountRepresentations, parseDateMention, parseDocumentReference, parseIndianAmount, referenceResolution } from '../../../../packages/core/src/critical-facts.mjs';
import { audit } from '../lib/audit';
import { requireMatterRole } from '../lib/authorization';
import { ApiError, readJson } from '../lib/http';
import { serviceRest, userRest } from '../lib/supabase';

export const facts = new Hono<{ Bindings: Env; Variables: Variables }>();

async function context(env: Env, matterId: string, sourceSpanId: string) {
  const matters = await serviceRest(env, `/matters?id=eq.${matterId}&status=eq.active&select=id,organization_id&limit=1`);
  if (!matters?.length) throw new ApiError(409, 'Active matter required', 'invalid_matter_state');
  const spans = await serviceRest(env, `/source_spans?id=eq.${sourceSpanId}&matter_id=eq.${matterId}&select=id,logical_document_id&limit=1`);
  if (!spans?.length) throw new ApiError(400, 'source span does not belong to matter', 'invalid_source');
  return { matter: matters[0], span: spans[0] };
}

facts.get('/matters/:matterId/facts', async (c) => {
  const matterId = c.req.param('matterId');
  await requireMatterRole(c.env, c.get('accessToken'), c.get('user').id, matterId, 'viewer');
  const [dates, amounts, references] = await Promise.all([
    userRest(c.env, c.get('accessToken'), `/date_mentions?matter_id=eq.${matterId}&status=eq.active&select=*&order=normalized_start.asc.nullslast`),
    userRest(c.env, c.get('accessToken'), `/amount_mentions?matter_id=eq.${matterId}&status=eq.active&select=*`),
    userRest(c.env, c.get('accessToken'), `/document_references?matter_id=eq.${matterId}&select=*`),
  ]);
  return c.json({ data: { dates, amounts, document_references: references } });
});

facts.post('/matters/:matterId/date-mentions', async (c) => {
  const matterId = c.req.param('matterId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'editor');
  const body = await readJson<{ source_span_id?: string; raw_text?: string; date_type?: string; asserting_entity_id?: string; locale?: string; creation_method?: string; processing_version?: string }>(c.req.raw);
  if (!body.source_span_id || !body.raw_text?.trim()) throw new ApiError(400, 'source_span_id and raw_text are required', 'invalid_request');
  const state = await context(c.env, matterId, body.source_span_id); const parsed = parseDateMention(body.raw_text, { locale: body.locale }); const id = crypto.randomUUID();
  await serviceRest(c.env, '/date_mentions', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id, organization_id: state.matter.organization_id, matter_id: matterId, source_span_id: body.source_span_id, logical_document_id: state.span.logical_document_id, asserting_entity_id: body.asserting_entity_id ?? null, raw_text: parsed.raw_text, normalized_start: parsed.normalized_start, normalized_end: parsed.normalized_end, precision: parsed.precision, certainty: parsed.certainty, date_type: body.date_type ?? 'unknown', possible_interpretations: parsed.ambiguity, creation_method: body.creation_method ?? 'manual', processing_version: body.processing_version ?? 'phase2-facts-v1', review_status: body.creation_method === 'extracted' ? 'unreviewed' : 'confirmed' }) });
  return c.json({ data: { id, ...parsed } }, 201);
});

facts.post('/matters/:matterId/amount-mentions', async (c) => {
  const matterId = c.req.param('matterId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'editor');
  const body = await readJson<{ source_span_id?: string; raw_text?: string; amount_type?: string; asserting_entity_id?: string; related_entity_id?: string; alternate_representation?: string; creation_method?: string; processing_version?: string }>(c.req.raw);
  if (!body.source_span_id || !body.raw_text?.trim()) throw new ApiError(400, 'source_span_id and raw_text are required', 'invalid_request');
  const state = await context(c.env, matterId, body.source_span_id); const parsed = parseIndianAmount(body.raw_text); const comparison = body.alternate_representation ? compareAmountRepresentations(body.raw_text, body.alternate_representation) : { status: 'not_checked' }; const id = crypto.randomUUID();
  await serviceRest(c.env, '/amount_mentions', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id, organization_id: state.matter.organization_id, matter_id: matterId, source_span_id: body.source_span_id, logical_document_id: state.span.logical_document_id, asserting_entity_id: body.asserting_entity_id ?? null, raw_text: parsed.raw_text, currency: parsed.currency, normalized_value: parsed.normalized_value, scale: parsed.scale, amount_type: body.amount_type ?? 'unknown', related_entity_id: body.related_entity_id ?? null, alternate_representation: body.alternate_representation ?? null, consistency_status: comparison.status, creation_method: body.creation_method ?? 'manual', processing_version: body.processing_version ?? 'phase2-facts-v1', review_status: body.creation_method === 'extracted' ? 'unreviewed' : 'confirmed' }) });
  return c.json({ data: { id, ...parsed, consistency_status: comparison.status } }, 201);
});

facts.post('/matters/:matterId/document-references', async (c) => {
  const matterId = c.req.param('matterId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'editor');
  const body = await readJson<{ source_span_id?: string; raw_reference?: string; processing_version?: string }>(c.req.raw);
  if (!body.source_span_id || !body.raw_reference?.trim()) throw new ApiError(400, 'source_span_id and raw_reference are required', 'invalid_request');
  const state = await context(c.env, matterId, body.source_span_id); const parsed = parseDocumentReference(body.raw_reference); const candidates = await serviceRest(c.env, `/logical_documents?matter_id=eq.${matterId}&status=eq.active&select=id,annexure_label,document_type`); const resolution = referenceResolution(parsed, candidates ?? []); const id = crypto.randomUUID();
  await serviceRest(c.env, '/document_references', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id, organization_id: state.matter.organization_id, matter_id: matterId, source_span_id: body.source_span_id, referring_document_id: state.span.logical_document_id, raw_reference: parsed.raw_reference, reference_type: parsed.reference_type, expected_label: parsed.expected_label, resolved_document_id: resolution.resolved_document_id, candidate_document_ids: resolution.candidate_document_ids, resolution_status: resolution.status, processing_version: body.processing_version ?? 'phase2-facts-v1' }) });
  await audit(c.env, { organization_id: state.matter.organization_id, matter_id: matterId, actor_id: user.id, action: 'document_reference.created', resource_type: 'document_reference', resource_id: id, request_id: c.get('requestId'), metadata: { resolution_status: resolution.status } });
  return c.json({ data: { id, ...parsed, ...resolution } }, 201);
});
