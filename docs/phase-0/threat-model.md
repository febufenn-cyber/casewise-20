# Threat Model

## Scope

This Phase 0 threat model covers confidentiality, authorization, document parsing, model behavior, provenance, workflow misuse, availability, and economic abuse. It is a design baseline, not a substitute for a later formal security review.

## Protected assets

- original customer files;
- extracted text, page images, embeddings, and derived artifacts;
- matter graph and review decisions;
- user identity and permissions;
- privileged or confidential communications;
- model prompts and outputs containing matter data;
- provider credentials and service-role secrets;
- audit and export history;
- product integrity and lawyer trust.

## Trust boundaries

- browser to application API;
- application API to object storage and database;
- API to asynchronous worker;
- document parser/OCR to matter pipeline;
- retrieval layer to model provider;
- model output to structured matter graph;
- organization to organization;
- matter to matter;
- user role to privileged action;
- production to support and development environments.

## Principal threats

| Threat | Failure | Required controls or later tests |
|---|---|---|
| Cross-matter retrieval | Matter A query retrieves Matter B content | Organization/matter/user scope on every read and job; RLS; retrieval filters; adversarial isolation tests; no global private index |
| Service-role bypass | Background worker bypasses RLS and leaks data | Explicit authorization envelope; narrow worker credentials; policy checks inside jobs; audit events |
| Prompt injection in documents | Uploaded text alters instructions or requests secrets/tools | Treat document text as data; tool allowlists; instruction/data separation; injection eval packs; no tool call caused solely by document content |
| Malicious PDF or parser exploit | File compromises processing service | File validation; malware scanning; sandboxed parsing; active-content rejection; resource limits; patched parsers |
| Hidden or misleading text | White-on-white, overlay, or OCR layer changes analysis | Compare visual and text layers; flag hidden text; page-image review; suspicious-layer detection |
| OCR corruption | Negation, date, amount, or name is misread | Confidence capture; alternate extraction; critical-token checks; source-image preview; review queue |
| Fabricated citation | Output references nonexistent or wrong source | Citation schema; file/page/span validation; support verification; export blocking for invalid citations |
| Real citation, unsupported claim | Passage exists but does not entail the conclusion | Separate entailment/scope verifier; compound-claim splitting; human review |
| Allegation converted to fact | Party submission becomes neutral truth | Ontology rules; mandatory attribution; contested status; UI labels; tests |
| Silent incomplete processing | Failed files are omitted while output looks complete | Coverage ledger; visible warnings; no “complete” status with unresolved failures |
| Unauthorized support access | Staff views sensitive matter content | Least privilege; break-glass procedure; customer-visible access logs; approval and expiry |
| Sensitive content in logs | Matter text enters telemetry or error logs | Structured metadata-only logs; redaction; log scanning; separate secure diagnostics |
| Provider retention or reuse | Third party retains or trains on matter data unexpectedly | Provider due diligence; contractual settings; data minimization; documented subprocessors; no production use before approval |
| Export abuse | Authorized user exports beyond intended purpose | Permissioned export; watermark/status; export event; optional download restrictions |
| Stale derived objects | Corrected source leaves old conclusions active | Dependency tracking; stale markers; targeted invalidation and regeneration |
| Cost-amplification attack | Large/repeated jobs create excessive spend | quotas; idempotency; file/page limits; retry caps; queue backpressure; cost alerts |
| Denial of service | Oversized or malformed matter blocks processing | per-job limits; timeouts; queue isolation; cancellation; partial failure handling |
| Model/provider outage | Matter becomes unavailable or inconsistent | job durability; provider abstraction where justified; retry policy; deterministic state transitions |
| Training-data contamination | Customer matter leaks into shared product improvement | default no-training policy; consent records; dataset lineage; environment separation |
| Misleading approval | User assumes export equals attorney approval | explicit approval action; visible status; versioned reviewer identity; export legend |

## Abuse cases

- A user uploads another firm's documents without authority.
- A user asks Casewise to identify “fraud” and exports the label as a factual conclusion.
- A document contains instructions to search other matters.
- An administrator searches globally for a famous party name and sees private results.
- A reviewer approves an outline, then underlying sources change without invalidating approval.
- A trial workspace is used for real confidential material before provider and retention controls are approved.

## Security invariants

1. No retrieval without organization and matter authorization.
2. No approved output with invalid source links.
3. No hidden processing failures.
4. No production customer content in development by default.
5. No persistent secret available to document-processing code unless strictly required.
6. No model output directly mutates approved matter state without validation and review.
7. No document instruction can expand permissions or tool access.

## Phase 1 security acceptance baseline

- automated organization and matter isolation tests;
- signed upload and download paths with expiry;
- immutable originals and hashes;
- validation and malware-scanning decision documented;
- parser isolation and resource caps;
- coverage ledger;
- metadata-only ordinary logs;
- audit events for access, upload, deletion, approval, and export;
- documented incident and support-access procedures;
- prompt-injection and cross-matter adversarial tests in CI or pre-release evaluation.
