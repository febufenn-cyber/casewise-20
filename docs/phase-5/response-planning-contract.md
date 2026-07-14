# Phase 5 response-planning contract

The response-planning workspace organizes internal legal-team work around reviewed allegation-matrix rows. It is not a pleading generator and does not provide autonomous legal advice.

## Node types

- `factual_answer` — prepare or verify a factual response without adding a legal conclusion;
- `evidence_to_verify` — identify evidence whose existence, authenticity, completeness or support relationship needs review;
- `client_question` — record a question for a human to ask; the system does not answer it;
- `contradiction_to_resolve` — route a reviewed contradiction or inconsistency for resolution;
- `authority_research_task` — define future legal research without executing or fabricating it;
- `internal_note` — record a source-bound internal work item.

## Required bindings

Every node must bind to:

- one allegation row from the locked attorney-approved matrix snapshot;
- the corresponding allegation;
- at least one reviewed matter-graph object;
- at least one exact source span.

Assignments are limited to active matter members. Dependencies must remain acyclic and are typed as blocking, informing or requiring resolution.

## Review and approval boundary

- node review may accept, reject, leave unresolved or change workflow status;
- accepted nodes remain part of a draft or reviewed plan snapshot;
- exact-version attorney approval is deferred to Phase 5D;
- authority-research tasks do not contain external authority results in Phase 5;
- no node may be represented as filing-ready language.

## Production boundary

Response plans carry `production_use_allowed = false` until the documented external Phase 1, Phase 4 and practitioner gates are independently satisfied.
