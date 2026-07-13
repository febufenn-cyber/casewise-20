const REVIEWED = new Set(['accepted','corrected']);
const MATERIAL = new Set(['critical','high']);

function byKey(items, key) {
  const map = new Map();
  for (const item of items) {
    const value = item[key];
    const list = map.get(value) ?? [];
    list.push(item);
    map.set(value, list);
  }
  return map;
}

export function buildMatterMatrix(input) {
  const responseLinks = byKey(input.response_links ?? [], 'allegation_id');
  const responseSearches = byKey(input.response_searches ?? [], 'allegation_id');
  const evidenceLinks = byKey((input.evidence_links ?? []).filter((item) => item.target_type === 'allegation'), 'target_id');
  const contradictions = new Map();
  for (const item of input.contradictions ?? []) {
    for (const objectId of [item.object_a_id, item.object_b_id]) {
      const list = contradictions.get(objectId) ?? [];
      list.push(item);
      contradictions.set(objectId, list);
    }
  }
  const missing = new Map();
  for (const item of input.missing_items ?? []) {
    if (!item.related_id) continue;
    const list = missing.get(item.related_id) ?? [];
    list.push(item);
    missing.set(item.related_id, list);
  }

  return (input.allegations ?? []).map((allegation) => {
    const links = responseLinks.get(allegation.id) ?? [];
    const searches = responseSearches.get(allegation.id) ?? [];
    const evidence = evidenceLinks.get(allegation.id) ?? [];
    const conflicts = contradictions.get(allegation.id) ?? [];
    const gaps = missing.get(allegation.id) ?? [];
    const warnings = [];
    const latestSearch = searches[0] ?? null;
    if (!REVIEWED.has(allegation.review_status)) warnings.push('allegation_not_reviewed');
    if (!links.length && latestSearch?.coverage_status !== 'not_located') warnings.push('response_mapping_incomplete');
    if (!links.length && latestSearch?.coverage_status === 'not_located' && !latestSearch.scope_note) warnings.push('response_search_scope_missing');
    if (links.some((link) => !REVIEWED.has(link.review_status))) warnings.push('response_classification_not_reviewed');
    if (evidence.some((link) => !REVIEWED.has(link.review_status) || link.support_status === 'unreviewed')) warnings.push('evidence_support_not_reviewed');
    if (conflicts.some((item) => ['candidate','unresolved'].includes(item.decision_status) && MATERIAL.has(item.materiality))) warnings.push('material_contradiction_unresolved');
    if (gaps.some((item) => ['open','in_progress','unresolved'].includes(item.resolution_status) && MATERIAL.has(item.materiality))) warnings.push('material_information_gap_open');
    return {
      allegation_id: allegation.id,
      allegation,
      responses: links,
      response_search: latestSearch,
      evidence,
      contradictions: conflicts,
      missing_information: gaps,
      readiness_status: warnings.length ? (MATERIAL.has(allegation.materiality) ? 'blocked' : 'review_required') : 'ready',
      warnings,
    };
  });
}

export function matrixReadiness(rows, coverage = {}) {
  const blocked = rows.filter((row) => row.readiness_status === 'blocked');
  const reviewRequired = rows.filter((row) => row.readiness_status === 'review_required');
  const coverageWarnings = [];
  if (coverage.failed_files > 0 || coverage.failed_pages > 0) coverageWarnings.push('processing_failures_present');
  if (coverage.unreadable_pages > 0) coverageWarnings.push('unreadable_pages_present');
  if (coverage.quarantined_files > 0) coverageWarnings.push('quarantined_files_present');
  const export_status = blocked.length || coverageWarnings.length ? 'blocked' : reviewRequired.length ? 'review_required' : 'ready';
  return {
    export_status,
    row_count: rows.length,
    blocked_row_count: blocked.length,
    review_required_row_count: reviewRequired.length,
    ready_row_count: rows.length - blocked.length - reviewRequired.length,
    coverage_warnings: coverageWarnings,
  };
}

export function canApproveMatrix(readiness) {
  return readiness.export_status === 'ready' && readiness.blocked_row_count === 0 && readiness.review_required_row_count === 0 && readiness.coverage_warnings.length === 0;
}
