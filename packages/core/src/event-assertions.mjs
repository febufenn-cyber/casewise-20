const MODES = new Set(['affirmed','denied','qualified','reported','quoted','inferred','uncertain']);

export function normalizeProposition(value) {
  return String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
}

export function validateEventAssertion(assertion) {
  const proposition = normalizeProposition(assertion.proposition);
  if (!proposition) throw new Error('proposition is required');
  if (!MODES.has(assertion.assertion_mode)) throw new Error('invalid assertion mode');
  if (!Array.isArray(assertion.source_span_ids) || assertion.source_span_ids.length === 0) throw new Error('at least one source span is required');
  if (!assertion.asserting_entity_id && assertion.assertion_mode !== 'inferred') throw new Error('asserting entity is required unless explicitly inferred');
  return {
    ...assertion,
    proposition,
    source_span_ids: [...new Set(assertion.source_span_ids)],
    actor_entity_ids: [...new Set(assertion.actor_entity_ids ?? [])],
    object_entity_ids: [...new Set(assertion.object_entity_ids ?? [])],
    date_mention_ids: [...new Set(assertion.date_mention_ids ?? [])],
    amount_mention_ids: [...new Set(assertion.amount_mention_ids ?? [])],
  };
}

export function assertionFingerprint(assertion) {
  const value = validateEventAssertion(assertion);
  return JSON.stringify({
    event_type: value.event_type ?? 'unknown',
    proposition: value.proposition.toLowerCase(),
    asserting_entity_id: value.asserting_entity_id ?? null,
    assertion_mode: value.assertion_mode,
    actors: [...value.actor_entity_ids].sort(),
    objects: [...value.object_entity_ids].sort(),
    dates: [...value.date_mention_ids].sort(),
    amounts: [...value.amount_mention_ids].sort(),
  });
}

export function duplicateAssertionCandidates(assertions) {
  const groups = new Map();
  for (const assertion of assertions) {
    const key = assertionFingerprint(assertion);
    const group = groups.get(key) ?? [];
    group.push(assertion.id);
    groups.set(key, group);
  }
  return [...groups.entries()].filter(([, ids]) => ids.length > 1).map(([fingerprint, ids]) => ({ fingerprint, assertion_ids: ids, status: 'candidate' }));
}

export function assertionWarnings(assertion) {
  const warnings = [];
  if (assertion.assertion_mode === 'quoted') warnings.push('quoted_statement_not_document_finding');
  if (assertion.assertion_mode === 'denied') warnings.push('denial_not_event_confirmation');
  if (assertion.assertion_mode === 'inferred') warnings.push('inferred_not_stated');
  if (!(assertion.actor_entity_ids ?? []).length) warnings.push('actor_unresolved');
  if (!(assertion.date_mention_ids ?? []).length) warnings.push('date_unresolved');
  return warnings;
}

export function independentSourceKey(assertion) {
  return [assertion.logical_document_id ?? 'unknown-document', assertion.asserting_entity_id ?? 'unknown-assertor'].join('|');
}
