# Phase 5 — Reviewed matter overview and attorney-controlled response planning

Status: repository-only implementation in progress. Confidential production use remains blocked until the external entry gates below are independently satisfied.

## Objective

Create source-bound narrative and planning views only from attorney-approved structured artifacts. Generated prose is a versioned view over the matter graph, never the system of record and never an autonomous legal conclusion.

## Pre-build verification

- remote default branch: `main` — verified;
- prior implementation PRs open: none — verified;
- completed package version: `0.4.0` — verified;
- prior validator and exit review: Phase 4 present — verified;
- latest migration: `202607130020_delta_evaluations.sql` — verified;
- next migration: `202607140021_narrative_support.sql` — reserved;
- Phase 4 PR-head CI: green — verified;
- roadmap validator: present and green — verified.

## Entry-gate classification

| Gate | Classification | Consequence |
|---|---|---|
| Phase 4 repository implementation and CI are green | verified | Phase 5 repository work may proceed. |
| Phase 4 evaluation passes calibrated source-pair, omission, precision, recall and review-time gates | repository-only | Evaluation machinery exists, but no independent design-partner result is claimed. Production promotion remains blocked. |
| Phase 1 production-security gates are independently satisfied | blocked | No confidential production use or production deployment is authorized. |
| Every sentence decomposes into reviewed graph support | repository-only | Enforced by schemas, APIs and fixtures during Phase 5; real-matter evaluation remains required. |
| Stale propagation from source correction is tested | repository-only | Implemented and tested in Phase 5D; external deployment verification remains required. |
| Practitioners approve terminology and workflow | blocked | Labels and workflow remain provisional until practitioner review. |

## Five increments

1. **5A — Narrative support graph:** sentence-level objects, structured-object and exact-source bindings, unsupported-language blockers.
2. **5B — Reviewed matter overview snapshots:** version-locked sections, source reopening, dispute and uncertainty preservation.
3. **5C — Response-planning workspace:** allegation-row plans and source-bound factual, evidence, client-question, contradiction and research nodes.
4. **5D — Approval, invalidation and controlled internal export:** exact-version approval, dependency invalidation, internal-only manifests and audit lineage.
5. **5E — Evaluation and exit:** citation fidelity, unsupported-language rate, support coverage, correction severity, time saved, validator, version bump and Phase 6 handoff.

## Product invariants

- a material sentence without both structured-object support and an exact source span is blocked;
- a party position must remain attributed;
- contested, ambiguous, inferred and missing-within-scope states must remain visible;
- legal or strategy conclusions are not generated in Phase 5;
- approval applies only to one exact artifact version;
- upstream corrections make dependent narrative and planning artifacts stale;
- repository completion does not authorize confidential production use.

## Non-goals

- filing-ready pleadings or submissions;
- autonomous legal advice;
- external legal-authority research;
- outcome prediction;
- public-facing answers from confidential matter content;
- autonomous communication with clients, courts, tribunals, witnesses or opposing counsel.
