const MATERIALITY_ORDER = new Map([['unrated', 0], ['low', 1], ['medium', 2], ['high', 3], ['critical', 4]]);
const REVIEWED = new Set(['accepted', 'corrected']);
const OPEN_CONTRADICTION = new Set(['candidate', 'confirmed', 'unresolved']);
const RESOLVED_CONTRADICTION = new Set(['explained', 'duplicate', 'false_positive']);
const OPEN_GAP = new Set(['open', 'in_progress', 'unresolved']);
const RESOLVED_GAP = new Set(['resolved', 'dismissed']);

function words(value) {
  return new Set(String(value ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/).filter((token) => token.length > 1));
}

function jaccard(left, right) {
  if (!left.size && !right.size) return 1;
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
}

function isSubset(left, right) {
  return [...left].every((token) => right.has(token));
}

function firstValue(payload, keys) {
  for (const key of keys) {
    const value = payload?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return '';
}

function primaryText(member) {
  const payload = member?.payload ?? {};
  return firstValue(payload, [
    'proposition', 'response_text', 'title', 'description', 'raw_text', 'display_name',
    'raw_reference', 'explanation', 'scope_note', 'relationship', 'event_type', 'date_type', 'amount_type',
  ]);
}

function languageChange(prior, current) {
  const priorWords = words(primaryText(prior));
  const currentWords = words(primaryText(current));
  if (jaccard(priorWords, currentWords) === 1) return 'restated';
  if (currentWords.size && currentWords.size < priorWords.size && isSubset(currentWords, priorWords)) return 'narrowed';
  if (priorWords.size && priorWords.size < currentWords.size && isSubset(priorWords, currentWords)) return 'expanded';
  if (jaccard(priorWords, currentWords) >= 0.72) return 'restated';
  return 'amended';
}

function changed(payloadA, payloadB, keys) {
  return keys.some((key) => JSON.stringify(payloadA?.[key] ?? null) !== JSON.stringify(payloadB?.[key] ?? null));
}

function materialityOf(prior, current, changeType) {
  const values = [prior?.payload?.materiality, current?.payload?.materiality].filter(Boolean);
  let best = values.sort((a, b) => (MATERIALITY_ORDER.get(b) ?? 0) - (MATERIALITY_ORDER.get(a) ?? 0))[0];
  if (!best) {
    if (['new', 'removed', 'response_changed', 'response_coverage_changed', 'date_changed', 'amount_changed', 'contradiction_opened', 'information_gap_opened'].includes(changeType)) best = 'high';
    else if (changeType === 'unchanged') best = 'low';
    else best = 'medium';
  }
  return MATERIALITY_ORDER.has(best) ? best : 'unrated';
}

export function classifyFilingChange(match, prior, current) {
  if (match.match_status === 'new' || !prior) return 'new';
  if (match.match_status === 'removed' || !current) return 'removed';
  if (prior.object_fingerprint === current.object_fingerprint || match.match_status === 'exact') return 'unchanged';
  const a = prior.payload ?? {};
  const b = current.payload ?? {};
  switch (current.object_type) {
    case 'response':
      if (changed(a, b, ['response_class', 'response_mode', 'addressed_scope'])) return 'response_changed';
      return languageChange(prior, current);
    case 'response_search':
      return changed(a, b, ['coverage_status', 'scope_note']) ? 'response_coverage_changed' : languageChange(prior, current);
    case 'date_mention':
      return changed(a, b, ['normalized_start', 'normalized_end', 'precision', 'certainty', 'date_type']) ? 'date_changed' : languageChange(prior, current);
    case 'amount_mention':
      return changed(a, b, ['normalized_value', 'currency', 'scale', 'amount_type', 'consistency_status']) ? 'amount_changed' : languageChange(prior, current);
    case 'entity':
    case 'entity_role':
      return 'party_or_role_changed';
    case 'document_reference':
      return changed(a, b, ['resolved_document_id', 'candidate_document_ids', 'resolution_status', 'expected_label', 'expected_date_start', 'expected_date_end']) ? 'document_reference_changed' : languageChange(prior, current);
    case 'evidence_item':
    case 'evidence_relationship':
      return 'evidence_relationship_changed';
    case 'contradiction_candidate': {
      const priorStatus = a.decision_status ?? 'candidate';
      const currentStatus = b.decision_status ?? 'candidate';
      if (OPEN_CONTRADICTION.has(priorStatus) && RESOLVED_CONTRADICTION.has(currentStatus)) return 'contradiction_resolved';
      if (RESOLVED_CONTRADICTION.has(priorStatus) && OPEN_CONTRADICTION.has(currentStatus)) return 'contradiction_opened';
      return 'amended';
    }
    case 'missing_information': {
      const priorStatus = a.resolution_status ?? 'open';
      const currentStatus = b.resolution_status ?? 'open';
      if (OPEN_GAP.has(priorStatus) && RESOLVED_GAP.has(currentStatus)) return 'information_gap_resolved';
      if (RESOLVED_GAP.has(priorStatus) && OPEN_GAP.has(currentStatus)) return 'information_gap_opened';
      return 'amended';
    }
    default:
      return languageChange(prior, current);
  }
}

export function buildFilingDeltaItems(matches = [], priorMembers = [], currentMembers = [], options = {}) {
  const priorMap = new Map(priorMembers.map((member) => [member.id, member]));
  const currentMap = new Map(currentMembers.map((member) => [member.id, member]));
  const includeUnchanged = Boolean(options.include_unchanged);
  const items = [];
  for (const match of matches.filter((item) => item.selected !== false && item.review_status !== 'rejected')) {
    const prior = match.prior_member_id ? priorMap.get(match.prior_member_id) : null;
    const current = match.current_member_id ? currentMap.get(match.current_member_id) : null;
    const changeType = classifyFilingChange(match, prior, current);
    if (changeType === 'unchanged' && !includeUnchanged) continue;
    const materiality = materialityOf(prior, current, changeType);
    const priorText = primaryText(prior);
    const currentText = primaryText(current);
    items.push({
      match_candidate_id: match.id ?? null,
      object_type: current?.object_type ?? prior?.object_type ?? match.object_type,
      change_type: changeType,
      prior_member_id: prior?.id ?? null,
      current_member_id: current?.id ?? null,
      materiality,
      summary: `${changeType}: ${(currentText || priorText || 'source-linked graph object').slice(0, 240)}`,
      details: {
        match_status: match.match_status,
        similarity_score: match.similarity_score ?? null,
        prior_text: priorText || null,
        current_text: currentText || null,
        prior_fingerprint: prior?.object_fingerprint ?? null,
        current_fingerprint: current?.object_fingerprint ?? null,
      },
      prior_source_span_ids: prior?.source_span_ids ?? [],
      current_source_span_ids: current?.source_span_ids ?? [],
      party_entity_ids: [...new Set([...(prior?.party_entity_ids ?? []), ...(current?.party_entity_ids ?? [])])],
      logical_document_ids: [...new Set([prior?.logical_document_id, current?.logical_document_id].filter(Boolean))],
      review_status: changeType === 'unchanged' ? 'accepted' : 'unreviewed',
    });
  }
  return items;
}

export function deltaSnapshotReadiness(items = []) {
  const changed = items.filter((item) => item.change_type !== 'unchanged');
  const unresolved = changed.filter((item) => !REVIEWED.has(item.review_status));
  const blocked = unresolved.filter((item) => ['critical', 'high'].includes(item.materiality));
  return {
    ready: unresolved.length === 0,
    item_count: items.length,
    changed_item_count: changed.length,
    blocked_item_count: blocked.length,
    review_required_item_count: unresolved.length - blocked.length,
    reviewed_item_count: changed.length - unresolved.length,
  };
}
