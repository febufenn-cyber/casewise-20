# Phase 5 approval, invalidation and internal-export contract

Phase 5 approvals attach to one exact matter-overview snapshot and one exact response-plan snapshot. They never transfer automatically to a corrected, regenerated or later artifact.

## Approval requirements

A matter manager may approve the paired artifacts only when:

- the overview is active and reviewer-accepted;
- the response plan is locked to that exact overview and matrix snapshot;
- every plan node is reviewed, source-bound and not blocked;
- the overview source-manifest fingerprint is present;
- source integrity and processing coverage are explicitly verified;
- no version mismatch or unresolved readiness warning remains.

Approval records store the artifact type, ID, version, readiness result, reviewer and rationale.

## Dependency and stale propagation

Dependency edges connect:

- narrative sentences and source spans to an overview snapshot;
- the overview snapshot to its response-plan snapshot;
- response-plan nodes and source spans to the plan snapshot.

A source or structured-object correction invalidates all matching downstream artifacts. Invalidation:

- marks the exact overview or plan snapshot stale;
- blocks and clears its attorney approval;
- invalidates any active internal export using it;
- records the initiating upstream object, reason, actor and affected targets.

Corrected work must create or re-review a new exact version.

## Internal export boundary

The Phase 5 export is a JSON manifest for internal attorney work product. It contains:

- the exact approved overview and response-plan versions;
- artifact locks and source-manifest fingerprint;
- source-bound overview sentences;
- source-bound planning nodes;
- an immutable manifest fingerprint;
- an explicit internal-only classification, watermark and disclaimer.

Every package is permanently constrained to:

- `classification = internal_only`;
- `filing_ready = false`;
- `production_use_allowed = false`.

Phase 5 does not create DOCX, PDF, pleading text, filing packages or external communications.
