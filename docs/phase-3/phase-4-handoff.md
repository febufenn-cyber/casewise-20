# Phase 4 handoff — Filing delta and matter memory

Phase 4 should make Casewise useful when a new filing or document version arrives. It must compare reviewed matter-graph versions rather than compare generated prose.

Required Phase 4 capabilities:

- identify new, removed, restated, narrowed, expanded, and amended allegations;
- identify changed admissions, denials, partial responses, and non-response coverage;
- identify changed dates, amounts, parties, roles, and referenced documents;
- identify newly linked, removed, or changed evidence relationships;
- identify new or resolved contradiction candidates and information gaps;
- preserve old and new source spans for every reported change;
- provide party-specific and document-specific delta views;
- route uncertain matches and material changes to human review;
- version and approve delta snapshots independently from matter-matrix snapshots;
- measure whether delta review is faster and safer than rebuilding the matter note manually.

Phase 4 must not:

- infer that a changed pleading establishes truth;
- silently overwrite earlier positions;
- treat copied language as independent corroboration;
- generate filing-ready responses;
- perform open-web legal research;
- contact clients, courts, tribunals, or opposing counsel.

Entry gates:

- Phase 3 matrix evaluation meets calibrated accuracy and review-time targets;
- Phase 1 production-security gates are satisfied;
- design partners provide permissible versioned matter packs;
- every delta object can reopen both prior and current source spans;
- correction and stale-propagation behaviour is tested across versions.
