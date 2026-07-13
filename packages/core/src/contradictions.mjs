const CONTRADICTION_TYPES = new Set(['date','amount','identity','position','occurrence','contractual_term','procedural','other']);
const MATERIALITY = new Set(['critical','high','medium','low','unrated']);
const MISSING_CATEGORIES = new Set(['referenced_document','unreadable_page','unsupported_allegation','unaddressed_allegation','inconsistent_date','inconsistent_amount','unresolved_identity','client_question','other']);
const OBJECT_TYPES = new Set(['allegation','response','candidate_event','evidence_item','date_mention','amount_mention','entity','logical_document']);

function normalize(value) {
  return String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
}

export function canonicalObjectPair(aType, aId, bType, bId) {
  if (!OBJECT_TYPES.has(aType) || !OBJECT_TYPES.has(bType)) throw new Error('invalid contradiction object type');
  if (!aId || !bId) throw new Error('both contradiction objects are required');
  if (aType === bType && aId === bId) throw new Error('an object cannot contradict itself');
  const left = `${aType}:${aId}`;
  const right = `${bType}:${bId}`;
  return left < right ? { object_a_type: aType, object_a_id: aId, object_b_type: bType, object_b_id: bId } : { object_a_type: bType, object_a_id: bId, object_b_type: aType, object_b_id: aId };
}

export function validateContradictionCandidate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('contradiction candidate must be an object');
  const pair = canonicalObjectPair(input.object_a_type, input.object_a_id, input.object_b_type, input.object_b_id);
  const contradiction_type = input.contradiction_type ?? 'other';
  if (!CONTRADICTION_TYPES.has(contradiction_type)) throw new Error('invalid contradiction type');
  const materiality = input.materiality ?? 'unrated';
  if (!MATERIALITY.has(materiality)) throw new Error('invalid materiality');
  const source_a_span_ids = [...new Set((input.source_a_span_ids ?? []).filter(Boolean))];
  const source_b_span_ids = [...new Set((input.source_b_span_ids ?? []).filter(Boolean))];
  if (!source_a_span_ids.length || !source_b_span_ids.length) throw new Error('both contradiction sides require source spans');
  return {
    ...pair,
    contradiction_type,
    explanation: normalize(input.explanation) || null,
    materiality,
    source_a_span_ids,
    source_b_span_ids,
    creation_method: input.creation_method ?? 'manual',
    processing_version: input.processing_version ?? 'phase3-contradictions-v1',
  };
}

export function contradictionWarnings(candidate) {
  const warnings = [];
  if (!candidate.explanation) warnings.push('conflict_not_explained');
  if (candidate.source_a_span_ids.some((id) => candidate.source_b_span_ids.includes(id))) warnings.push('same_source_span_on_both_sides');
  if (candidate.creation_method === 'inferred') warnings.push('inferred_contradiction_requires_review');
  return warnings;
}

export function detectStructuredConflicts(items) {
  const groups = new Map();
  for (const item of items) {
    const key = `${item.subject_key ?? ''}|${item.value_type ?? ''}`;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  const conflicts = [];
  for (const [key, values] of groups.entries()) {
    const distinct = new Map(values.map((item) => [normalize(item.normalized_value), item]));
    if (distinct.size < 2) continue;
    const unique = [...distinct.values()];
    for (let i = 0; i < unique.length; i += 1) for (let j = i + 1; j < unique.length; j += 1) conflicts.push({ key, left: unique[i], right: unique[j], contradiction_type: unique[i].value_type === 'amount' ? 'amount' : unique[i].value_type === 'date' ? 'date' : 'other' });
  }
  return conflicts;
}

export function validateMissingInformation(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('missing information item must be an object');
  const category = input.category ?? 'other';
  if (!MISSING_CATEGORIES.has(category)) throw new Error('invalid missing information category');
  const title = normalize(input.title);
  if (!title) throw new Error('missing information title is required');
  const materiality = input.materiality ?? 'unrated';
  if (!MATERIALITY.has(materiality)) throw new Error('invalid materiality');
  const related_type = input.related_type ?? null;
  if (related_type && !OBJECT_TYPES.has(related_type)) throw new Error('invalid related object type');
  if (category === 'referenced_document' && !normalize(input.scope_note)) throw new Error('referenced document items require processed-scope notes');
  return {
    category,
    title,
    description: normalize(input.description) || null,
    scope_note: normalize(input.scope_note) || null,
    materiality,
    related_type,
    related_id: input.related_id ?? null,
    source_span_ids: [...new Set((input.source_span_ids ?? []).filter(Boolean))],
  };
}
