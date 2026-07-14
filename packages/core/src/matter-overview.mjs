function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
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

export function validateOverviewSections(inputs = []) {
  if (!Array.isArray(inputs) || inputs.length === 0) throw new Error('at least one overview section is required');
  const sectionKeys = new Set();
  const usedSentenceIds = new Set();
  return inputs.map((input, index) => {
    const sectionKey = cleanText(input.section_key) || `section-${index + 1}`;
    const title = cleanText(input.title);
    if (!title) throw new Error(`title is required for section ${sectionKey}`);
    if (sectionKeys.has(sectionKey)) throw new Error(`duplicate overview section key: ${sectionKey}`);
    sectionKeys.add(sectionKey);
    const sentenceIds = unique(input.sentence_ids ?? []);
    if (!sentenceIds.length) throw new Error(`section ${sectionKey} requires at least one sentence`);
    for (const sentenceId of sentenceIds) {
      if (usedSentenceIds.has(sentenceId)) throw new Error(`sentence appears in multiple overview sections: ${sentenceId}`);
      usedSentenceIds.add(sentenceId);
    }
    return {
      section_key: sectionKey,
      title,
      position: Number.isInteger(input.position) && input.position >= 0 ? input.position : index,
      sentence_ids: sentenceIds,
    };
  }).sort((a, b) => a.position - b.position || a.section_key.localeCompare(b.section_key));
}

export function overviewReadiness(sections = [], sentences = [], context = {}) {
  const warnings = [];
  if (!context.support_set_ready) warnings.push('narrative_support_set_not_ready');
  if (!context.artifact_locks_complete) warnings.push('artifact_locks_incomplete');
  if (!sections.length) warnings.push('overview_sections_missing');
  const byId = new Map(sentences.map((sentence) => [sentence.id, sentence]));
  const requestedIds = unique(sections.flatMap((section) => section.sentence_ids ?? []));
  const missingIds = requestedIds.filter((id) => !byId.has(id));
  if (missingIds.length) warnings.push('overview_sentences_missing');
  const selected = requestedIds.map((id) => byId.get(id)).filter(Boolean);
  const unreviewed = selected.filter((sentence) => !['accepted','corrected'].includes(sentence.review_status));
  const blocked = selected.filter((sentence) => sentence.support_status !== 'supported' || (sentence.warnings ?? []).length > 0);
  const withoutSources = selected.filter((sentence) => Number(sentence.support_count ?? 0) === 0);
  if (unreviewed.length) warnings.push('overview_contains_unreviewed_sentences');
  if (blocked.length) warnings.push('overview_contains_blocked_sentences');
  if (withoutSources.length) warnings.push('overview_sentence_source_missing');
  return {
    ready_for_review: warnings.length === 0,
    section_count: sections.length,
    sentence_count: selected.length,
    missing_sentence_count: missingIds.length,
    unreviewed_sentence_count: unreviewed.length,
    blocked_sentence_count: blocked.length,
    missing_source_count: withoutSources.length,
    warnings,
  };
}

export function buildOverviewSourceManifest(snapshot = {}, sections = [], sentences = [], supports = []) {
  const sentenceById = new Map(sentences.map((sentence) => [sentence.id, sentence]));
  const supportsBySentence = new Map();
  for (const support of supports) {
    const values = supportsBySentence.get(support.sentence_id) ?? [];
    values.push({ object_type: support.object_type, object_id: support.object_id, source_span_id: support.source_span_id, support_role: support.support_role });
    supportsBySentence.set(support.sentence_id, values);
  }
  const entries = [];
  for (const section of sections) {
    for (const sentenceId of section.sentence_ids ?? []) {
      const sentence = sentenceById.get(sentenceId);
      if (!sentence) continue;
      entries.push({
        section_key: section.section_key,
        section_title: section.title,
        sentence_id: sentenceId,
        sentence_text: sentence.sentence_text,
        materiality: sentence.materiality,
        attribution_entity_id: sentence.attribution_entity_id ?? null,
        dispute_status: sentence.dispute_status,
        uncertainty_status: sentence.uncertainty_status,
        omission_status: sentence.omission_status,
        supports: (supportsBySentence.get(sentenceId) ?? []).sort((a, b) => a.source_span_id.localeCompare(b.source_span_id)),
      });
    }
  }
  const canonical = stableValue({ snapshot_id: snapshot.id ?? null, support_set_id: snapshot.support_set_id ?? null, artifact_locks: snapshot.artifact_locks ?? {}, entries });
  return { entries, manifest_fingerprint: hashString(JSON.stringify(canonical)) };
}

export function overviewSummary(sections = [], sentences = []) {
  return {
    section_count: sections.length,
    sentence_count: sentences.length,
    contested_sentence_count: sentences.filter((sentence) => sentence.dispute_status === 'contested').length,
    uncertain_sentence_count: sentences.filter((sentence) => sentence.uncertainty_status !== 'certain').length,
    omission_sentence_count: sentences.filter((sentence) => sentence.omission_status !== 'none').length,
    high_materiality_sentence_count: sentences.filter((sentence) => ['critical','high'].includes(sentence.materiality)).length,
  };
}
