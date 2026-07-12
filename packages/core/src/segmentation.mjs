const START_MARKERS = /^(annexure|exhibit|affidavit|petition|plaint|written statement|statement of claim|statement of defence|order|judgment|agreement|notice|invoice|index)\b/i;

export function boundaryScore(page, previous = null) {
  let score = 0;
  const reasons = [];
  if (page.bookmark_start) { score += 6; reasons.push('bookmark_start'); }
  if (page.cover_page) { score += 5; reasons.push('cover_page'); }
  if (page.filing_stamp && page.heading) { score += 3; reasons.push('filing_stamp_heading'); }
  if (page.heading && START_MARKERS.test(page.heading.trim())) { score += 4; reasons.push('document_heading'); }
  if (page.page_number_reset) { score += 3; reasons.push('page_number_reset'); }
  if (previous?.blank_or_separator) { score += 3; reasons.push('preceded_by_separator'); }
  if (page.dimension_change) { score += 2; reasons.push('dimension_change'); }
  if (page.font_profile_change) { score += 1; reasons.push('font_profile_change'); }
  if (page.case_header_change) { score += 2; reasons.push('case_header_change'); }
  return { score, reasons };
}

export function proposeBoundaries(pages, options = {}) {
  if (!Array.isArray(pages) || pages.length === 0) throw new Error('pages are required');
  const threshold = Number(options.threshold ?? 4);
  const sorted = [...pages].sort((a, b) => a.pdf_page_index - b.pdf_page_index);
  if (sorted[0].pdf_page_index !== 0) throw new Error('page sequence must start at index 0');
  const proposals = [{ pdf_page_index: 0, score: 100, reasons: ['file_start'], status: 'deterministic' }];
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].pdf_page_index !== sorted[i - 1].pdf_page_index + 1) throw new Error('page sequence must be contiguous');
    const result = boundaryScore(sorted[i], sorted[i - 1]);
    if (result.score >= threshold) proposals.push({ pdf_page_index: sorted[i].pdf_page_index, ...result, status: result.score >= 7 ? 'strongly_indicated' : 'probable' });
  }
  return proposals;
}

export function segmentsFromBoundaries(pageCount, boundaries) {
  if (!Number.isInteger(pageCount) || pageCount < 1) throw new Error('pageCount must be a positive integer');
  const starts = [...new Set(boundaries.map((item) => Number(item.pdf_page_index ?? item)))].sort((a, b) => a - b);
  if (starts[0] !== 0) starts.unshift(0);
  if (starts.some((value) => !Number.isInteger(value) || value < 0 || value >= pageCount)) throw new Error('boundary outside file');
  return starts.map((start, index) => ({
    start_pdf_page_index: start,
    end_pdf_page_index: (starts[index + 1] ?? pageCount) - 1,
    ordinal: index + 1,
  }));
}

export function validateSegments(pageCount, segments) {
  if (!Array.isArray(segments) || segments.length === 0) throw new Error('at least one segment is required');
  const sorted = [...segments].sort((a, b) => a.start_pdf_page_index - b.start_pdf_page_index);
  if (sorted[0].start_pdf_page_index !== 0) throw new Error('segments must begin at page index 0');
  for (let i = 0; i < sorted.length; i += 1) {
    const segment = sorted[i];
    if (!Number.isInteger(segment.start_pdf_page_index) || !Number.isInteger(segment.end_pdf_page_index)) throw new Error('segment page indexes must be integers');
    if (segment.start_pdf_page_index < 0 || segment.end_pdf_page_index < segment.start_pdf_page_index || segment.end_pdf_page_index >= pageCount) throw new Error('invalid segment range');
    if (i > 0 && segment.start_pdf_page_index !== sorted[i - 1].end_pdf_page_index + 1) throw new Error('segments must be contiguous without gaps or overlaps');
  }
  if (sorted.at(-1).end_pdf_page_index !== pageCount - 1) throw new Error('segments must cover the final page');
  return sorted.map((segment, index) => ({ ...segment, ordinal: index + 1 }));
}

export function classificationLabel(family, subtype) {
  if (!family || family === 'unknown') return 'Unknown document';
  const text = subtype && subtype !== 'unknown' ? subtype : family;
  return text.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function segmentationInvalidation(versionId) {
  return { source_type: 'segmentation_version', source_id: versionId, reason: 'active_segmentation_changed', new_status: 'stale' };
}
