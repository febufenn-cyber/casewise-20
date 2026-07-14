# Casewise remaining phases — autonomous implementation plan

Status: approved planning baseline after Phase 4 repository completion. External security, legal-domain, provider, and design-partner gates remain binding.

## How many phases remain?

Four core phases remain before the controlled pilot-ready v1 finish line:

1. Phase 5 — reviewed matter overview and attorney-controlled response planning;
2. Phase 6 — verified legal authority research;
3. Phase 7 — controlled drafting, collaboration, and export;
4. Phase 8 — production pilot and general-availability readiness.

Phase 9+ is optional expansion for multilingual processing, additional jurisdictions, enterprise integrations, new practice areas, and advanced analytics. It is not part of the core v1 commitment.

The machine-readable source of truth is `docs/roadmap/remaining-phases-manifest.json`. This document explains how that manifest must be verified and executed.

---

## Meaning of the command `build`

When the repository owner says **build**, the implementation agent must implement the next eligible planned phase end-to-end.

The command means:

1. fetch remote `main` and read this plan, the manifest, the previous phase exit review, and the next phase handoff;
2. verify the pre-build gate below;
3. select the lowest-numbered phase whose status is `planned` and whose repository prerequisites are satisfied;
4. implement its increments sequentially without asking for routine confirmation;
5. create one reviewable branch and pull request per increment;
6. run the complete repository CI before each merge;
7. squash-merge each green increment into remote `main`;
8. verify remote `main` after every merge;
9. complete the phase validator, exit review, version bump, and next-phase handoff;
10. return a final confirmation containing every PR, squash commit, final `main` SHA, CI result, and unresolved external gate.

`build` implements one phase. `build all` may attempt all remaining phases sequentially, but it must still enforce every phase boundary and external entry gate.

The implementation agent must not claim a separate local push when GitHub merges already updated remote `main`. It must instead say that the merge pushed the commit to remote `main` and prove the final SHA.

---

## Mandatory pre-build verification

Before changing code for a phase, the agent must verify all items below and record the result in the first implementation PR.

### Repository state

- remote default branch is `main`;
- no earlier implementation PR remains open;
- the previous phase's final squash commit is present on `main`;
- the previous phase's validator and exit review exist;
- the current `main` CI is green or its absence is explained and the last phase-head CI is green;
- migrations are ordered and the next migration number is known;
- package version matches the completed phase;
- the roadmap validator passes.

### Scope integrity

- the next phase objective matches the manifest;
- all five increments and their deliverables are accounted for;
- entry gates, exit gates, and non-goals are copied into the phase README or operating contract;
- new database tables are matter-scoped, organization-scoped, RLS-protected, and denied to anonymous users;
- every new generated or analytical artifact has version, source, review, stale, supersession, and deletion behaviour;
- no earlier product invariant is weakened.

### External-gate classification

Each entry gate must be classified as one of:

- **verified** — evidence exists and implementation may use it;
- **repository-only** — code may be implemented with fixtures or provider-neutral adapters, but production use remains blocked;
- **blocked** — trustworthy implementation is impossible without a missing secret, contract, legal/security approval, or external resource.

A repository-only implementation must clearly preserve the production block in code, documentation, tests, and the exit review.

---

## Autonomous execution contract

### Branch and merge sequence

For phase `N`, use five increments:

```text
agent/phaseNa-...
agent/phaseNb-...
agent/phaseNc-...
agent/phaseNd-...
agent/phaseNe-...
```

Each increment must:

1. branch from the latest remote `main`;
2. add the domain model, migration, API, tests, and contract documentation required for that increment;
3. open a pull request to `main`;
4. wait for GitHub Actions to finish;
5. debug and fix failures rather than bypass checks;
6. squash-merge only after all checks pass;
7. verify the returned merge SHA on remote `main` before starting the next increment.

The final increment must also add or update:

- `scripts/validate-phaseN.mjs`;
- `npm run validate:phaseN`;
- the CI workflow;
- the package minor or major version;
- `docs/phase-N/exit-review.md`;
- `docs/phase-N/phase-(N+1)-handoff.md`, except Phase 8, which produces the 1.0 launch-decision record;
- this roadmap manifest's completed/next-phase status in a dedicated final roadmap commit when appropriate.

### Required CI

Every increment must retain and pass:

- Node tests;
- migration and RLS validation;
- all earlier phase validators;
- the current phase validator when introduced;
- strict TypeScript compilation;
- Python processor compilation;
- processor Docker build;
- any new security, export, or deployment checks introduced by the phase.

No failing check may be waived silently.

### Permitted autonomous decisions

The agent may, without asking:

- choose names consistent with current repository conventions;
- split a phase increment into multiple implementation commits on its branch;
- fix CI failures caused by the phase;
- add indexes, validation constraints, tests, and documentation required by the stated contract;
- use deterministic/provider-neutral fixtures where a live provider is not yet approved;
- preserve a production feature flag or deployment block when an external entry gate is not satisfied.

### Mandatory stop conditions

The agent must stop the affected production-capability portion and report the blocker when:

- required credentials or secrets are unavailable or invalid;
- provider terms, data rights, legal approval, privacy approval, or security approval are explicitly required and absent;
- a destructive migration cannot be proven safe and reversible;
- remote `main` is failing for an unrelated reason that prevents trustworthy verification;
- a requested implementation would weaken matter isolation, source provenance, attorney approval, deletion, or audit requirements;
- an action would autonomously communicate with clients, courts, tribunals, witnesses, or opposing counsel.

The agent should still complete safe repository-only scaffolding when the plan permits it and clearly mark the remaining production block.

---

# Phase 5 — Reviewed matter overview and attorney-controlled response planning

Target version: `0.5.0`

## Objective

Create narrative and planning views only from approved structured artifacts. Generated prose remains a view over the graph, never the system of record.

## Increments

### 5A — Narrative support graph

- sentence-level narrative objects;
- bindings to approved structured objects and exact source spans;
- claim type, attribution, dispute, uncertainty, and omission metadata;
- unsupported-language detection and blockers;
- dependency and stale-propagation records.

### 5B — Reviewed matter overview snapshots

- version-locked overview sections;
- document, party, chronology, allegation, response, evidence, contradiction, gap, and filing-delta views;
- executable source reopening for each material sentence;
- no flattening of disputed positions into facts;
- immutable overview snapshots and review lineage.

### 5C — Attorney-controlled response-planning workspace

- planning by reviewed allegation-matrix row;
- factual-answer nodes;
- evidence-to-verify nodes;
- client-question nodes;
- contradiction-to-resolve nodes;
- authority-research task nodes;
- assignments, status, dependencies, and reviewer decisions.

### 5D — Approval, invalidation, and controlled internal export

- attorney approval for one exact overview or planning snapshot;
- stale invalidation after source or graph correction;
- internal-only export package with source manifest;
- audit events and access controls;
- no filing-ready representation.

### 5E — Evaluation and exit

- citation fidelity;
- unsupported material-language rate;
- sentence-level support coverage;
- reviewer correction severity;
- review-time savings;
- Phase 5 validator, exit review, version bump, and Phase 6 handoff.

## Exit standard

Every material sentence and plan node must be source-bound, reviewable, invalidatable, and approved independently. Filing-ready drafting and external authority research remain blocked.

---

# Phase 6 — Verified legal authority research

Target version: `0.6.0`

## Objective

Build a separate authority-research system whose citations, quotations, jurisdiction, date, court, and treatment metadata are verifiable. Matter evidence and external authorities must never be silently mixed.

## Increments

### 6A — Source registry and query contract

- allowlisted authority providers and repositories;
- licence, retention, jurisdiction, court, date, and availability metadata;
- provider-neutral query adapters;
- research-question objects and scoped search sessions;
- explicit production block for unapproved sources.

### 6B — Immutable authority ingestion

- source copy or authoritative locator;
- immutable hash and retrieval metadata;
- page, paragraph, and quotation identity;
- coverage and retrieval-failure ledger;
- supersession, withdrawal, deletion, and provider-unavailability states.

### 6C — Proposition-authority mapping

- supports, distinguishes, contradicts, contextualizes, and procedural-only relationships;
- quoted proposition spans;
- jurisdiction and temporal applicability;
- treatment and status warnings;
- attorney review and correction lineage.

### 6D — Research workspace

- research-question queue;
- authority comparison and filters;
- clear separation between record evidence and law;
- reviewed research snapshots;
- source-linked internal research notes.

### 6E — Evaluation and exit

- authority existence and citation accuracy;
- quotation fidelity;
- proposition-support classification;
- jurisdiction/date/treatment accuracy;
- fabricated-authority zero-tolerance gate;
- Phase 6 validator, exit review, version bump, and Phase 7 handoff.

## Exit standard

No authority may be presented without a verifiable source. Research conclusions remain attorney-reviewed and separate from matter evidence.

---

# Phase 7 — Controlled drafting, collaboration, and export

Target version: `0.7.0`

## Objective

Allow legal teams to collaborate on versioned drafts derived from approved plans, matter support, and verified authorities, with exact approval and export controls.

## Increments

### 7A — Collaboration and review workflow

- assignments and due states;
- comments and review threads;
- reviewer requests and decisions;
- role-based drafting, review, approval, and export permissions;
- immutable audit history.

### 7B — Versioned drafting workspace

- draft sections derived from approved planning nodes;
- bindings to matter support and authority support;
- revision history and redlines;
- unresolved markers for unsupported propositions;
- dependency and stale propagation.

### 7C — Citation and record assembly

- record citations and authority citations;
- reference tables and appendices;
- exact source-opening checks;
- citation-format adapters;
- missing and invalid citation blockers.

### 7D — Approval and export package

- named attorney approval for the exact draft version;
- DOCX/PDF export adapters;
- export manifest, hashes, source versions, and approval record;
- watermarks and disclaimers where required;
- privilege, confidentiality, retention, and download controls.

### 7E — Evaluation and exit

- unsupported-draft rate;
- citation fidelity;
- reviewer redline burden and correction severity;
- export reproducibility;
- collaboration permission tests;
- Phase 7 validator, exit review, version bump, and Phase 8 handoff.

## Exit standard

Nothing is filing-ready until a named attorney approves the exact immutable version. The product never files or communicates externally on its own.

---

# Phase 8 — Production pilot and general-availability readiness

Target version: `1.0.0`

## Objective

Deploy and operate Casewise as a controlled design-partner product, close security and operational risks, prove product value, and make an explicit proceed, pivot, or stop decision.

## Increments

### 8A — Production infrastructure and recovery

- infrastructure as code;
- environment, tenant, region, and secret isolation;
- backup and restore;
- disaster recovery;
- provider failover and secret rotation;
- migration rollback and data-recovery drills.

### 8B — Operations and trust controls

- SLOs and service dashboards;
- alerting and incident response;
- support-access approvals and session audit;
- security-event monitoring;
- queue, storage, model/provider, and cost observability.

### 8C — Tenant administration, quotas, and economics

- organization administration;
- usage and storage limits;
- cost-per-matter and cost-per-page accounting;
- billing-ready but reviewable ledger;
- abuse, runaway-cost, and export controls;
- customer-facing retention and deletion settings.

### 8D — Independent assurance

- penetration test and remediation;
- independent RLS and cross-matter isolation review;
- privacy, retention, deletion, backup, and provider verification;
- threat-model closure;
- legal and security launch checklist.

### 8E — Design-partner pilot and launch decision

- approved pilot matters and users;
- quality, omission, review-time, reliability, support-load, and unit-economics dashboards;
- practitioner interviews and correction analysis;
- explicit proceed, pivot, or kill record;
- `1.0.0` release checklist and production runbooks.

## Exit standard

Casewise reaches v1 only when independent assurance passes, pilot metrics meet approved thresholds, operational economics are acceptable, and named product, legal, security, and business owners approve launch.

---

## Optional Phase 9+ expansion

Optional work begins only after the Phase 8 launch decision. Candidate areas include:

- multilingual and regional-language processing;
- additional jurisdictions;
- new practice areas;
- enterprise document-management, email, calendar, and billing integrations;
- advanced analytics and portfolio views.

Every expansion requires its own constitution, entry gates, evaluation packs, security review, and exit criteria. It must not weaken the evidence, review, isolation, deletion, or approval invariants established in Phases 0–8.

---

## Required final confirmation after every `build`

The agent's final response must state:

- phase and increments implemented;
- PR numbers and links;
- squash commit for each increment;
- final remote `main` SHA;
- CI stages that passed;
- migration count and package version;
- open PR count;
- repository-only or blocked production capabilities;
- external gates still pending;
- the next eligible phase.

A build is not complete until remote `main` and the merged PR state have been independently re-read and confirmed.
