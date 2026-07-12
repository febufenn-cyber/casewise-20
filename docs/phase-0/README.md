# Phase 0 — Product Constitution and Wedge Selection

## Status

Repository baseline implemented. External validation is still open.

Phase 0 is complete only when the documentation gate **and** the design-partner evidence gate in `decision-gates.md` both pass. These files intentionally distinguish decisions from hypotheses so the team cannot convert untested assumptions into architecture by repetition.

## Phase 0 question

> What exact legal task will Casewise perform, for whom, under what evidence and safety constraints, and how will we know it deserves to be built?

## Current decision

Casewise will initially target boutique Indian commercial-litigation and arbitration practices with 2–15 lawyers. The first workflow is an English-language case-bundle review that produces a source-linked matter map. The system is not initially a general legal chatbot, legal-research engine, outcome predictor, consumer adviser, or autonomous pleading generator.

## Documents

1. `product-constitution.md` — non-negotiable product invariants.
2. `scope-and-icp.md` — first customer, user, buyer, inputs, exclusions, and positioning.
3. `workflow-output-contract.md` — current job, target workflow, and exact work products.
4. `use-boundaries.md` — allowed, prohibited, and review-required uses.
5. `matter-ontology.md` — conceptual system of record.
6. `citation-contract.md` — definition and validation of source provenance.
7. `threat-model.md` — technical, model, and workflow failure modes.
8. `data-lifecycle.md` — collection, storage, processing, retention, export, and deletion rules.
9. `human-review-policy.md` — review states, approval authority, and correction lineage.
10. `evaluation-plan.md` — gold packs, adversarial cases, metrics, and quality gates.
11. `unit-economics.md` — cost model and pricing hypotheses.
12. `pilot-plan.md` — design-partner recruitment, sessions, evidence, and pilot exit criteria.
13. `decision-gates.md` — proceed, pivot, pause, and kill rules.
14. `risk-register.md` — initial risks, owners, tests, and mitigations.
15. `decision-log.md` — durable record of Phase 0 decisions and open assumptions.

## Required evidence before Phase 1

- At least five substantive interviews.
- At least three qualified design partners.
- At least two usable public, synthetic, redacted, or consented matter packs.
- At least one time-bound paid-pilot commitment or an equally strong procurement signal.
- Confirmation that the structured matter map is useful before autonomous drafting.
- Preliminary provider, privacy, security, and unit-cost review.

## Change control

Changes to product invariants, prohibited uses, data-training policy, or approval authority require a new decision-log entry and explicit review. Feature branches must not weaken Phase 0 rules implicitly.
