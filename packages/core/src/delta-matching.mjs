function textFrom(value, output = []) {
  if (value == null) return output;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    output.push(String(value));
    return output;
  }
  if (Array.isArray(value)) {
    for (const item of value) textFrom(item, output);
    return output;
  }
  if (typeof value === 'object') {
    for (const key of Object.keys(value).sort()) {
      if (['id','organization_id','matter_id','created_at','updated_at','created_by','processing_version'].includes(key)) continue;
      textFrom(value[key], output);
    }
  }
  return output;
}

function tokens(member) {
  return new Set(textFrom(member.payload ?? {}).join(' ').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/).filter((token) => token.length > 1));
}

function overlapScore(left, right) {
  if (!left.size && !right.size) return 1;
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
}

function arrayOverlap(left = [], right = []) {
  const a = new Set(left);
  const b = new Set(right);
  if (!a.size && !b.size) return 0;
  return [...a].filter((value) => b.has(value)).length / Math.max(a.size, b.size, 1);
}

export function scoreVersionMembers(prior, current) {
  if (prior.object_type !== current.object_type) return { score: 0, features: { object_type_match: false } };
  const fingerprintMatch = prior.object_fingerprint === current.object_fingerprint;
  const sameObjectId = prior.object_id === current.object_id;
  const tokenSimilarity = overlapScore(tokens(prior), tokens(current));
  const partySimilarity = arrayOverlap(prior.party_entity_ids, current.party_entity_ids);
  const documentMatch = Boolean(prior.logical_document_id && current.logical_document_id && prior.logical_document_id === current.logical_document_id);
  const score = fingerprintMatch
    ? 1
    : Math.min(0.99, (sameObjectId ? 0.32 : 0) + tokenSimilarity * 0.5 + partySimilarity * 0.12 + (documentMatch ? 0.06 : 0));
  return {
    score: Number(score.toFixed(4)),
    features: {
      object_type_match: true,
      fingerprint_match: fingerprintMatch,
      same_object_id: sameObjectId,
      token_similarity: Number(tokenSimilarity.toFixed(4)),
      party_similarity: Number(partySimilarity.toFixed(4)),
      logical_document_match: documentMatch,
    },
  };
}

export function validateVersionPair(priorVersion, currentVersion) {
  if (!priorVersion?.id || !currentVersion?.id) throw new Error('both filing versions are required');
  if (priorVersion.id === currentVersion.id) throw new Error('filing versions must differ');
  if (priorVersion.matter_id && currentVersion.matter_id && priorVersion.matter_id !== currentVersion.matter_id) throw new Error('filing versions must belong to the same matter');
  if (Number(priorVersion.version_number ?? 0) >= Number(currentVersion.version_number ?? 0)) throw new Error('current filing version must be newer than prior filing version');
  return true;
}

export function matchFilingVersionMembers(priorMembers = [], currentMembers = [], options = {}) {
  const probableThreshold = Number(options.probable_threshold ?? 0.72);
  const ambiguousThreshold = Number(options.ambiguous_threshold ?? 0.45);
  const ambiguityMargin = Number(options.ambiguity_margin ?? 0.06);
  const availablePrior = new Set(priorMembers.map((member) => member.id));
  const results = [];

  for (const current of currentMembers) {
    const candidates = priorMembers
      .filter((prior) => availablePrior.has(prior.id) && prior.object_type === current.object_type)
      .map((prior) => ({ prior, ...scoreVersionMembers(prior, current) }))
      .sort((left, right) => right.score - left.score || String(left.prior.id).localeCompare(String(right.prior.id)));

    const best = candidates[0];
    const second = candidates[1];
    if (!best || best.score < ambiguousThreshold) {
      results.push({ object_type: current.object_type, prior_member_id: null, current_member_id: current.id, match_status: 'new', similarity_score: best?.score ?? 0, features: best?.features ?? {} });
      continue;
    }

    const closeCompetition = Boolean(second && best.score - second.score <= ambiguityMargin && second.score >= ambiguousThreshold);
    const exact = best.features.fingerprint_match === true;
    const matchStatus = exact ? 'exact' : closeCompetition || best.score < probableThreshold ? 'ambiguous' : 'probable';
    results.push({
      object_type: current.object_type,
      prior_member_id: best.prior.id,
      current_member_id: current.id,
      match_status: matchStatus,
      similarity_score: best.score,
      features: { ...best.features, competing_candidate_count: candidates.filter((item) => best.score - item.score <= ambiguityMargin).length },
    });
    if (matchStatus !== 'ambiguous') availablePrior.delete(best.prior.id);
  }

  for (const prior of priorMembers) {
    if (!availablePrior.has(prior.id)) continue;
    const usedAsAmbiguous = results.some((result) => result.match_status === 'ambiguous' && result.prior_member_id === prior.id);
    if (!usedAsAmbiguous) results.push({ object_type: prior.object_type, prior_member_id: prior.id, current_member_id: null, match_status: 'removed', similarity_score: 0, features: {} });
  }

  return results;
}

export function matchRunReadiness(matches = []) {
  const ambiguous = matches.filter((match) => match.match_status === 'ambiguous');
  const unresolved = matches.filter((match) => ['unreviewed','unresolved'].includes(match.review_status ?? 'unreviewed') && match.match_status === 'ambiguous');
  return {
    ready: unresolved.length === 0,
    match_count: matches.length,
    exact_count: matches.filter((match) => match.match_status === 'exact').length,
    probable_count: matches.filter((match) => match.match_status === 'probable').length,
    ambiguous_count: ambiguous.length,
    new_count: matches.filter((match) => match.match_status === 'new').length,
    removed_count: matches.filter((match) => match.match_status === 'removed').length,
    unresolved_ambiguous_count: unresolved.length,
  };
}
