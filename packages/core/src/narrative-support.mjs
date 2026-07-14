const CLAIM_TYPES = new Set(['factual_statement','party_position','procedural_context','uncertainty','omission','internal_note']);
const MATERIALITIES = new Set(['critical','high','medium','low','unrated']);
const DISPUTE_STATES = new Set(['uncontested','contested','ambiguous','not_applicable','unresolved']);
const UNCERTAINTY_STATES = new Set(['certain','qualified','inferred','ambiguous','unresolved']);
const OMISSION_STATES = new Set(['none','not_located','processing_gap','scope_limited','unresolved']);
const CREATION_METHODS = new Set(['manual','rule_based','model_assisted']);
const SUPPORT_ROLES = new Set(['primary','supporting','context','contradictory','omission_basis']);

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

export function detectUnsupportedLanguage(input = {}) {
  const text = cleanText(input.sentence_text).toLowerCase();
  const warnings = [];
  const absolutePatterns = [/\bclearly\b/, /\bdefinitely\b/, /\bundisputed\b/, /\bconclusively\b/, /\bproves?\b/, /\bestablishes?\b/];
  const legalConclusionPatterns = [/\bis liable\b/, /\bcommitted fraud\b/, /\billegal\b/, /\bwill win\b/, /\bmust file\b/, /\bshould sue\b/];

  if ((input.dispute_status ?? 'unresolved') !== 'uncontested' && absolutePatterns.some((pattern) => pattern.test(text))) {
    warnings.push('dispute_or_uncertainty_flattened');
  }
  if ((input.uncertainty_status ?? 'unresolved') !== 'certain' && absolutePatterns.some((pattern) => pattern.test(text))) {
    warnings.push('uncertainty_hidden');
  }
  if (legalConclusionPatterns.some((pattern) => pattern.test(text))) warnings.push('legal_or_strategy_conclusion_not_allowed');
  if ((input.claim_type ?? 'factual_statement') === 'party_position' && !input.attribution_entity_id) warnings.push('party_position_missing_attribution');
  if ((input.omission_status ?? 'none') !== 'none' && !/(not located|not found|processing gap|scope)/.test(text)) warnings.push('omission_not_disclosed');
  return unique(warnings);
}

export function validateNarrativeSentence(input = {}) {
  const sentenceText = cleanText(input.sentence_text);
  if (!sentenceText) throw new Error('sentence_text is required');
  if (sentenceText.length > 2000) throw new Error('sentence_text is too long');

  const claimType = input.claim_type ?? 'factual_statement';
  const materiality = input.materiality ?? 'unrated';
  const disputeStatus = input.dispute_status ?? 'unresolved';
  const uncertaintyStatus = input.uncertainty_status ?? 'unresolved';
  const omissionStatus = input.omission_status ?? 'none';
  const creationMethod = input.creation_method ?? 'manual';
  if (!CLAIM_TYPES.has(claimType)) throw new Error('invalid claim_type');
  if (!MATERIALITIES.has(materiality)) throw new Error('invalid materiality');
  if (!DISPUTE_STATES.has(disputeStatus)) throw new Error('invalid dispute_status');
  if (!UNCERTAINTY_STATES.has(uncertaintyStatus)) throw new Error('invalid uncertainty_status');
  if (!OMISSION_STATES.has(omissionStatus)) throw new Error('invalid omission_status');
  if (!CREATION_METHODS.has(creationMethod)) throw new Error('invalid creation_method');

  const supportBindings = (input.support_bindings ?? []).map((binding) => {
    const objectType = cleanText(binding.object_type);
    const objectId = cleanText(binding.object_id);
    const sourceSpanId = cleanText(binding.source_span_id);
    const supportRole = binding.support_role ?? 'primary';
    if (!objectType || !objectId || !sourceSpanId) throw new Error('each support binding requires object_type, object_id, and source_span_id');
    if (!SUPPORT_ROLES.has(supportRole)) throw new Error('invalid support_role');
    return { object_type: objectType, object_id: objectId, source_span_id: sourceSpanId, support_role: supportRole };
  });

  const bindingKeys = supportBindings.map((binding) => `${binding.object_type}:${binding.object_id}:${binding.source_span_id}:${binding.support_role}`);
  if (new Set(bindingKeys).size !== bindingKeys.length) throw new Error('duplicate support binding');

  const warnings = detectUnsupportedLanguage({ ...input, sentence_text: sentenceText, claim_type: claimType, dispute_status: disputeStatus, uncertainty_status: uncertaintyStatus, omission_status: omissionStatus });
  if (supportBindings.length === 0) warnings.push('missing_structured_and_source_support');
  const material = ['critical','high'].includes(materiality);
  const blockingWarnings = warnings.filter((warning) => material || warning !== 'uncertainty_hidden');

  return {
    section_key: cleanText(input.section_key) || 'overview',
    position: Number.isInteger(input.position) && input.position >= 0 ? input.position : 0,
    sentence_text: sentenceText,
    claim_type: claimType,
    materiality,
    attribution_entity_id: input.attribution_entity_id ?? null,
    dispute_status: disputeStatus,
    uncertainty_status: uncertaintyStatus,
    omission_status: omissionStatus,
    creation_method: creationMethod,
    processing_version: cleanText(input.processing_version) || 'phase5a-v1',
    support_bindings: supportBindings,
    warnings: unique(warnings),
    support_status: supportBindings.length === 0 || blockingWarnings.length > 0 ? 'blocked' : warnings.length ? 'review_required' : 'supported',
  };
}

export function narrativeSentenceReadiness(sentence = {}) {
  const warnings = unique(sentence.warnings ?? []);
  const supportCount = Number(sentence.support_count ?? sentence.support_bindings?.length ?? 0);
  if (supportCount === 0 && !warnings.includes('missing_structured_and_source_support')) warnings.push('missing_structured_and_source_support');
  if (sentence.support_status === 'blocked' && warnings.length === 0) warnings.push('sentence_support_blocked');
  return {
    ready_for_review: supportCount > 0 && sentence.support_status !== 'blocked',
    ready_for_acceptance: supportCount > 0 && sentence.support_status === 'supported' && warnings.length === 0,
    support_count: supportCount,
    warnings,
  };
}

export function narrativeSupportSetReadiness(sentences = [], context = {}) {
  const warnings = [];
  if (!context.matrix_snapshot_attorney_approved) warnings.push('attorney_approved_matrix_required');
  if (!context.coverage_complete) warnings.push('processing_coverage_incomplete');
  if (!sentences.length) warnings.push('support_set_empty');
  const blocked = sentences.filter((sentence) => !narrativeSentenceReadiness(sentence).ready_for_review);
  const unreviewed = sentences.filter((sentence) => !['accepted','corrected'].includes(sentence.review_status));
  if (blocked.length) warnings.push('blocked_sentences_present');
  if (unreviewed.length) warnings.push('unreviewed_sentences_present');
  return {
    ready_for_overview: warnings.length === 0,
    sentence_count: sentences.length,
    blocked_sentence_count: blocked.length,
    unreviewed_sentence_count: unreviewed.length,
    production_use_allowed: false,
    warnings,
  };
}

export const narrativeSupportConstants = {
  claim_types: [...CLAIM_TYPES],
  materialities: [...MATERIALITIES],
  dispute_states: [...DISPUTE_STATES],
  uncertainty_states: [...UNCERTAINTY_STATES],
  omission_states: [...OMISSION_STATES],
  creation_methods: [...CREATION_METHODS],
  support_roles: [...SUPPORT_ROLES],
};
