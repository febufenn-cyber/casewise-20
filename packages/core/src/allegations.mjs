const ALLEGATION_TYPES = new Set([
  'factual', 'contractual', 'procedural', 'monetary', 'conduct',
  'entitlement', 'causation', 'damage', 'other',
]);
const MATERIALITY = new Set(['critical', 'high', 'medium', 'low', 'unrated']);
const CREATION_METHODS = new Set(['extracted', 'manual', 'inferred']);

export function normalizeAllegationText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
}

export function allegationFingerprint(allegation) {
  const proposition = normalizeAllegationText(allegation.proposition).toLocaleLowerCase('en-IN');
  const alleging = String(allegation.alleging_entity_id ?? 'unknown');
  const targets = [...new Set(allegation.target_entity_ids ?? [])].sort().join(',');
  return `${alleging}|${targets}|${proposition}`;
}

export function validateAllegation(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('allegation must be an object');
  const proposition = normalizeAllegationText(input.proposition);
  if (proposition.length < 3) throw new Error('proposition is required');
  if (proposition.length > 4000) throw new Error('proposition is too long');
  const source_span_ids = [...new Set((input.source_span_ids ?? []).filter(Boolean))];
  if (!source_span_ids.length) throw new Error('at least one source span is required');
  const allegation_type = input.allegation_type ?? 'factual';
  if (!ALLEGATION_TYPES.has(allegation_type)) throw new Error('invalid allegation type');
  const materiality = input.materiality ?? 'unrated';
  if (!MATERIALITY.has(materiality)) throw new Error('invalid materiality');
  const creation_method = input.creation_method ?? 'manual';
  if (!CREATION_METHODS.has(creation_method)) throw new Error('invalid creation method');
  return {
    proposition,
    source_span_ids,
    alleging_entity_id: input.alleging_entity_id ?? null,
    target_entity_ids: [...new Set((input.target_entity_ids ?? []).filter(Boolean))],
    logical_document_id: input.logical_document_id ?? null,
    allegation_type,
    procedural_context: normalizeAllegationText(input.procedural_context) || null,
    materiality,
    creation_method,
    processing_version: input.processing_version ?? 'phase3-allegations-v1',
  };
}

export function allegationWarnings(allegation) {
  const warnings = [];
  if (!allegation.alleging_entity_id) warnings.push('asserting_party_not_identified');
  if (!allegation.target_entity_ids.length) warnings.push('target_not_identified');
  if (allegation.creation_method === 'inferred') warnings.push('inferred_not_source_stated');
  if (/\b(?:may|might|appears|alleged|approximately|about)\b/i.test(allegation.proposition)) warnings.push('qualified_or_approximate_language');
  return warnings;
}

export function duplicateAllegationCandidates(allegations) {
  const groups = new Map();
  for (const allegation of allegations) {
    const key = allegationFingerprint(allegation);
    const list = groups.get(key) ?? [];
    list.push(allegation.id);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([fingerprint, allegation_ids]) => ({ fingerprint, allegation_ids }));
}
