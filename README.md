# Casewise

> A source-linked matter intelligence workspace for legal professionals.

Casewise is being designed to convert litigation and arbitration case bundles into a lawyer-reviewable map of documents, parties, events, allegations, responses, evidence, contradictions, and unresolved questions. Every material factual statement must resolve to the uploaded source or be marked unsupported, inferred, contradicted, or uncertain.

## Current status

**Phase 0 — Product Constitution and Wedge Selection: implemented as a repository baseline, pending real design-partner validation.**

Phase 0 does not claim that the market has been validated. It establishes the product's non-negotiable rules, first customer hypothesis, supported workflow, data boundaries, evaluation contract, pilot plan, and proceed/pivot/kill gates. Phase 1 must not begin merely because the documents exist; the external validation gate in `docs/phase-0/decision-gates.md` must also be satisfied.

## Initial wedge

- **Primary customer hypothesis:** boutique Indian commercial-litigation and arbitration practices with 2–15 lawyers.
- **Primary user:** junior associate or senior paralegal preparing the first internal matter note.
- **Economic buyer:** partner or practice head responsible for review quality and team efficiency.
- **First job:** turn an English-language case bundle into a source-linked matter map.
- **First work products:** document register, party map, chronology, allegation-response matrix, contradiction register, missing-information register, and internal matter overview.
- **Explicitly deferred:** autonomous legal advice, filing-ready pleadings, consumer legal chat, outcome prediction, unverified external legal research, and multilingual processing.

## Product invariant

> Intelligence must never silently detach from evidence.

The structured matter graph is the system of record. Generated prose is only a view derived from that graph.

## Phase 0 repository map

- [`docs/phase-0/`](docs/phase-0/) — constitution, scope, trust rules, economics, pilot design, and merge gates.
- [`research/interview-guide.md`](research/interview-guide.md) — evidence-oriented design-partner interviews.
- [`research/design-partner-scorecard.csv`](research/design-partner-scorecard.csv) — partner qualification template.
- [`evals/`](evals/) — evaluation-pack conventions and machine-readable schemas.

## Planned build sequence

1. **Phase 0:** product constitution and validation.
2. **Phase 1:** secure ingestion, immutable originals, OCR, page identity, and exact source viewer.
3. **Phase 2:** document segmentation, entity map, and chronology.
4. **Phase 3:** allegation-response and evidence matrix.
5. **Phase 4:** filing-to-filing delta engine.
6. **Phase 5:** attorney-controlled response outline.
7. **Phase 6+:** verified authority research, collaboration, trust controls, and expansion.

## Proposed technical direction

The original stack hypothesis remains Cloudflare Workers + Hono, Supabase Postgres/Auth/RLS, object storage, asynchronous document processing, and model-assisted extraction and verification. Phase 0 deliberately avoids locking in model names or a final deployment topology before provider terms, security boundaries, document-processing costs, and evaluation performance are tested.

## Non-goals

Casewise is not a law firm, does not replace professional judgment, and must not represent unreviewed output as attorney-approved. Uploaded documents are untrusted evidence sources, never executable instructions.

---

Original blueprint inspiration: the product category demonstrated by Casetext and later legal-AI systems. Casewise's intended differentiation is evidence provenance, structured matter memory, exception-focused review, and filing-to-filing change detection rather than a generic legal chatbot.
