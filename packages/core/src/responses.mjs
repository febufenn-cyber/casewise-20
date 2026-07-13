const RESPONSE_CLASSES = new Set(['admitted','denied','partially_admitted','not_specifically_answered','ambiguous','contradicted_elsewhere']);
const RESPONSE_MODES = new Set(['direct','quoted','reported','inferred']);
const ADDRESS_SCOPE = new Set(['full','partial','unclear']);
const COVERAGE = new Set(['not_reviewed','located','not_located','incomplete']);

export function normalizeResponseText(value) {
  return String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
}

export function validateResponse(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('response must be an object');
  const proposition = normalizeResponseText(input.proposition);
  if (proposition.length < 2) throw new Error('response proposition is required');
  if (proposition.length > 4000) throw new Error('response proposition is too long');
  const source_span_ids = [...new Set((input.source_span_ids ?? []).filter(Boolean))];
  if (!source_span_ids.length) throw new Error('at least one response source span is required');
  const response_mode = input.response_mode ?? 'direct';
  if (!RESPONSE_MODES.has(response_mode)) throw new Error('invalid response mode');
  return {
    proposition,
    source_span_ids,
    responding_entity_id: input.responding_entity_id ?? null,
    logical_document_id: input.logical_document_id ?? null,
    response_mode,
    creation_method: input.creation_method ?? 'manual',
    processing_version: input.processing_version ?? 'phase3-responses-v1',
  };
}

export function validateResponseLink(input) {
  const response_class = input.response_class ?? 'ambiguous';
  if (!RESPONSE_CLASSES.has(response_class)) throw new Error('invalid response class');
  const addressed_scope = input.addressed_scope ?? (response_class === 'partially_admitted' ? 'partial' : 'unclear');
  if (!ADDRESS_SCOPE.has(addressed_scope)) throw new Error('invalid addressed scope');
  return { response_class, addressed_scope, rationale: normalizeResponseText(input.rationale) || null };
}

export function validateResponseCoverage(input) {
  const coverage_status = input.coverage_status ?? 'not_reviewed';
  if (!COVERAGE.has(coverage_status)) throw new Error('invalid response coverage status');
  if (coverage_status === 'not_located' && !(input.scope_note && normalizeResponseText(input.scope_note))) throw new Error('not located requires a documented search scope');
  return {
    coverage_status,
    expected_responding_entity_id: input.expected_responding_entity_id ?? null,
    searched_document_ids: [...new Set((input.searched_document_ids ?? []).filter(Boolean))],
    scope_note: normalizeResponseText(input.scope_note) || null,
  };
}

export function responseWarnings(response, link) {
  const warnings = [];
  if (!response.responding_entity_id) warnings.push('responding_party_not_identified');
  if (response.response_mode === 'quoted') warnings.push('quoted_response_not_direct_statement');
  if (response.response_mode === 'inferred') warnings.push('inferred_response_requires_review');
  if (link.response_class === 'ambiguous') warnings.push('response_class_ambiguous');
  if (link.response_class === 'not_specifically_answered') warnings.push('not_specific_answer_is_not_denial');
  return warnings;
}

export function suggestResponseClass(text) {
  const value = normalizeResponseText(text).toLocaleLowerCase('en-IN');
  if (/\b(partly|partially)\s+admit/.test(value) || /\badmit(?:s|ted)?\b.*\bexcept\b/.test(value)) return 'partially_admitted';
  if (/\b(deny|denies|denied|dispute|disputes|disputed)\b/.test(value)) return 'denied';
  if (/\b(admit|admits|admitted|accepted|accepts)\b/.test(value)) return 'admitted';
  if (/\b(no specific reply|not specifically answered|does not call for a reply)\b/.test(value)) return 'not_specifically_answered';
  return 'ambiguous';
}
