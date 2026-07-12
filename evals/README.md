# Casewise Evaluations

## Purpose

This directory defines the reproducible evidence used to evaluate ingestion, provenance, matter intelligence, human review, and robustness. It must not become an uncontrolled storage location for customer files.

## Permitted data

Only add matter packs that are:

- public with documented provenance and permissible use;
- synthetic;
- professionally redacted and approved by the data owner; or
- explicitly consented for the stated evaluation purpose.

Do not commit confidential customer material, secrets, production exports, or automatically “redacted” files without human approval.

## Proposed layout

```text
evals/
├── README.md
├── schemas/
│   ├── matter-pack.schema.json
│   └── citation.schema.json
├── matter-packs/          # not populated until provenance is approved
├── expected/              # gold annotations
├── adversarial/           # synthetic and approved robustness cases
└── runs/                  # preferably generated artifacts or external storage references
```

## Matter-pack manifest

Every pack must record:

- stable identifier and version;
- provenance category;
- permitted use and restrictions;
- language, matter type, and jurisdiction context;
- file list and SHA-256 hashes;
- native-text versus scanned page counts;
- known quality issues;
- annotation status;
- train/development/holdout split;
- reviewers and adjudication status;
- retention or deletion requirements.

## Holdout discipline

A holdout pack cannot be used to tune prompts, schemas, thresholds, or examples. If a pack leaks into development, reclassify it and add a new holdout. Record this in the evaluation history.

## Annotation principles

- preserve source spans for gold statements;
- record disagreements and adjudication;
- distinguish absent from not found;
- distinguish allegation, evidence, response, and finding;
- mark ambiguity rather than forcing a single answer;
- identify material omissions, not only incorrect extracted items;
- record OCR and page-identity problems.

## Run metadata

A reproducible run should include:

- repository commit;
- pack and annotation version;
- pipeline and schema version;
- model/provider identifiers;
- prompt/configuration hashes;
- operation costs and duration;
- raw and normalized outputs;
- calculated metrics;
- reviewer adjudication where required.

## Zero-tolerance checks

- cross-matter or cross-organization source leakage;
- fabricated file identity;
- source link opening the wrong original page;
- silent failed/unsupported file omission;
- mutation of the original source file;
- approved export with invalid citations.

## Initial work

Phase 0 supplies schemas only. The next evidence task is to obtain permissible packs and annotate a small development subset before authorizing model-heavy product work.
