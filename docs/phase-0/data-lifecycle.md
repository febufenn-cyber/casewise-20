# Data Lifecycle

## Purpose

This document defines conservative defaults for customer matter data. Production deployment still requires jurisdiction-specific legal, privacy, contractual, and provider review.

## Data classes

### Customer content

- original uploaded files;
- extracted text and page images;
- structured matter objects;
- generated summaries and outlines;
- reviewer notes and corrections.

### Identity and access data

- users, organizations, memberships, roles, invitations, and authentication metadata.

### Operational metadata

- file size and hash;
- processing state and version;
- job duration and cost;
- error category;
- audit events;
- usage and billing counters.

### Evaluation data

- public, synthetic, professionally redacted, or explicitly consented matter packs;
- gold annotations;
- expected outputs;
- model and pipeline results.

## Collection principles

- collect only what the supported workflow requires;
- preserve original filenames but allow safer display aliases;
- never require sensitive narrative data in ordinary support tickets;
- disclose what providers and subprocessors receive;
- do not collect customer matter content for unspecified future training.

## Storage model

- originals are immutable and content-addressed by hash;
- normalized PDFs, page images, OCR, chunks, embeddings, and generated artifacts are derived objects;
- every derived object records its source, matter, processing version, and deletion relationship;
- production, staging, development, and evaluation stores are separated;
- backups and replicas follow the same access and retention policy as primary storage;
- ordinary application logs contain identifiers and error categories, not full passages.

## Processing rules

- process asynchronously with an explicit authorization envelope;
- send the minimum necessary material to external providers;
- avoid sending an entire matter when a verified bounded span is sufficient;
- record provider, model, operation, and processing version without logging sensitive request bodies in ordinary telemetry;
- do not enable production processing until provider retention, training, access, location, and deletion terms are reviewed and documented;
- uploaded content cannot control tools or authorization.

## Retention baseline

The commercial policy remains a hypothesis, but the technical system must support:

- retention while a matter is active;
- configurable organization or matter retention later;
- a documented recoverable-deletion window where appropriate;
- permanent deletion of originals and derived content after the window;
- separate handling of minimal audit metadata when retention is legally justified;
- deletion propagation to page images, OCR, chunks, embeddings, generated views, caches, and provider-side stored objects where applicable.

A marketing claim of deletion is prohibited until deletion is tested end to end.

## Training and product improvement

Default:

> Customer matter content is not used to train shared models, shared retrieval stores, or cross-customer product intelligence.

Permitted improvement sources:

- synthetic data;
- public legal materials with documented provenance and permissible use;
- explicitly consented evaluation packs;
- metadata and aggregate quality signals that do not reveal matter content;
- customer-private corrections used only within the same authorized workspace where supported.

Any broader reuse requires a separate policy, consent and revocation design, dataset lineage, security review, and decision-log entry.

## Access

- customer access is organization- and matter-scoped;
- internal support access is denied by default;
- any future break-glass access must be approved, time-limited, logged, reviewable, and restricted to the minimum scope;
- privileged database or storage access must not become a normal support workflow;
- access revocation should invalidate active sessions and future jobs where feasible.

## Export and portability

The architecture should support export of:

- original uploaded files;
- document register and matter graph;
- citations and source appendix;
- reviewer decisions and generated versions;
- audit history appropriate to the user's role.

Exports must display review and verification status. An export is not approval.

## Deletion

Deletion requests must define:

1. the scope: object, document, matter, organization, or account;
2. authorization to delete;
3. immediate access revocation;
4. queued deletion of derived artifacts;
5. cache and search-index invalidation;
6. provider-side deletion where applicable;
7. backup expiry behavior;
8. auditable completion without retaining deleted content.

## Incident response baseline

Before confidential pilots, document:

- incident owner and escalation path;
- containment and credential-revocation procedure;
- affected-matter identification;
- evidence preservation;
- customer communication decision process;
- provider escalation;
- post-incident review and control updates.

## Open decisions

- object-storage provider and region;
- default retention period;
- recoverable-deletion window;
- backup retention;
- customer-controlled encryption requirements;
- provider-side prompt or response storage;
- whether private deployment is economically justified for a later tier.
