import { Hono } from 'hono';
import type { Env, Variables } from '../env';
import { buildDependencyRows, buildInternalExportManifest, invalidationTargets, phase5ApprovalReadiness } from '../../../../packages/core/src/phase5-controls.mjs';
import type { DependencyRow } from '../../../../packages/core/src/phase5-controls.mjs';
import { responsePlanReadiness } from '../../../../packages/core/src/response-planning.mjs';
import { audit } from '../lib/audit';
import { requireMatterRole } from '../lib/authorization';
import { ApiError, readJson } from '../lib/http';
import { serviceRest, userRest } from '../lib/supabase';

export const phase5Controls = new Hono<{ Bindings: Env; Variables: Variables }>();

type OverviewContext = {
  snapshot: Record<string, any>;
  sections: Record<string, any>[];
  links: Record<string, any>[];
  sentences: Record<string, any>[];
  supports: Record<string, any>[];
  entries: Record<string, any>[];
};

type PlanContext = {
  snapshot: Record<string, any>;
  nodes: Record<string, any>[];
  supports: Record<string, any>[];
  dependencies: Record<string, any>[];
  entries: Record<string, any>[];
  readiness: Record<string, any>;
};

async function activeMatter(env: Env, matterId: string) {
  const rows = await serviceRest(env, `/matters?id=eq.${matterId}&status=eq.active&select=id,organization_id&limit=1`) as Record<string, any>[];
  if (!rows?.length) throw new ApiError(409, 'Active matter required', 'invalid_matter_state');
  return rows[0];
}

async function loadOverview(env: Env, matterId: string, snapshotId: string): Promise<OverviewContext> {
  const snapshots = await serviceRest(env, `/matter_overview_snapshots?id=eq.${snapshotId}&matter_id=eq.${matterId}&status=neq.deleted&select=*&limit=1`) as Record<string, any>[];
  if (!snapshots?.length) throw new ApiError(404, 'Matter overview snapshot not found', 'not_found');
  const snapshot = snapshots[0];
  const sections = await serviceRest(env, `/matter_overview_sections?overview_snapshot_id=eq.${snapshotId}&matter_id=eq.${matterId}&status=eq.active&select=*&order=position.asc`) as Record<string, any>[];
  const links = await serviceRest(env, `/matter_overview_section_sentences?overview_snapshot_id=eq.${snapshotId}&matter_id=eq.${matterId}&select=*&order=position.asc`) as Record<string, any>[];
  const sentenceIds = [...new Set(links.map((link) => String(link.sentence_id)))];
  const sentences = sentenceIds.length
    ? await serviceRest(env, `/narrative_sentences?id=in.(${sentenceIds.join(',')})&matter_id=eq.${matterId}&status=eq.active&select=*`) as Record<string, any>[]
    : [];
  const supports = sentenceIds.length
    ? await serviceRest(env, `/narrative_sentence_supports?sentence_id=in.(${sentenceIds.join(',')})&matter_id=eq.${matterId}&select=*`) as Record<string, any>[]
    : [];
  const entries = links.map((link) => {
    const sentence = sentences.find((item) => item.id === link.sentence_id);
    const section = sections.find((item) => item.id === link.section_id);
    return {
      section_key: section?.section_key ?? null,
      section_title: section?.title ?? null,
      sentence_id: link.sentence_id,
      sentence_text: sentence?.sentence_text ?? null,
      materiality: sentence?.materiality ?? 'unrated',
      attribution_entity_id: sentence?.attribution_entity_id ?? null,
      dispute_status: sentence?.dispute_status ?? 'unresolved',
      uncertainty_status: sentence?.uncertainty_status ?? 'unresolved',
      omission_status: sentence?.omission_status ?? 'none',
      supports: supports.filter((support) => support.sentence_id === link.sentence_id).map((support) => ({ object_type: support.object_type, object_id: support.object_id, source_span_id: support.source_span_id, support_role: support.support_role })),
    };
  });
  return { snapshot, sections, links, sentences, supports, entries };
}

async function loadPlan(env: Env, matterId: string, planId: string): Promise<PlanContext> {
  const snapshots = await serviceRest(env, `/response_plan_snapshots?id=eq.${planId}&matter_id=eq.${matterId}&status=neq.deleted&select=*&limit=1`) as Record<string, any>[];
  if (!snapshots?.length) throw new ApiError(404, 'Response plan snapshot not found', 'not_found');
  const snapshot = snapshots[0];
  const nodes = await serviceRest(env, `/response_plan_nodes?plan_snapshot_id=eq.${planId}&matter_id=eq.${matterId}&status=eq.active&select=*&order=position.asc`) as Record<string, any>[];
  const nodeIds = nodes.map((node) => String(node.id));
  const supports = nodeIds.length
    ? await serviceRest(env, `/response_plan_node_supports?plan_node_id=in.(${nodeIds.join(',')})&matter_id=eq.${matterId}&select=*`) as Record<string, any>[]
    : [];
  const dependencies = await serviceRest(env, `/response_plan_dependencies?plan_snapshot_id=eq.${planId}&matter_id=eq.${matterId}&select=node_id,depends_on_node_id,dependency_type`) as Record<string, any>[];
  const normalized: Record<string, any>[] = nodes.map((node) => ({ ...node, support_count: supports.filter((support) => support.plan_node_id === node.id).length }));
  const readiness = responsePlanReadiness(normalized, dependencies, { matrix_snapshot_attorney_approved: true, overview_ready: true });
  const entries = normalized.map((node) => ({
    node_id: node.id,
    matrix_row_id: node.matrix_row_id,
    allegation_id: node.allegation_id,
    node_type: node.node_type,
    title: node.title,
    details: node.details,
    materiality: node.materiality,
    node_status: node.node_status,
    assigned_to: node.assigned_to,
    due_at: node.due_at,
    review_status: node.review_status,
    warnings: node.warnings ?? [],
    supports: supports.filter((support) => support.plan_node_id === node.id).map((support) => ({ object_type: support.object_type, object_id: support.object_id, source_span_id: support.source_span_id, support_role: support.support_role })),
  }));
  return { snapshot, nodes: normalized, supports, dependencies, entries, readiness };
}

async function approvalContext(env: Env, matterId: string, overviewId: string, planId: string, sourceIntegrityVerified: boolean, processingCoverageComplete: boolean) {
  const [overview, plan] = await Promise.all([loadOverview(env, matterId, overviewId), loadPlan(env, matterId, planId)]);
  const readiness = phase5ApprovalReadiness(overview.snapshot, plan.snapshot, plan.readiness, { source_integrity_verified: sourceIntegrityVerified, processing_coverage_complete: processingCoverageComplete });
  return { overview, plan, readiness };
}

phase5Controls.get('/matters/:matterId/phase5/readiness', async (c) => {
  const matterId = c.req.param('matterId');
  await requireMatterRole(c.env, c.get('accessToken'), c.get('user').id, matterId, 'viewer');
  const overviewId = c.req.query('overview_snapshot_id'); const planId = c.req.query('response_plan_snapshot_id');
  if (!overviewId || !planId) throw new ApiError(400, 'overview_snapshot_id and response_plan_snapshot_id are required', 'invalid_request');
  const context = await approvalContext(c.env, matterId, overviewId, planId, c.req.query('source_integrity_verified') === 'true', c.req.query('processing_coverage_complete') === 'true');
  return c.json({ data: context.readiness });
});

phase5Controls.post('/matters/:matterId/phase5/dependencies/rebuild', async (c) => {
  const matterId = c.req.param('matterId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'editor');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<{ overview_snapshot_id?: string; response_plan_snapshot_id?: string }>(c.req.raw);
  if (!body.overview_snapshot_id || !body.response_plan_snapshot_id) throw new ApiError(400, 'overview_snapshot_id and response_plan_snapshot_id are required', 'invalid_request');
  const [overview, plan] = await Promise.all([loadOverview(c.env, matterId, body.overview_snapshot_id), loadPlan(c.env, matterId, body.response_plan_snapshot_id)]);
  if (plan.snapshot.overview_snapshot_id !== overview.snapshot.id) throw new ApiError(400, 'Response plan must be locked to the selected overview', 'artifact_version_mismatch');
  const rows = buildDependencyRows({ overview_snapshot_id: overview.snapshot.id, response_plan_snapshot_id: plan.snapshot.id, overview_entries: overview.entries, plan_entries: plan.entries });
  await serviceRest(c.env, `/phase5_artifact_dependencies?matter_id=eq.${matterId}&downstream_id=in.(${overview.snapshot.id},${plan.snapshot.id})`, { method: 'DELETE', prefer: 'return=minimal' });
  if (rows.length) await serviceRest(c.env, '/phase5_artifact_dependencies', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(rows.map((row) => ({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, ...row }))) });
  await audit(c.env, { organization_id: matter.organization_id, matter_id: matterId, actor_id: user.id, action: 'phase5_dependencies.rebuilt', resource_type: 'response_plan_snapshot', resource_id: plan.snapshot.id, request_id: c.get('requestId'), metadata: { overview_snapshot_id: overview.snapshot.id, dependency_count: rows.length } });
  return c.json({ data: { dependency_count: rows.length, production_use_allowed: false } }, 201);
});

phase5Controls.post('/matters/:matterId/phase5/approve', async (c) => {
  const matterId = c.req.param('matterId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'matter_manager');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<{ overview_snapshot_id?: string; response_plan_snapshot_id?: string; source_integrity_verified?: boolean; processing_coverage_complete?: boolean; rationale?: string }>(c.req.raw);
  if (!body.overview_snapshot_id || !body.response_plan_snapshot_id) throw new ApiError(400, 'overview_snapshot_id and response_plan_snapshot_id are required', 'invalid_request');
  const context = await approvalContext(c.env, matterId, body.overview_snapshot_id, body.response_plan_snapshot_id, body.source_integrity_verified === true, body.processing_coverage_complete === true);
  if (!context.readiness.can_approve) throw new ApiError(409, 'Phase 5 artifacts have unresolved approval blockers', 'phase5_not_ready', context.readiness);
  const now = new Date().toISOString();
  await serviceRest(c.env, '/phase5_approvals', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify([
    { id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, artifact_type: 'matter_overview_snapshot', artifact_id: context.overview.snapshot.id, artifact_version: context.overview.snapshot.version_number, decision: 'attorney_approved', readiness: context.readiness, reviewer_id: user.id, rationale: body.rationale ?? null },
    { id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, artifact_type: 'response_plan_snapshot', artifact_id: context.plan.snapshot.id, artifact_version: context.plan.snapshot.version_number, decision: 'attorney_approved', readiness: context.readiness, reviewer_id: user.id, rationale: body.rationale ?? null },
  ]) });
  await serviceRest(c.env, `/matter_overview_snapshots?id=eq.${context.overview.snapshot.id}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ approval_status: 'attorney_approved', approved_by: user.id, approved_at: now, status: 'active', updated_at: now }) });
  await serviceRest(c.env, `/response_plan_snapshots?id=eq.${context.plan.snapshot.id}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ approval_status: 'attorney_approved', review_status: 'accepted', approved_by: user.id, approved_at: now, status: 'active', updated_at: now }) });
  await audit(c.env, { organization_id: matter.organization_id, matter_id: matterId, actor_id: user.id, action: 'phase5_artifacts.attorney_approved', resource_type: 'response_plan_snapshot', resource_id: context.plan.snapshot.id, request_id: c.get('requestId'), metadata: { overview_snapshot_id: context.overview.snapshot.id, overview_version: context.overview.snapshot.version_number, response_plan_version: context.plan.snapshot.version_number, production_use_allowed: false } });
  return c.json({ data: { overview_snapshot_id: context.overview.snapshot.id, response_plan_snapshot_id: context.plan.snapshot.id, approval_status: 'attorney_approved', approved_at: now, production_use_allowed: false } });
});

phase5Controls.post('/matters/:matterId/phase5/invalidate', async (c) => {
  const matterId = c.req.param('matterId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'reviewer');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<{ upstream_type?: string; upstream_id?: string; reason?: string }>(c.req.raw);
  if (!body.upstream_type || !body.upstream_id || !body.reason) throw new ApiError(400, 'upstream_type, upstream_id and reason are required', 'invalid_request');
  const dependencies = await serviceRest(c.env, `/phase5_artifact_dependencies?matter_id=eq.${matterId}&upstream_type=eq.${body.upstream_type}&upstream_id=eq.${body.upstream_id}&status=eq.active&select=*`) as DependencyRow[];
  const targets = invalidationTargets(dependencies, { type: body.upstream_type, id: body.upstream_id });
  const now = new Date().toISOString();
  for (const target of targets) {
    if (target.downstream_type === 'matter_overview_snapshot') {
      await serviceRest(c.env, `/matter_overview_snapshots?id=eq.${target.downstream_id}&matter_id=eq.${matterId}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ status: 'stale', approval_status: 'blocked', approved_by: null, approved_at: null, updated_at: now }) });
      await serviceRest(c.env, `/phase5_internal_export_packages?matter_id=eq.${matterId}&overview_snapshot_id=eq.${target.downstream_id}&export_status=eq.active`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ export_status: 'invalidated', invalidated_at: now }) });
    }
    if (target.downstream_type === 'response_plan_snapshot') {
      await serviceRest(c.env, `/response_plan_snapshots?id=eq.${target.downstream_id}&matter_id=eq.${matterId}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ status: 'stale', approval_status: 'blocked', approved_by: null, approved_at: null, updated_at: now }) });
      await serviceRest(c.env, `/phase5_internal_export_packages?matter_id=eq.${matterId}&response_plan_snapshot_id=eq.${target.downstream_id}&export_status=eq.active`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ export_status: 'invalidated', invalidated_at: now }) });
    }
  }
  if (dependencies.length) await serviceRest(c.env, `/phase5_artifact_dependencies?matter_id=eq.${matterId}&upstream_type=eq.${body.upstream_type}&upstream_id=eq.${body.upstream_id}&status=eq.active`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ status: 'stale', updated_at: now }) });
  const eventId = crypto.randomUUID();
  await serviceRest(c.env, '/phase5_invalidation_events', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: eventId, organization_id: matter.organization_id, matter_id: matterId, upstream_type: body.upstream_type, upstream_id: body.upstream_id, reason: body.reason, invalidated_targets: targets, actor_id: user.id }) });
  await audit(c.env, { organization_id: matter.organization_id, matter_id: matterId, actor_id: user.id, action: 'phase5_artifacts.invalidated', resource_type: body.upstream_type, resource_id: body.upstream_id, request_id: c.get('requestId'), metadata: { event_id: eventId, target_count: targets.length, reason: body.reason } });
  return c.json({ data: { event_id: eventId, invalidated_targets: targets } });
});

phase5Controls.get('/matters/:matterId/phase5/internal-exports', async (c) => {
  const matterId = c.req.param('matterId');
  await requireMatterRole(c.env, c.get('accessToken'), c.get('user').id, matterId, 'viewer');
  const rows = await userRest(c.env, c.get('accessToken'), `/phase5_internal_export_packages?matter_id=eq.${matterId}&export_status=neq.deleted&select=*,phase5_internal_export_items(*)&order=version_number.desc`);
  return c.json({ data: rows });
});

phase5Controls.post('/matters/:matterId/phase5/internal-exports', async (c) => {
  const matterId = c.req.param('matterId'); const user = c.get('user');
  await requireMatterRole(c.env, c.get('accessToken'), user.id, matterId, 'matter_manager');
  const matter = await activeMatter(c.env, matterId);
  const body = await readJson<{ overview_snapshot_id?: string; response_plan_snapshot_id?: string }>(c.req.raw);
  if (!body.overview_snapshot_id || !body.response_plan_snapshot_id) throw new ApiError(400, 'overview_snapshot_id and response_plan_snapshot_id are required', 'invalid_request');
  const [overview, plan] = await Promise.all([loadOverview(c.env, matterId, body.overview_snapshot_id), loadPlan(c.env, matterId, body.response_plan_snapshot_id)]);
  if (overview.snapshot.approval_status !== 'attorney_approved' || plan.snapshot.approval_status !== 'attorney_approved') throw new ApiError(409, 'Internal export requires attorney-approved overview and response plan snapshots', 'phase5_export_not_ready');
  const built = buildInternalExportManifest({ matter_id: matterId, organization_id: matter.organization_id, overview: overview.snapshot, plan: plan.snapshot, overview_entries: overview.entries, plan_entries: plan.entries });
  const latest = await serviceRest(c.env, `/phase5_internal_export_packages?matter_id=eq.${matterId}&select=version_number&order=version_number.desc&limit=1`) as Record<string, any>[];
  const versionNumber = Number(latest?.[0]?.version_number ?? 0) + 1;
  const packageId = crypto.randomUUID();
  await serviceRest(c.env, '/phase5_internal_export_packages', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: packageId, organization_id: matter.organization_id, matter_id: matterId, version_number: versionNumber, overview_snapshot_id: overview.snapshot.id, response_plan_snapshot_id: plan.snapshot.id, manifest: built.manifest, manifest_fingerprint: built.manifest_fingerprint, created_by: user.id }) });
  const items: Record<string, any>[] = [];
  for (const entry of overview.entries) items.push({ item_type: 'overview_sentence', item_id: String(entry.sentence_id), manifest_fragment: entry });
  for (const entry of plan.entries) items.push({ item_type: 'response_plan_node', item_id: String(entry.node_id), manifest_fragment: entry });
  items.push({ item_type: 'artifact_lock', item_id: 'overview', manifest_fragment: built.manifest.overview_snapshot });
  items.push({ item_type: 'artifact_lock', item_id: 'response-plan', manifest_fragment: built.manifest.response_plan_snapshot });
  items.push({ item_type: 'disclaimer', item_id: 'internal-only', manifest_fragment: { disclaimer: built.manifest.disclaimer, filing_ready: false, production_use_allowed: false } });
  await serviceRest(c.env, '/phase5_internal_export_items', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(items.map((item) => ({ id: crypto.randomUUID(), organization_id: matter.organization_id, matter_id: matterId, export_package_id: packageId, ...item }))) });
  await audit(c.env, { organization_id: matter.organization_id, matter_id: matterId, actor_id: user.id, action: 'phase5_internal_export.created', resource_type: 'phase5_internal_export_package', resource_id: packageId, request_id: c.get('requestId'), metadata: { version_number: versionNumber, manifest_fingerprint: built.manifest_fingerprint, classification: 'internal_only', filing_ready: false, production_use_allowed: false } });
  return c.json({ data: { id: packageId, version_number: versionNumber, manifest_fingerprint: built.manifest_fingerprint, classification: 'internal_only', filing_ready: false, production_use_allowed: false } }, 201);
});
