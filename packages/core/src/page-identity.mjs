export function canonicalPageKey(uploadedFileId, pdfPageIndex) {
  if (!uploadedFileId) throw new Error("uploadedFileId is required");
  if (!Number.isInteger(pdfPageIndex) || pdfPageIndex < 0) throw new Error("pdfPageIndex must be a non-negative integer");
  return `${uploadedFileId}:${pdfPageIndex}`;
}
export function normalizePolygon(points) {
  if (!Array.isArray(points) || points.length < 3) throw new Error("polygon needs at least three points");
  return points.map((point) => {
    if (!Array.isArray(point) || point.length !== 2) throw new Error("invalid polygon point");
    const [x, y] = point;
    if (![x, y].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) throw new Error("normalized coordinates must be between 0 and 1");
    return [x, y];
  });
}
export function pageDisplayLabel(page) {
  const labels = [`PDF page ${page.pdf_page_index + 1}`];
  if (page.printed_page_label) labels.push(`Printed page ${page.printed_page_label}`);
  if (page.logical_document_page) labels.push(`Document page ${page.logical_document_page}`);
  return labels.join(" · ");
}
