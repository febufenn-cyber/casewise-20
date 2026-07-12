# Decision Gates

## Rule

Phase 0 documents do not authorize Phase 1 by themselves. Phase 1 starts only after documentary, customer-evidence, trust, evaluation, and economic gates are reviewed together.

## Gate A — repository baseline

Pass when:

- product constitution exists;
- first ICP, user, buyer, and job are explicit;
- supported and unsupported inputs are explicit;
- exact work products are defined;
- allowed and prohibited uses are defined;
- ontology and citation contract exist;
- threat, data, review, evaluation, economics, pilot, and risk documents exist;
- open assumptions are identified rather than represented as facts.

**Status:** implemented on the Phase 0 branch.

## Gate B — customer evidence

Pass when:

- at least five substantive workflow interviews are recorded;
- at least three candidates meet the qualified design-partner threshold;
- at least two permissible matter packs are available or contractually committed;
- users validate the matter map before autonomous drafting;
- actual work products or workflow artifacts have been observed;
- at least one buyer provides a concrete paid-pilot or procurement signal.

**Status:** open.

## Gate C — trust and data feasibility

Pass when:

- provider retention, training, access, deletion, and subprocessor behavior are reviewed;
- a pilot data-handling agreement or equivalent terms are defined;
- organization and matter isolation can be implemented and tested;
- support access and incident ownership are defined;
- immutable original, source-viewer, deletion, and audit requirements are feasible;
- prohibited-use boundaries are acceptable to design partners.

**Status:** open.

## Gate D — evaluation feasibility

Pass when:

- at least five initial packs can be annotated for early development;
- a holdout strategy is defined;
- critical metrics can be computed;
- source and page identity can be represented reliably;
- material omissions can be adjudicated by a qualified reviewer;
- adversarial packs can be created without unsafe customer-data handling.

**Status:** open.

## Gate E — preliminary economics

Pass when:

- a cost model exists for small, medium, and large matters;
- likely OCR and model usage are estimated;
- support and founder-review time are separated from infrastructure cost;
- a credible paid-pilot price exceeds variable cost by a meaningful margin;
- expected net lawyer time savings remain positive after review.

**Status:** open.

## Proceed to Phase 1 when

All gates pass, or an explicit decision-log entry documents a narrowly bounded exception with owner, evidence, risk, and expiry. No exception may waive cross-matter isolation, citation integrity, processing-coverage disclosure, immutable originals, or human approval authority.

## Pivot when evidence shows

- chronology is valuable but allegation-response mapping is not;
- arbitration is substantially more repeatable than general litigation;
- an LPO or paralegal team is the stronger buyer;
- customers prefer a managed per-matter service;
- filing-to-filing delta analysis is the only recurring use;
- cloud processing is rejected but a viable private tier exists;
- page-based pricing better matches cost and value than seats.

A pivot updates the constitution only where necessary and creates a new decision entry.

## Pause when

- customer evidence is insufficient;
- permissible matter packs cannot be obtained;
- provider or privacy terms are unresolved;
- source identity cannot be represented reliably;
- the team cannot secure qualified legal review for evaluation;
- economics remain unknowable because the workflow is still too broad.

Pause means gather evidence, not quietly build the desired feature.

## Kill when

- no target user will provide a workflow artifact or permissible matter pack;
- users like the idea but will not repeat use or pay;
- a general AI workflow already satisfies the job without a meaningful provenance or workflow advantage;
- the product saves junior time but creates equal or greater partner-review time;
- reliable source verification is not achievable on the supported bundle class;
- required confidentiality controls make the first market economically impossible;
- customers require filing-ready autonomous drafting as the minimum product;
- material omissions remain undetectable and are presented as complete review.

## Phase 1 acceptance criteria to inherit

If Phase 1 is authorized, it must deliver at minimum:

- authenticated organization and matter workspaces;
- matter-scoped authorization and automated isolation tests;
- signed upload/download paths;
- immutable originals and SHA-256 identity;
- file validation and parser isolation;
- native extraction and OCR with quality metadata;
- page rendering and explicit page identity;
- coverage ledger with failed/unsupported states;
- exact source-span reopening in the original viewer;
- deletion propagation design;
- metadata-only ordinary logs;
- audit events for upload, access, deletion, approval, and export.

No summary or drafting feature is required to declare Phase 1 successful.
