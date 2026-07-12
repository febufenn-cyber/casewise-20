const MONTHS = new Map(Object.entries({ january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12,jan:1,feb:2,mar:3,apr:4,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12 }));
const pad = (value) => String(value).padStart(2, '0');

export function parseDateMention(raw, options = {}) {
  const text = String(raw ?? '').trim();
  const lower = text.toLowerCase();
  const certainty = /on or about|approximately|around/.test(lower) ? 'approximate' : /before|after|between|within/.test(lower) ? 'relative_or_range' : 'stated';
  let match = lower.match(/\b(\d{1,2})[\s-]+([a-z]{3,9})[\s,-]+(\d{4})\b/);
  if (match && MONTHS.has(match[2])) return { raw_text: text, normalized_start: `${match[3]}-${pad(MONTHS.get(match[2]))}-${pad(match[1])}`, normalized_end: `${match[3]}-${pad(MONTHS.get(match[2]))}-${pad(match[1])}`, precision: 'day', certainty, ambiguity: [] };
  match = lower.match(/\b([a-z]{3,9})[\s,-]+(\d{4})\b/);
  if (match && MONTHS.has(match[1])) {
    const month = MONTHS.get(match[1]); const end = new Date(Date.UTC(Number(match[2]), month, 0)).getUTCDate();
    return { raw_text: text, normalized_start: `${match[2]}-${pad(month)}-01`, normalized_end: `${match[2]}-${pad(month)}-${pad(end)}`, precision: 'month', certainty, ambiguity: [] };
  }
  match = lower.match(/\b(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})\b/);
  if (match) {
    const first = Number(match[1]); const second = Number(match[2]); const year = match[3];
    const dmy = first <= 31 && second <= 12 ? `${year}-${pad(second)}-${pad(first)}` : null;
    const mdy = first <= 12 && second <= 31 ? `${year}-${pad(first)}-${pad(second)}` : null;
    const interpretations = [...new Set([dmy, mdy].filter(Boolean))];
    if (interpretations.length === 1 || options.locale === 'en-IN') return { raw_text: text, normalized_start: interpretations[0], normalized_end: interpretations[0], precision: 'day', certainty, ambiguity: interpretations.length > 1 ? interpretations : [] };
    return { raw_text: text, normalized_start: null, normalized_end: null, precision: 'day', certainty: 'ambiguous', ambiguity: interpretations };
  }
  match = lower.match(/\b(19|20)\d{2}\b/);
  if (match) return { raw_text: text, normalized_start: `${match[0]}-01-01`, normalized_end: `${match[0]}-12-31`, precision: 'year', certainty, ambiguity: [] };
  return { raw_text: text, normalized_start: null, normalized_end: null, precision: 'unknown', certainty: 'unresolved', ambiguity: [] };
}

export function parseIndianAmount(raw, defaultCurrency = 'INR') {
  const text = String(raw ?? '').trim(); const lower = text.toLowerCase().replaceAll(',', '');
  const currency = /\$|usd/.test(lower) ? 'USD' : /€|eur/.test(lower) ? 'EUR' : /£|gbp/.test(lower) ? 'GBP' : /₹|rs\.?|inr/.test(lower) ? 'INR' : defaultCurrency;
  const match = lower.match(/-?\d+(?:\.\d+)?/);
  if (!match) return { raw_text: text, currency, normalized_value: null, scale: 'unknown', status: 'unresolved' };
  let value = Number(match[0]); let scale = 'units';
  if (/crores?|\bcr\b/.test(lower)) { value *= 10_000_000; scale = 'crore'; }
  else if (/lakhs?|\blacs?\b|\blakh\b/.test(lower)) { value *= 100_000; scale = 'lakh'; }
  else if (/millions?|\bmn\b/.test(lower)) { value *= 1_000_000; scale = 'million'; }
  else if (/thousands?|\bk\b/.test(lower)) { value *= 1_000; scale = 'thousand'; }
  return { raw_text: text, currency, normalized_value: value.toFixed(2), scale, status: 'parsed' };
}

export function compareAmountRepresentations(digits, words) {
  const left = parseIndianAmount(digits); const right = parseIndianAmount(words);
  if (!left.normalized_value || !right.normalized_value) return { status: 'unresolved', values: [left.normalized_value, right.normalized_value] };
  return { status: left.currency === right.currency && left.normalized_value === right.normalized_value ? 'consistent' : 'conflict', values: [left.normalized_value, right.normalized_value], currencies: [left.currency, right.currency] };
}

export function parseDocumentReference(raw) {
  const text = String(raw ?? '').trim();
  const annexure = text.match(/\b(annexure|exhibit)\s*[-:]?\s*([a-z]+[-\/]?\d+[a-z]?|\d+[a-z]?)\b/i);
  if (annexure) return { raw_reference: text, reference_type: annexure[1].toLowerCase(), expected_label: annexure[2].toUpperCase(), resolution_status: 'not_reviewed' };
  const dated = text.match(/\b(agreement|letter|notice|invoice|order)\s+(?:dated\s+)?(.+)$/i);
  if (dated) return { raw_reference: text, reference_type: dated[1].toLowerCase(), expected_label: null, date_text: dated[2].trim(), resolution_status: 'not_reviewed' };
  return { raw_reference: text, reference_type: 'unknown', expected_label: null, resolution_status: 'not_reviewed' };
}

export function referenceResolution(reference, candidates) {
  const matches = candidates.filter((candidate) => reference.expected_label && candidate.annexure_label?.toUpperCase() === reference.expected_label.toUpperCase());
  if (matches.length === 1) return { status: 'resolved', resolved_document_id: matches[0].id, candidate_document_ids: [matches[0].id] };
  if (matches.length > 1) return { status: 'duplicate_candidates', resolved_document_id: null, candidate_document_ids: matches.map((item) => item.id) };
  return { status: 'referenced_but_absent', resolved_document_id: null, candidate_document_ids: [] };
}
