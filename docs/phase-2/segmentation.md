# Segmentation contract

An uploaded PDF is a container, not a semantic document. Segmentation versions are immutable review snapshots. A new active version supersedes the old version and marks dependent artifacts stale.

Boundary proposals combine deterministic signals such as bookmarks, cover pages, filing stamps, heading markers, page-number resets, separator pages, dimension changes, and header changes. Proposals never become approved boundaries without an explicit activation action.

Segments must cover every page exactly once. Gaps, overlaps, hidden pages, and silent boundary mutation are prohibited.
