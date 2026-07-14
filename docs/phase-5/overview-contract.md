# Phase 5 matter overview contract

A matter overview is an immutable, internal narrative view assembled from accepted narrative sentences. It is never generated directly from uploaded bundle text.

## Required inputs

- one narrative support set tied to an attorney-approved matrix snapshot;
- complete processing coverage;
- accepted or corrected narrative sentences;
- at least one reviewed structured-object and exact source-span binding per sentence;
- explicit matrix, filing and memory version locks where applicable.

## Snapshot rules

- sections and sentence order are frozen at creation;
- a sentence may appear in only one section of one snapshot;
- disputed, uncertain, inferred and missing-within-scope metadata remains visible;
- the source manifest is fingerprinted and recomputed before display or later approval;
- changes create a new snapshot instead of mutating a reviewed one;
- reviewer acceptance makes a snapshot `ready`, not attorney-approved;
- attorney approval is added only by Phase 5D and applies to one exact snapshot version.

## Source reopening

The source manifest returns, for every sentence:

- sentence and section identity;
- attribution, dispute, uncertainty, omission and materiality metadata;
- structured-object identifiers;
- exact source-span identifiers;
- support roles;
- a deterministic manifest fingerprint.

The existing authenticated source-viewer route resolves each source span to its exact page and highlight. No permanent public source URLs are created.

## Production boundary

Every snapshot created during repository-only implementation carries `production_use_allowed = false`. Confidential production use remains blocked until the Phase 1 independent security gates, Phase 4 real-matter evaluation gates and practitioner workflow approval are satisfied.
