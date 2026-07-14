# Phase 6 handoff — Verified legal authority research

Phase 6 must build a separate authority-research system. External legal authorities must never be silently mixed with confidential matter evidence or represented as verified merely because a model produced a citation.

## Entry-gate classification expected at build time

- Phase 5 repository implementation and CI: verifiable from `main`;
- Phase 5 real-matter evaluation gates: external evidence required;
- approved authority sources and licences: external legal/commercial approval required;
- provider retention, privacy, regional and subprocessor terms: external approval required;
- live provider credentials: secret required for live use;
- provider-neutral repository fixtures: permitted while live production remains blocked.

## Required capabilities

### 6A — Source registry and query contract

- allowlisted source/provider records;
- jurisdiction, court, date, authority type, availability and licence metadata;
- retention and permitted-use policy;
- provider-neutral query sessions and adapters;
- a hard production block for unapproved providers.

### 6B — Immutable authority ingestion

- authoritative locator or permissible source copy;
- retrieval timestamp and immutable hash;
- page, paragraph, quotation and citation identity;
- coverage and failure ledger;
- withdrawn, superseded, unavailable and deleted states.

### 6C — Proposition-authority mapping

- supports, distinguishes, contradicts, contextualizes and procedural-only relationships;
- exact quotation spans;
- jurisdictional and temporal applicability;
- treatment and status warnings;
- attorney review and correction lineage.

### 6D — Research workspace

- research-question queues;
- filters and authority comparison;
- visibly separate matter-evidence and legal-authority panels;
- source-linked internal research notes;
- exact-version research snapshots and attorney approval.

### 6E — Evaluation and exit

- authority existence and citation accuracy;
- quotation fidelity;
- jurisdiction, court, date and treatment accuracy;
- proposition-support classification;
- fabricated-authority zero-tolerance gate;
- reviewer corrections and time savings;
- Phase 6 validator, version `0.6.0`, exit review and Phase 7 handoff.

## Non-goals

- autonomous legal advice;
- outcome prediction;
- unverified open-web citations;
- filing-ready drafting;
- automatic filing or external communication;
- cross-customer confidential retrieval.

## Product invariants

- every authority citation opens the exact verified source location;
- matter evidence and authority stores remain logically, permissionally and visibly separate;
- a provider or source absent from the approved registry cannot be used for production research;
- quotations, courts, dates, identifiers and treatments are never inferred when not verified;
- material research conclusions require attorney review;
- correcting or withdrawing an authority makes every dependent research artifact stale.
