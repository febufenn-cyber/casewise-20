# Phase 1 Handoff Contract

This document is a handoff, not authorization. Phase 1 begins only after the open gates in `decision-gates.md` are reviewed.

## Phase 1 objective

Build secure ingestion and provenance infrastructure capable of proving what was processed, where every extracted span came from, who can access it, and what failed.

## Required capabilities

- organization, matter, membership, and role model;
- strict matter-scoped authorization;
- signed upload and download paths;
- immutable original files with SHA-256 identity;
- validation and safe handling for supported PDFs;
- parser/OCR isolation and resource limits;
- asynchronous, idempotent processing jobs;
- normalized PDF and page-image derivation;
- native text and OCR extraction with method and quality metadata;
- explicit PDF-page, printed-page, logical-document, and source-span identity;
- coverage ledger for processed, failed, unsupported, unreadable, excluded, and duplicate content;
- source viewer that opens the correct original page and highlight;
- metadata-only ordinary logs;
- audit events for upload, access, processing, deletion, approval, and export;
- deletion propagation design;
- automated cross-organization and cross-matter isolation tests;
- prompt-injection fixtures proving document text cannot alter permissions or tools.

## Non-goals

Phase 1 does not require:

- a prose summary;
- issue extraction;
- allegation-response analysis;
- contradiction detection;
- legal research;
- response drafting;
- billing;
- regional-language support.

## Required design artifacts

Before implementation:

- architecture decision record;
- data model and RLS policy design;
- job authorization envelope;
- page-identity model;
- parser/OCR threat controls;
- provider data-flow diagram;
- retention and deletion sequence;
- evaluation fixtures and acceptance tests;
- observability and incident baseline.

## Acceptance test examples

1. A user authorized for Matter A cannot read, search, cite, export, or trigger processing for Matter B.
2. A service-role worker rejects a job whose authorization envelope does not match the stored matter.
3. Every extracted span reopens the exact original page.
4. Printed page labels can be wrong or duplicated without corrupting internal page identity.
5. A mixed bundle may show partial success while clearly listing failed pages.
6. A malicious document instruction cannot invoke a tool or access another matter.
7. Deleting a test matter invalidates access and queues every derived artifact for removal.
8. Ordinary logs do not contain source passages or sensitive document bodies.
9. Reprocessing does not duplicate objects or lose the original hash.
10. Changing a source or segmentation version marks dependent artifacts stale.

## Exit condition

Phase 1 exits only when ingestion and provenance are independently trustworthy enough to support Phase 2. A compelling summary demo cannot compensate for a failed authorization, page-identity, coverage, or deletion gate.
