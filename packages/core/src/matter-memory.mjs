const REVIEWED = new Set(['accepted', 'corrected']);
const MATERIAL = new Set(['critical', 'high']);

function sourceIntegrity(item) {
  if (item.change_type === 'new') return (item.current_source_span_ids ?? []).length > 0;
  if (item.change_type === 'removed') return (item.prior_source_span_ids ?? []).length > 0;
  return (item.prior_source_span_ids ?? []).length > 0 && (item.current_source_span_ids ?? []).length > 0;
}

export function deltaApprovalReadiness(items = [], matchReadiness = {}) {
  const active = items.filter((item) => item.status !== 'stale' && item.review_status !== 'rejected');
  const unresolved = active.filter((item) => !REVIEWED.has(item.review_status));
  const blocked = unresolved.filter((item) => MATERIAL.has(item.materiality));
  const sourceFailures = active.filter((item) => !sourceIntegrity(item));
  const unresolvedMatches = Number(matchReadiness.unresolved_ambiguous_count ?? 0);
  const warnings = [];
  if (blocked.length) warnings.push('material_delta_items_unresolved');
  if (unresolved.length > blocked.length) warnings.push('delta_items_require_review');
  if (sourceFailures.length) warnings.push('delta_source_integrity_failure');
  if (unresolvedMatches) warnings.push('ambiguous_matches_unresolved');
  const approvalStatus = blocked.length || sourceFailures.length || unresolvedMatches
    ? 'blocked'
    : unresolved.length
      ? 'review_required'
      : 'ready';
  return {
    approval_status: approvalStatus,
    can_approve: approvalStatus === 'ready',
    item_count: active.length,
    unresolved_item_count: unresolved.length,
    blocked_item_count: blocked.length,
    source_failure_count: sourceFailures.length,
    unresolved_match_count: unresolvedMatches,
    warnings,
  };
}

export function buildMatterMemoryEntries(snapshot, items = []) {
  if (!snapshot?.id || !snapshot?.prior_version_id || !snapshot?.current_version_id) throw new Error('approved delta snapshot is required');
  return items
    .filter((item) => item.status !== 'stale' && REVIEWED.has(item.review_status) && item.review_status !== 'rejected')
    .map((item) => ({
      delta_snapshot_id: snapshot.id,
      delta_item_id: item.id,
      memory_key: `${item.object_type}:${item.current_member_id ?? item.prior_member_id ?? item.id}`,
      object_type: item.object_type,
      change_type: item.change_type,
      materiality: item.materiality,
      headline: item.summary,
      prior_version_id: snapshot.prior_version_id,
      current_version_id: snapshot.current_version_id,
      prior_source_span_ids: item.prior_source_span_ids ?? [],
      current_source_span_ids: item.current_source_span_ids ?? [],
      party_entity_ids: item.party_entity_ids ?? [],
      logical_document_ids: item.logical_document_ids ?? [],
      details: item.details ?? {},
    }));
}

export function filterMatterMemory(entries = [], filters = {}) {
  return entries.filter((entry) => {
    if (filters.party_id && !(entry.party_entity_ids ?? []).includes(filters.party_id)) return false;
    if (filters.document_id && !(entry.logical_document_ids ?? []).includes(filters.document_id)) return false;
    if (filters.change_type && entry.change_type !== filters.change_type) return false;
    if (filters.materiality && entry.materiality !== filters.materiality) return false;
    return true;
  });
}

export function matterMemorySummary(entries = []) {
  const counts = {};
  for (const entry of entries) counts[entry.change_type] = (counts[entry.change_type] ?? 0) + 1;
  return {
    entry_count: entries.length,
    critical_count: entries.filter((entry) => entry.materiality === 'critical').length,
    high_count: entries.filter((entry) => entry.materiality === 'high').length,
    change_type_counts: counts,
  };
}
