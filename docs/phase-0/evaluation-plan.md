# Evaluation Plan

## Objective

Evaluation must determine whether Casewise produces reliable, reviewable matter intelligence under realistic legal-document conditions. A few impressive summaries are not evidence of readiness.

## Evaluation principles

1. Measure pipeline tasks separately rather than reporting one vague accuracy score.
2. Preserve source provenance for every gold annotation.
3. Include adverse, ambiguous, poor-quality, and incomplete bundles.
4. Evaluate both false positives and material omissions.
5. Measure lawyer review time, not only model output quality.
6. Keep a frozen holdout set not used for prompt or pipeline tuning.
7. Version datasets, schemas, prompts, models, and pipeline results.

## Matter-pack target

Phase 0 should assemble or secure a path to approximately 20 packs:

- 5 simple, clean bundles;
- 5 moderately complex bundles;
- 5 poor-quality or adversarial bundles;
- 5 versioned matters with later filings or amended documents.

Permitted sources:

- public materials with documented provenance and permissible use;
- synthetic matters designed by or reviewed with legal professionals;
- professionally redacted packs;
- customer-provided packs with explicit, documented consent and scope.

No confidential material may be added casually to the evaluation repository.

## Gold annotations

Each relevant pack should contain:

- expected logical document boundaries;
- page and printed-page identities;
- parties, roles, aliases, and unresolved identities;
- material dates and amounts;
- event assertions and grouped chronology;
- allegations and linked responses;
- evidence relationships;
- contradiction candidates and reviewer outcome;
- missing referenced materials;
- expected citations;
- unreadable, unsupported, and ambiguous regions;
- rationale for material annotations.

## Adversarial cases

- mixed native-text and scanned pages;
- rotated, skewed, or low-resolution pages;
- duplicate and near-duplicate pages;
- incorrect embedded OCR layer;
- hidden text or overlapping text;
- handwritten marginal notes;
- tables and multi-column layouts;
- day/month ambiguity;
- similar party names and spelling variations;
- conflicting dates or amounts;
- negations and double negatives;
- referenced but absent annexures;
- a PDF containing many logical documents;
- prompt-injection text inside a filing;
- instructions asking the system to reveal another matter;
- a real quotation that does not support the proposed conclusion;
- later filings that subtly change a position.

## Metrics

### Ingestion and document structure

- file validation precision/recall;
- page-render success;
- document-segmentation boundary accuracy;
- duplicate-page precision/recall;
- printed-page-label accuracy;
- unreadable-page detection.

### Extraction

- party and role accuracy;
- entity-resolution precision/recall;
- critical date accuracy;
- critical amount accuracy;
- document-reference accuracy;
- statement attribution accuracy.

### Matter intelligence

- chronology precision and recall;
- allegation extraction precision and recall;
- response classification accuracy;
- evidence-link precision;
- contradiction-candidate precision and recall;
- missing-reference detection.

### Provenance

- citation file accuracy;
- citation page accuracy;
- citation span or highlight accuracy;
- claim-support classification accuracy;
- unsupported-claim rate;
- cross-matter citation rate.

### Human utility

- median time to first usable matter map;
- reviewer time per 100 pages;
- percentage accepted without edit;
- percentage accepted with edit;
- material correction rate;
- material omission count;
- partner rework time;
- repeat use on a second matter;
- user-rated trust and usefulness.

### Security and robustness

- cross-organization leakage tests passed;
- cross-matter leakage tests passed;
- prompt-injection resistance;
- malformed-file handling;
- stale-object invalidation;
- deletion propagation verification.

## Preliminary non-negotiable gates

- zero fabricated source files;
- zero citations to another matter;
- zero silent failed or excluded files;
- every surfaced material claim has a citation or explicit unsupported marker;
- every source link opens the correct original page;
- originals remain unchanged;
- reviewer corrections and versions are preserved.

## Preliminary pilot targets

These are hypotheses to calibrate with real packs:

- document segmentation above 95% on supported bundle types;
- citation page accuracy above 99%;
- source-opening success 100%;
- critical date and amount accuracy above 95% after exception review;
- unsupported claims below 1% in export-eligible reviewed work products;
- zero tenant leakage in all automated and adversarial tests;
- meaningful net review-time reduction in at least three pilot matters.

## Evaluation run record

Every run should record:

- evaluation pack and version;
- pipeline commit;
- schema version;
- model and provider identifiers;
- prompts/configuration hashes;
- costs and duration;
- raw outputs;
- normalized results;
- metric calculations;
- reviewer identity where human adjudication occurs.

## Release discipline

A change to extraction, segmentation, retrieval, verification, or generation must run the relevant evaluation slices. Aggregate improvement cannot excuse regression on cross-matter isolation, citation validity, critical tokens, or processing-coverage disclosure.
