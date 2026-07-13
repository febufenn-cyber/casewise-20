# Phase 5 handoff — Reviewed matter overview and attorney-controlled response planning

Phase 5 may create useful narrative and planning views only from approved structured artifacts. It must not return to free-form bundle summarization.

## Required inputs

- reviewed document, entity, fact, chronology, allegation, response, evidence, contradiction, and missing-information objects;
- an attorney-approved matter-matrix snapshot;
- attorney-approved filing-delta and matter-memory snapshots when versioned filings exist;
- complete processing-coverage and source-integrity status;
- explicit artifact version locks.

## Required capabilities

- generate an internal matter overview from approved graph objects;
- preserve party attribution, disputes, uncertainty, omissions, and review status;
- create an attorney-controlled response-planning workspace organized by reviewed allegation rows;
- propose non-filing outline nodes such as factual answer, evidence to verify, client question, contradiction to resolve, and authority-research task;
- bind every narrative sentence and outline node to structured object identifiers and executable source links;
- show which filing and matrix versions support the view;
- invalidate narrative and outline nodes when upstream reviewed artifacts become stale;
- require attorney approval separately for each overview or planning snapshot;
- measure citation fidelity, unsupported-language rate, reviewer corrections, and time saved.

## Non-goals

- filing-ready pleadings or submissions;
- autonomous legal advice;
- outcome prediction;
- fabricated legal authorities;
- mixing matter evidence with external authority research;
- public-facing answers from confidential matter content;
- autonomous contact with clients, courts, tribunals, witnesses, or opposing counsel.

## Entry gates

- Phase 4 evaluation passes calibrated accuracy, source-pair, material-omission, and review-time gates;
- Phase 1 production-security gates are independently satisfied;
- every generated sentence can be decomposed into reviewed graph support;
- stale propagation is tested from source correction through narrative invalidation;
- legal practitioners approve the overview and response-planning terminology and workflow.
