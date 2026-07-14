# Casewise

> A source-linked matter intelligence workspace for legal professionals.

Casewise is being designed to convert litigation and arbitration case bundles into a lawyer-reviewable map of documents, parties, events, allegations, responses, evidence, contradictions, and unresolved questions. Every material factual statement must resolve to the uploaded source or be marked unsupported, inferred, contradicted, or uncertain.

## Current status

**Phases 0–4 are implemented in the repository. Production deployment, independent security verification, legal-domain evaluation, and design-partner evidence remain pending.**

The implemented layers cover the product constitution, secure evidence custody, document and chronology intelligence, allegation-response-evidence mapping, filing-to-filing deltas, matter memory, and executable evaluation gates. Repository completion does not by itself authorize confidential production use or establish legal accuracy.

## Initial wedge

- **Primary customer hypothesis:** boutique Indian commercial-litigation and arbitration practices with 2–15 lawyers.
- **Primary user:** junior associate or senior paralegal preparing the first internal matter note.
- **Economic buyer:** partner or practice head responsible for review quality and team efficiency.
- **First job:** turn an English-language case bundle into a source-linked matter map.
- **First work products:** document register, party map, chronology, allegation-response matrix, contradiction register, missing-information register, and internal matter overview.
- **Explicitly deferred:** autonomous legal advice, autonomous filing or communications, consumer legal chat, outcome prediction, and unreviewed external legal research.

## Product invariant

> Intelligence must never silently detach from evidence.

The structured matter graph is the system of record. Generated prose is only a view derived from that graph.

## Repository map

- [`docs/phase-0/`](docs/phase-0/) — constitution, scope, trust rules, economics, pilot design, and merge gates.
- [`docs/phase-1/`](docs/phase-1/) through [`docs/phase-4/`](docs/phase-4/) — implemented phase contracts, handoffs, and exit reviews.
- [`docs/roadmap/remaining-phases-autonomous-build-plan.md`](docs/roadmap/remaining-phases-autonomous-build-plan.md) — verified autonomous implementation protocol for the remaining core phases.
- [`docs/roadmap/remaining-phases-manifest.json`](docs/roadmap/remaining-phases-manifest.json) — machine-readable roadmap source of truth.
- [`research/`](research/) — design-partner research materials.
- [`evals/`](evals/) — evaluation-pack conventions and machine-readable schemas.

## Build sequence

1. **Phase 0:** product constitution and validation — implemented.
2. **Phase 1:** secure ingestion, immutable originals, OCR, page identity, and exact source viewer — implemented.
3. **Phase 2:** document segmentation, entity map, and chronology — implemented.
4. **Phase 3:** allegation-response and evidence matrix — implemented.
5. **Phase 4:** filing-to-filing delta engine and matter memory — implemented.
6. **Phase 5:** reviewed matter overview and attorney-controlled response planning — planned.
7. **Phase 6:** verified legal authority research — planned.
8. **Phase 7:** controlled drafting, collaboration, and export — planned.
9. **Phase 8:** production pilot and general-availability readiness — planned.
10. **Phase 9+:** optional multilingual, jurisdictional, integration, and practice-area expansion.

Four core phases remain before the controlled pilot-ready v1 finish line. Saying `build` instructs the implementation agent to verify and implement the next eligible phase end-to-end under the roadmap contract, including green CI, squash merges, remote `main` verification, and exact commit confirmation.

## Proposed technical direction

The stack remains Cloudflare Workers + Hono, Supabase Postgres/Auth/RLS, object storage, asynchronous document processing, and model-assisted extraction and verification. Provider-specific production features remain gated by security, privacy, licensing, retention, regional, cost, and evaluation requirements.

## Non-goals

Casewise is not a law firm, does not replace professional judgment, and must not represent unreviewed output as attorney-approved. Uploaded documents are untrusted evidence sources, never executable instructions.

---

Original blueprint inspiration: the product category demonstrated by Casetext and later legal-AI systems. Casewise's intended differentiation is evidence provenance, structured matter memory, exception-focused review, and filing-to-filing change detection rather than a generic legal chatbot.
