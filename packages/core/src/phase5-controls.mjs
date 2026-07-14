function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function phase5ApprovalReadiness(overview = {}, plan = {}, planReadiness = {}, context = {}) {
  const warnings = [];
  if (overview.status !== 'active' || overview.approval_status !== 'ready') warnings.push('overview_not_ready');
  if (plan.status !== 'draft' && plan.status !== 'active') warnings.push('response_plan_invalid_state');
  if (plan.approval_status !== 'draft' && plan.approval_status !== 'ready' && plan.approval_status !== 'review_required') warnings.push('response_plan_not_reviewable');
  if (!planReadiness.ready_for_approval) warnings.push(...(planReadiness.warnings ?? ['response_plan_not_ready']));
  if (plan.overview_snapshot_id !== overview.id) warnings.push('overview_plan_version_mismatch');
  if (plan.matrix_snapshot_id !== overview.matrix_snapshot_id) warnings.push('matrix_version_mismatch');
  if (!overview.source_manifest_fingerprint) warnings.push('overview_source_manifest_missing');
  if (!context.source_integrity_verified) warnings.push('source_integrity_not_verified');
  if (context.processing_coverage_complete !== true) warnings.push('processing_coverage_incomplete');
  return {
    can_approve: [...new Set(warnings)].length === 0,
    warnings: [...new Set(warnings)],
    production_use_allowed: false,
    overview_snapshot_id: overview.id ?? null,
    response_plan_snapshot_id: plan.id ?? null,
  };
}

export function buildInternalExportManifest(input = {}) {
  const overview = input.overview ?? {};
  const plan = input.plan ?? {};
  const overviewEntries = (input.overview_entries ?? []).map((entry) => stableValue(entry));
  const planEntries = (input.plan_entries ?? []).map((entry) => stableValue(entry));
  if (overview.approval_status !== 'attorney_approved' || plan.approval_status !== 'attorney_approved') throw new Error('internal export requires attorney-approved overview and response plan snapshots');
  if (!overviewEntries.length) throw new Error('overview export entries are required');
  if (!planEntries.length) throw new Error('response plan export entries are required');
  const manifest = stableValue({
    schema_version: 1,
    matter_id: input.matter_id,
    organization_id: input.organization_id,
    overview_snapshot: { id: overview.id, version_number: overview.version_number, source_manifest_fingerprint: overview.source_manifest_fingerprint, artifact_locks: overview.artifact_locks },
    response_plan_snapshot: { id: plan.id, version_number: plan.version_number, artifact_locks: plan.artifact_locks },
    overview_entries: overviewEntries,
    response_plan_entries: planEntries,
    classification: 'internal_only',
    filing_ready: false,
    production_use_allowed: false,
    disclaimer: 'Internal attorney work product. Not filing-ready. Requires independent legal review before any external use.',
  });
  return { manifest, manifest_fingerprint: hashString(JSON.stringify(manifest)) };
}

export function invalidationTargets(dependencies = [], upstream = {}) {
  const matches = dependencies.filter((dependency) => dependency.status === 'active' && dependency.upstream_type === upstream.type && dependency.upstream_id === upstream.id);
  const seen = new Set();
  return matches.filter((dependency) => {
    const key = `${dependency.downstream_type}:${dependency.downstream_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((dependency) => ({ downstream_type: dependency.downstream_type, downstream_id: dependency.downstream_id, reason: dependency.dependency_reason ?? 'upstream_changed' }));
}

export function buildDependencyRows(input = {}) {
  const rows = [];
  for (const entry of input.overview_entries ?? []) {
    rows.push({ upstream_type: 'narrative_sentence', upstream_id: entry.sentence_id, downstream_type: 'matter_overview_snapshot', downstream_id: input.overview_snapshot_id, dependency_reason: 'overview_sentence' });
    for (const support of entry.supports ?? []) rows.push({ upstream_type: 'source_span', upstream_id: support.source_span_id, downstream_type: 'matter_overview_snapshot', downstream_id: input.overview_snapshot_id, dependency_reason: 'overview_source' });
  }
  rows.push({ upstream_type: 'matter_overview_snapshot', upstream_id: input.overview_snapshot_id, downstream_type: 'response_plan_snapshot', downstream_id: input.response_plan_snapshot_id, dependency_reason: 'plan_overview_lock' });
  for (const entry of input.plan_entries ?? []) {
    rows.push({ upstream_type: 'response_plan_node', upstream_id: entry.node_id, downstream_type: 'response_plan_snapshot', downstream_id: input.response_plan_snapshot_id, dependency_reason: 'plan_node' });
    for (const support of entry.supports ?? []) rows.push({ upstream_type: 'source_span', upstream_id: support.source_span_id, downstream_type: 'response_plan_snapshot', downstream_id: input.response_plan_snapshot_id, dependency_reason: 'plan_source' });
  }
  const seen = new Set();
  return rows.filter((row) => {
    if (!row.upstream_id || !row.downstream_id) return false;
    const key = `${row.upstream_type}:${row.upstream_id}:${row.downstream_type}:${row.downstream_id}:${row.dependency_reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
