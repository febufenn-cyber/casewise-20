# Phase 4 — Filing delta and matter memory

Phase 4 compares frozen, reviewed matter-graph versions when a new filing or document revision arrives. It does not compare generated prose and does not infer that a changed pleading establishes truth.

## In scope

1. Capture immutable filing versions from reviewed source-linked graph objects.
2. Propose exact, probable, ambiguous, new, and removed object matches across versions.
3. Classify changes such as new, removed, restated, narrowed, expanded, amended, changed response position, changed critical fact, changed evidence relationship, and opened or resolved gaps.
4. Preserve both prior and current source spans for every delta item.
5. Route uncertain matches and material changes to human review.
6. Version and approve delta snapshots independently from matter-matrix snapshots.
7. Promote approved deltas into an auditable matter-memory feed.
8. Measure precision, recall, material omissions, and review-time savings.

## Non-goals

- filing-ready drafting;
- outcome prediction;
- open-web legal research;
- autonomous client or court communications;
- silent overwrite of earlier positions;
- treating repeated language as independent corroboration.

## Phase 4A contract

A filing version is an immutable comparison unit containing reviewer-marked graph members and exact matter-scoped source spans. Draft versions may be recaptured. Activated versions cannot be silently replaced; a later filing creates a new version and preserves the prior version.

Activation is blocked when the version is empty, any member lacks a source span, or any member remains unreviewed.
