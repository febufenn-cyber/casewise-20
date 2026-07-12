function setSimilarity(left = [], right = []) {
  const a = new Set(left); const b = new Set(right);
  if (!a.size && !b.size) return 1;
  const common = [...a].filter((item) => b.has(item)).length;
  return common / new Set([...a, ...b]).size;
}

function rangesOverlap(leftStart, leftEnd, rightStart, rightEnd) {
  if (!leftStart || !rightStart) return null;
  const aStart = new Date(leftStart).getTime(); const aEnd = new Date(leftEnd ?? leftStart).getTime();
  const bStart = new Date(rightStart).getTime(); const bEnd = new Date(rightEnd ?? rightStart).getTime();
  return aStart <= bEnd && bStart <= aEnd;
}

export function eventSimilarity(left, right) {
  if (left.event_type !== right.event_type) return { score: 0, reasons: ['event_type_mismatch'] };
  let score = 0.35; const reasons = ['event_type_match'];
  const actorScore = setSimilarity(left.actor_entity_ids, right.actor_entity_ids);
  const objectScore = setSimilarity(left.object_entity_ids, right.object_entity_ids);
  score += actorScore * 0.2 + objectScore * 0.15;
  if (actorScore > 0) reasons.push('actor_overlap');
  if (objectScore > 0) reasons.push('object_overlap');
  const overlap = rangesOverlap(left.date_start, left.date_end, right.date_start, right.date_end);
  if (overlap === true) { score += 0.2; reasons.push('date_overlap'); }
  if (overlap === false) { score -= 0.2; reasons.push('date_conflict'); }
  const amountScore = setSimilarity(left.amount_mention_ids, right.amount_mention_ids);
  if (amountScore > 0) { score += amountScore * 0.1; reasons.push('amount_overlap'); }
  return { score: Math.max(0, Math.min(1, score)), reasons };
}

export function deriveClusterStatus(assertions) {
  const modes = new Set(assertions.map((item) => item.assertion_mode));
  const dates = new Set(assertions.map((item) => `${item.date_start ?? ''}|${item.date_end ?? ''}`).filter((value) => value !== '|'));
  if (modes.has('affirmed') && modes.has('denied')) return 'contested';
  if (dates.size > 1) return 'contested';
  if (modes.has('uncertain')) return 'ambiguous';
  if (modes.has('inferred') && modes.size === 1) return 'inferred';
  if (!assertions.length || assertions.every((item) => !item.date_start)) return 'unresolved';
  return 'uncontested';
}

export function clusterEventAssertions(assertions, options = {}) {
  const threshold = Number(options.threshold ?? 0.68);
  const clusters = [];
  for (const assertion of assertions) {
    let best = null;
    for (const cluster of clusters) {
      const comparisons = cluster.assertions.map((member) => eventSimilarity(member, assertion));
      const score = Math.max(...comparisons.map((item) => item.score));
      if (score >= threshold && (!best || score > best.score)) best = { cluster, score };
    }
    if (best) best.cluster.assertions.push(assertion);
    else clusters.push({ event_type: assertion.event_type, assertions: [assertion] });
  }
  return clusters.map((cluster, index) => {
    const starts = cluster.assertions.map((item) => item.date_start).filter(Boolean).sort();
    const ends = cluster.assertions.map((item) => item.date_end ?? item.date_start).filter(Boolean).sort();
    return {
      temporary_id: `cluster-${index + 1}`,
      event_type: cluster.event_type,
      assertion_ids: cluster.assertions.map((item) => item.id),
      actor_entity_ids: [...new Set(cluster.assertions.flatMap((item) => item.actor_entity_ids ?? []))],
      object_entity_ids: [...new Set(cluster.assertions.flatMap((item) => item.object_entity_ids ?? []))],
      date_start: starts[0] ?? null,
      date_end: ends.at(-1) ?? null,
      event_status: deriveClusterStatus(cluster.assertions),
      independent_source_keys: [...new Set(cluster.assertions.map((item) => `${item.logical_document_id ?? 'unknown'}|${item.asserting_entity_id ?? 'unknown'}`))],
    };
  });
}

export function reviewTaskPriority({ materiality = 1, uncertainty = 1, downstream_dependencies = 1, source_quality_risk = 1 }) {
  for (const value of [materiality, uncertainty, downstream_dependencies, source_quality_risk]) if (!Number.isFinite(value) || value < 0) throw new Error('priority factors must be non-negative numbers');
  return Number((materiality * uncertainty * downstream_dependencies * source_quality_risk).toFixed(4));
}

export function createChronologyReviewTasks(clusters) {
  const tasks = [];
  for (const cluster of clusters) {
    if (cluster.event_status === 'contested') tasks.push({ task_type: 'contested_event', object_id: cluster.temporary_id, priority: reviewTaskPriority({ materiality: 3, uncertainty: 3, downstream_dependencies: Math.max(1, cluster.assertion_ids.length), source_quality_risk: 1 }) });
    if (cluster.event_status === 'ambiguous') tasks.push({ task_type: 'ambiguous_event', object_id: cluster.temporary_id, priority: reviewTaskPriority({ materiality: 2, uncertainty: 3, downstream_dependencies: Math.max(1, cluster.assertion_ids.length), source_quality_risk: 1.5 }) });
    if (cluster.event_status === 'unresolved') tasks.push({ task_type: 'missing_event_date', object_id: cluster.temporary_id, priority: reviewTaskPriority({ materiality: 2, uncertainty: 2, downstream_dependencies: Math.max(1, cluster.assertion_ids.length), source_quality_risk: 1 }) });
  }
  return tasks.sort((a, b) => b.priority - a.priority);
}

export function chronologySortKey(event) {
  return `${event.date_start ?? '9999-12-31'}|${event.date_end ?? '9999-12-31'}|${event.id ?? event.temporary_id}`;
}

export function chronologyLanes(events, entities = []) {
  const names = new Map(entities.map((entity) => [entity.id, entity.display_name]));
  return [...events].sort((a, b) => chronologySortKey(a).localeCompare(chronologySortKey(b))).map((event) => ({
    ...event,
    lanes: Object.fromEntries((event.assertions ?? []).map((assertion) => [names.get(assertion.asserting_entity_id) ?? assertion.asserting_entity_id ?? 'Unattributed', assertion.proposition])),
  }));
}
