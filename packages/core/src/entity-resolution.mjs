const HONORIFICS = /\b(m\/s\.?|mr\.?|mrs\.?|ms\.?|dr\.?|shri|smt\.?|adv\.?|learned)\b/gi;
const COMPANY_SUFFIXES = new Map([
  ['pvt ltd', 'private limited'], ['pvt. ltd.', 'private limited'], ['p limited', 'private limited'],
  ['ltd', 'limited'], ['llp', 'llp'], ['co', 'company'], ['corp', 'corporation'],
]);

export function normalizeObservedName(value) {
  let text = String(value ?? '').normalize('NFKC').toLowerCase().replace(HONORIFICS, ' ');
  text = text.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  for (const [suffix, replacement] of COMPANY_SUFFIXES) {
    if (text.endsWith(` ${suffix}`) || text === suffix) text = `${text.slice(0, -suffix.length).trim()} ${replacement}`.trim();
  }
  return text;
}

function tokenSet(value) { return new Set(normalizeObservedName(value).split(' ').filter(Boolean)); }
function jaccard(left, right) {
  const a = tokenSet(left); const b = tokenSet(right);
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return intersection / new Set([...a, ...b]).size;
}

export function matchCandidate(left, right) {
  if (!left || !right) throw new Error('two mentions are required');
  const reasons = [];
  if (left.entity_type && right.entity_type && left.entity_type !== right.entity_type) return { score: 0, decision: 'blocked', reasons: ['entity_type_conflict'] };
  const normalizedLeft = normalizeObservedName(left.raw_text ?? left.display_name);
  const normalizedRight = normalizeObservedName(right.raw_text ?? right.display_name);
  let score = normalizedLeft === normalizedRight ? 0.92 : jaccard(normalizedLeft, normalizedRight) * 0.78;
  if (normalizedLeft === normalizedRight) reasons.push('normalized_name_exact'); else if (score >= 0.55) reasons.push('name_token_overlap');
  const leftIds = left.identifiers ?? {}; const rightIds = right.identifiers ?? {};
  for (const key of new Set([...Object.keys(leftIds), ...Object.keys(rightIds)])) {
    if (leftIds[key] && rightIds[key] && leftIds[key] !== rightIds[key]) return { score: 0, decision: 'blocked', reasons: [`identifier_conflict:${key}`] };
    if (leftIds[key] && leftIds[key] === rightIds[key]) { score = Math.max(score, 0.99); reasons.push(`identifier_match:${key}`); }
  }
  if (left.address && right.address && normalizeObservedName(left.address) === normalizeObservedName(right.address)) { score += 0.04; reasons.push('address_match'); }
  score = Math.min(score, 0.99);
  return { score, decision: score >= 0.9 ? 'strong_candidate' : score >= 0.65 ? 'review_candidate' : 'insufficient', reasons };
}

export function proposeEntityMatches(mentions) {
  const proposals = [];
  for (let i = 0; i < mentions.length; i += 1) {
    for (let j = i + 1; j < mentions.length; j += 1) {
      const result = matchCandidate(mentions[i], mentions[j]);
      if (result.decision !== 'insufficient') proposals.push({ left_id: mentions[i].id, right_id: mentions[j].id, ...result });
    }
  }
  return proposals.sort((a, b) => b.score - a.score);
}

export function mergeSnapshot(targetEntityId, sourceEntities, mentions) {
  if (!targetEntityId || !Array.isArray(sourceEntities) || sourceEntities.length === 0) throw new Error('target and source entities are required');
  if (sourceEntities.some((entity) => entity.id === targetEntityId)) throw new Error('target cannot be a source entity');
  return {
    target_entity_id: targetEntityId,
    source_entities: sourceEntities.map((entity) => ({ id: entity.id, status: entity.status, display_name: entity.display_name })),
    mention_assignments: mentions.filter((mention) => sourceEntities.some((entity) => entity.id === mention.entity_id)).map((mention) => ({ mention_id: mention.id, previous_entity_id: mention.entity_id })),
  };
}

export function roleKey(role) {
  return [role.entity_id, role.role_type, role.proceeding_context ?? '', role.valid_from ?? '', role.valid_to ?? ''].join('|');
}
