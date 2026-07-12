export const COVERAGE_STATUSES = Object.freeze(["processed","processed_with_warning","failed","unreadable","unsupported","excluded_by_user","duplicate","quarantined","not_attempted","cancelled","deleted","stale"]);
const statusSet = new Set(COVERAGE_STATUSES);
export function summarizeCoverage(entries) {
  const counts = Object.fromEntries(COVERAGE_STATUSES.map((status) => [status, 0]));
  for (const entry of entries) { if (!statusSet.has(entry.status)) throw new Error(`unknown coverage status: ${entry.status}`); counts[entry.status] += 1; }
  const unresolved = counts.failed + counts.unreadable + counts.unsupported + counts.quarantined + counts.not_attempted;
  const warning = counts.processed_with_warning + counts.stale;
  return { total: entries.length, counts, unresolved, overall: unresolved > 0 ? "partial_success" : warning > 0 ? "complete_with_warnings" : "complete" };
}
export function canRepresentAsComplete(summary) { return summary.overall === "complete" && summary.unresolved === 0; }
