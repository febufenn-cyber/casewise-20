# Decision Log

This log distinguishes accepted Phase 0 decisions from open hypotheses. New decisions should use the same format and link to evidence.

## D-001 — First product shape

- **Status:** Accepted baseline
- **Decision:** Casewise begins as a source-linked matter-mapping workspace, not a general legal chatbot.
- **Why:** Structured outputs are more reviewable and differentiated than a blank chat interface.
- **Revisit when:** Design partners reject the structured workflow or another narrower job produces stronger evidence.

## D-002 — Initial customer hypothesis

- **Status:** Hypothesis adopted for validation
- **Decision:** Target boutique Indian commercial-litigation and arbitration practices with 2–15 lawyers.
- **Why:** Document-heavy work, visible junior-to-partner review, accessible buyers, and repeat matter updates.
- **Evidence still required:** Five interviews, three qualified partners, two packs, and a payment signal.

## D-003 — Primary user and buyer

- **Status:** Hypothesis adopted for validation
- **Decision:** Junior associate/senior paralegal is the primary user; partner/practice head is the economic buyer.
- **Risk:** User and buyer incentives may differ, and partner review may absorb the saved time.

## D-004 — Initial language and practice boundary

- **Status:** Accepted baseline
- **Decision:** English-language commercial-litigation and arbitration bundles only during initial validation.
- **Why:** Reduces OCR, terminology, and procedural variability.
- **Revisit when:** One supported wedge meets trust and economic gates.

## D-005 — First work products

- **Status:** Accepted baseline
- **Decision:** Document register, party map, chronology, allegation-response matrix, contradiction register, missing-information register, and internal overview.
- **Deferred:** Attorney-controlled response outline until provenance and review gates pass.

## D-006 — System of record

- **Status:** Accepted invariant
- **Decision:** The structured matter graph, not generated prose, is the system of record.
- **Consequence:** Every material generated section must reference structured objects and sources.

## D-007 — Allegations are not facts

- **Status:** Accepted invariant
- **Decision:** Preserve asserting party, procedural source, response, evidence status, and dispute state.
- **Consequence:** Neutral prose cannot silently erase attribution.

## D-008 — Citation meaning

- **Status:** Accepted invariant
- **Decision:** A valid citation requires original-file identity, exact page location, source span or visual region, and claim-support status.
- **Consequence:** “Page found” and “claim supported” are separate checks.

## D-009 — Human authority

- **Status:** Accepted invariant
- **Decision:** Models cannot mark substantive output attorney-approved. Approval is explicit, human, version-specific, and revocable through invalidation.

## D-010 — Customer-content training

- **Status:** Accepted default
- **Decision:** No shared-model training or cross-customer intelligence from customer matter content by default.
- **Revisit only with:** Separate policy, explicit basis, consent/revocation design, lineage, and security review.

## D-011 — Architecture commitment

- **Status:** Deliberately deferred
- **Decision:** Retain Workers/Hono/Supabase/object-storage/async-processing as a direction, not an irreversible Phase 0 commitment.
- **Why:** Provider terms, parser isolation, cost, regional requirements, and workload shape remain unvalidated.

## D-012 — Phase 1 content

- **Status:** Accepted baseline
- **Decision:** Phase 1 is secure ingestion and provenance. It does not need summary or drafting features.
- **Gate:** Exact original-page reopening, isolation, coverage, immutable sources, and deletion/audit design.

## D-013 — Phase 0 completion semantics

- **Status:** Accepted
- **Decision:** Repository documentation can be implemented while Phase 0 remains externally unvalidated.
- **Consequence:** README and PR must state that customer evidence gates remain open.

## Open decision queue

- exact first matter subtype;
- provider and data-processing region;
- default retention and recoverable-deletion period;
- source of initial evaluation packs;
- paid-pilot price and contract shape;
- per-matter versus subscription-plus-pages pricing;
- definition of material allegation for the first practice subtype;
- whether firm administrators may see all matters or ethical walls are default;
- private-deployment threshold;
- pilot page limits.
