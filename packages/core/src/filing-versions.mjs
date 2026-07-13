const FILING_KINDS = new Set([
  'initial_filing',
  'amended_filing',
  'response_filing',
  'evidence_production',
  'order',
  'document_revision',
  'other',
]);

const OBJECT_TYPES = new Set([
  'allegation',
  'response',
  'event_assertion',
  'candidate_event',
  'evidence_item',
  'contradiction_candidate',
  'missing_information',
  'date_mention',
  'amount_mention',
  'document_reference',
  'entity',
]);

const REVIEWED = new Set([
  'accepted',
  'corrected',
  'confirmed',
  'resolved',
  'attorney_approved',
]);

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function validateFilingVersion(input = {}) {
  const filingKind = input.filing_kind ?? 'other';
  if (!FILING_KINDS.has(filingKind)) throw new Error('invalid filing kind');
  const label = cleanText(input.label);
  if (!label) throw new Error('filing version label is required');
  if (label.length > 240) throw new Error('filing version label is too long');
  const parentVersionId = input.parent_version_id ?? null;
  if (parentVersionId && typeof parentVersionId !== 'string') throw new Error('invalid parent version');
  return {
    label,
    filing_kind: filingKind,
    parent_version_id: parentVersionId,
    uploaded_file_id: input.uploaded_file_id ?? null,
    logical_document_id: input.logical_document_id ?? null,
    matrix_snapshot_id: input.matrix_snapshot_id ?? null,
    effective_at: input.effective_at ?? null,
    notes: cleanText(input.notes) || null,
  };
}

export function fingerprintGraphMember(member) {
  if (!OBJECT_TYPES.has(member.object_type)) throw new Error('invalid graph member type');
  if (!member.object_id) throw new Error('graph member object id is required');
  const payload = stableValue(member.payload ?? {});
  return hashString(JSON.stringify({ object_type: member.object_type, payload }));
}

export function snapshotGraphMembers(objects = []) {
  if (!Array.isArray(objects) || objects.length === 0) throw new Error('at least one graph member is required');
  const seen = new Set();
  return objects.map((item) => {
    if (!OBJECT_TYPES.has(item.object_type)) throw new Error('invalid graph member type');
    if (!item.object_id) throw new Error('graph member object id is required');
    const key = `${item.object_type}:${item.object_id}`;
    if (seen.has(key)) throw new Error(`duplicate graph member: ${key}`);
    seen.add(key);
    const sourceSpanIds = [...new Set(item.source_span_ids ?? [])].sort();
    if (sourceSpanIds.length === 0) throw new Error(`source spans are required for ${key}`);
    const reviewStatus = item.review_status ?? 'unreviewed';
    const warnings = [];
    if (!REVIEWED.has(reviewStatus)) warnings.push('member_not_reviewed');
    const member = {
      object_type: item.object_type,
      object_id: item.object_id,
      logical_document_id: item.logical_document_id ?? null,
      party_entity_ids: [...new Set(item.party_entity_ids ?? [])].sort(),
      source_span_ids: sourceSpanIds,
      payload: stableValue(item.payload ?? {}),
      review_status: reviewStatus,
      warnings,
    };
    return { ...member, object_fingerprint: fingerprintGraphMember(member) };
  });
}

export function filingVersionReadiness(members = []) {
  const warnings = [];
  if (!members.length) warnings.push('filing_version_empty');
  const unreviewed = members.filter((member) => !REVIEWED.has(member.review_status));
  const withoutSources = members.filter((member) => !(member.source_span_ids ?? []).length);
  if (unreviewed.length) warnings.push('unreviewed_graph_members');
  if (withoutSources.length) warnings.push('graph_members_without_sources');
  return {
    ready: warnings.length === 0,
    member_count: members.length,
    unreviewed_count: unreviewed.length,
    missing_source_count: withoutSources.length,
    warnings,
  };
}

export const filingVersionConstants = {
  filing_kinds: [...FILING_KINDS],
  object_types: [...OBJECT_TYPES],
  reviewed_statuses: [...REVIEWED],
};
