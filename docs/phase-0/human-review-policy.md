# Human Review and Approval Policy

## Principle

Casewise is designed for exception-focused professional review, not invisible automation. Review must be attached to specific versions and objects rather than represented by a vague disclaimer.

## Roles

Initial conceptual roles:

- **Workspace administrator:** manages membership and settings; does not automatically receive access to every restricted matter.
- **Matter lead:** controls matter membership and approval policy.
- **Reviewer:** may accept, edit, reject, or escalate supported objects.
- **Contributor:** uploads files, adds notes, and proposes corrections.
- **Viewer:** can inspect permitted reviewed content but cannot approve.
- **Service worker:** performs narrowly scoped machine operations and cannot grant itself permissions.

Exact roles will be refined during pilots.

## Object-level states

### Processing state

- pending;
- processing;
- processed;
- partially processed;
- failed;
- unsupported;
- superseded.

### Extraction state

- extracted;
- uncertain;
- manually corrected;
- invalidated;
- not extractable.

### Evidence-support state

- directly supported;
- partially supported;
- contradicted;
- context only;
- ambiguous;
- no supporting passage found;
- source invalid.

### Review state

- not reviewed;
- accepted;
- accepted with edit;
- rejected;
- escalated;
- requires client clarification;
- superseded.

### Work-product state

- working analysis;
- review in progress;
- approved for internal use;
- approved for export;
- superseded;
- archived.

“Approved for export” is not “filed,” “sent,” or “legal advice delivered.”

## Review requirements

A reviewer must be able to see:

- the proposed object or statement;
- exact supporting and contradictory sources;
- whether text was native or OCR-derived;
- processing warnings;
- the model or method that created it;
- prior edits and review decisions;
- downstream objects that depend on it.

## Correction lineage

Every correction records:

- object identifier;
- original value;
- replacement value;
- reviewer identity;
- timestamp;
- reason code and optional note;
- affected dependencies;
- whether regeneration is required.

Corrections are additive history. They must not erase the fact that an earlier version existed and may have been used.

## Approval semantics

Approval is explicit and version-specific. It cannot be inferred from:

- downloading a file;
- editing text;
- leaving a page open;
- a high confidence score;
- absence of reviewer comments;
- a previous version's approval.

Changes to source files, segmentation, entity resolution, critical dates or amounts, or supporting citations may invalidate dependent approval.

## Exception-focused review

The system should prioritize review of:

- low-confidence OCR;
- negations, dates, amounts, and names;
- unsupported or partially supported claims;
- contradictions;
- inferred relationships;
- unresolved identities;
- missing referenced documents;
- stale downstream objects;
- proposed statements with legal or reputational significance.

It should not hide non-exception items; the reviewer must retain the ability to inspect any source.

## Export rules

Exports must include or make available:

- matter and version identity;
- processing coverage;
- review legend;
- unresolved warnings;
- source appendix or source links;
- reviewer and approval timestamp where appropriate.

Exports containing unreviewed material must visibly state that status. Later phases may block some exports until defined gates pass.

## Model confidence

Raw model confidence is not a substitute for calibrated product evidence. Initial user-facing labels should describe operational status—supported, contradicted, ambiguous, low-quality source, unreviewed—rather than invented percentages.

## Reviewer disagreement

The system must support disagreement without overwriting history. A second reviewer may:

- agree;
- propose a replacement;
- reopen an approved item;
- escalate to matter lead;
- preserve competing interpretations as separate reviewed notes.

## Automation boundary

No model may mark its own substantive legal analysis attorney-approved. Machine verification may update technical states such as “source located,” but professional approval remains a human action.
