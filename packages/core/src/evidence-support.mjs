const EVIDENCE_TYPES = new Set(['document','testimony','financial_record','correspondence','contract','order','physical_or_digital_record','other']);
const RELATIONSHIPS = new Set(['supports','contradicts','contextualizes','mentioned_by','relied_upon_for']);
const SUPPORT_STATUS = new Set(['unreviewed','source_verified','support_verified','partially_supported','unsupported','ambiguous']);
const TARGET_TYPES = new Set(['allegation','response','candidate_event']);

function normalize(value) {
  return String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
}

export function validateEvidenceItem(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('evidence item must be an object');
  const title = normalize(input.title);
  if (!title) throw new Error('evidence title is required');
  const evidence_type = input.evidence_type ?? 'other';
  if (!EVIDENCE_TYPES.has(evidence_type)) throw new Error('invalid evidence type');
  const source_span_ids = [...new Set((input.source_span_ids ?? []).filter(Boolean))];
  if (!source_span_ids.length) throw new Error('at least one evidence source span is required');
  return {
    title,
    description: normalize(input.description) || null,
    evidence_type,
    source_span_ids,
    logical_document_id: input.logical_document_id ?? null,
    offered_by_entity_id: input.offered_by_entity_id ?? null,
    creation_method: input.creation_method ?? 'manual',
    processing_version: input.processing_version ?? 'phase3-evidence-v1',
  };
}

export function validateSupportLink(input) {
  const target_type = input.target_type;
  if (!TARGET_TYPES.has(target_type)) throw new Error('invalid support target type');
  if (!input.target_id) throw new Error('support target id is required');
  const relationship = input.relationship ?? 'contextualizes';
  if (!RELATIONSHIPS.has(relationship)) throw new Error('invalid evidence relationship');
  const support_status = input.support_status ?? 'unreviewed';
  if (!SUPPORT_STATUS.has(support_status)) throw new Error('invalid support status');
  return {
    target_type,
    target_id: input.target_id,
    relationship,
    support_status,
    rationale: normalize(input.rationale) || null,
  };
}

export function supportWarnings(link) {
  const warnings = [];
  if (link.relationship === 'relied_upon_for' && link.support_status === 'unreviewed') warnings.push('citation_exists_but_support_not_verified');
  if (link.relationship === 'supports' && ['unsupported','ambiguous'].includes(link.support_status)) warnings.push('support_relationship_not_established');
  if (link.relationship === 'contradicts' && link.support_status !== 'support_verified') warnings.push('contradiction_requires_review');
  return warnings;
}

export function supportCoverage(links) {
  if (!links.length) return 'no_evidence_linked';
  if (links.some((link) => link.support_status === 'support_verified' && link.relationship === 'supports')) return 'supported';
  if (links.some((link) => link.support_status === 'partially_supported')) return 'partially_supported';
  if (links.every((link) => link.support_status === 'unsupported')) return 'unsupported';
  return 'review_required';
}
