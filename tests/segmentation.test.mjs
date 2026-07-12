import test from 'node:test';
import assert from 'node:assert/strict';
import { classificationLabel, proposeBoundaries, segmentsFromBoundaries, validateSegments } from '../packages/core/src/segmentation.mjs';

test('proposes deterministic and evidence-based boundaries', () => {
  const pages = [
    { pdf_page_index: 0, heading: 'INDEX' },
    { pdf_page_index: 1 },
    { pdf_page_index: 2, blank_or_separator: true },
    { pdf_page_index: 3, heading: 'AFFIDAVIT OF R. KUMAR', page_number_reset: true },
    { pdf_page_index: 4 },
  ];
  const proposals = proposeBoundaries(pages);
  assert.deepEqual(proposals.map((item) => item.pdf_page_index), [0, 3]);
  assert.ok(proposals[1].reasons.includes('document_heading'));
});

test('creates complete non-overlapping segments', () => {
  assert.deepEqual(segmentsFromBoundaries(8, [{ pdf_page_index: 0 }, { pdf_page_index: 3 }, { pdf_page_index: 6 }]), [
    { start_pdf_page_index: 0, end_pdf_page_index: 2, ordinal: 1 },
    { start_pdf_page_index: 3, end_pdf_page_index: 5, ordinal: 2 },
    { start_pdf_page_index: 6, end_pdf_page_index: 7, ordinal: 3 },
  ]);
});

test('rejects gaps and overlaps', () => {
  assert.throws(() => validateSegments(4, [
    { start_pdf_page_index: 0, end_pdf_page_index: 1 },
    { start_pdf_page_index: 3, end_pdf_page_index: 3 },
  ]), /contiguous/);
});

test('formats conservative classification labels', () => {
  assert.equal(classificationLabel('pleading', 'written_statement'), 'Written Statement');
  assert.equal(classificationLabel('unknown', 'unknown'), 'Unknown document');
});
