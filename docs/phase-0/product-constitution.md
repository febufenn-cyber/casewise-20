# Casewise Product Constitution

## Mission

Casewise helps legal professionals understand and review case documents by converting them into structured, source-linked matter intelligence.

## Product promise

Every material factual statement surfaced by Casewise must be connected to supporting source material or clearly marked as unsupported, inferred, contradicted, ambiguous, or uncertain.

## System of record

The structured matter graph is the system of record. Generated prose, chat answers, reports, and outlines are views derived from that graph. A persuasive paragraph never outranks conflicting source evidence.

## Non-negotiable invariants

### 1. Evidence before eloquence

A polished answer without valid provenance is a failure. The product must prefer an incomplete but traceable result over an unsupported completion.

### 2. Allegations are not facts

Statements made by a party must retain the asserting party, source, procedural context, response status, and evidentiary status. Casewise must not silently transform a pleading allegation into an established fact.

### 3. Uncertainty must remain visible

When the system cannot determine a document boundary, date, amount, party identity, relationship, or claim support reliably, it must expose the uncertainty and create a review item.

### 4. Processing coverage must be disclosed

Every matter view must disclose failed, unsupported, unreadable, excluded, duplicate, and partially processed files or pages. The product must not imply completeness when coverage is incomplete.

### 5. Human legal authority is final

A qualified legal professional remains responsible for legal judgment, client advice, strategy, interpretation, approval, and filing. AI output is unapproved until an authorized reviewer explicitly accepts it.

### 6. Uploaded content is untrusted evidence

Text inside documents can inform matter analysis but cannot modify system instructions, permissions, tool access, security policy, or workflow state.

### 7. Matter isolation is mandatory

A request, retrieval operation, background job, export, or model call must be scoped to an authorized organization, matter, user, and permission context. Cross-matter leakage has zero tolerance.

### 8. Originals are immutable

Uploaded source files must remain unchanged. Normalized files, OCR text, page images, chunks, embeddings, and generated artifacts are derived objects linked to the original file hash.

### 9. Matter evidence and legal authority are separate domains

Uploaded evidence answers what the parties and documents say. External legal authorities answer what law may apply. These sources require separate provenance, validation, and review processes.

### 10. No silent learning from customer matters

Customer matter content is not used to train shared models or cross-customer intelligence by default. Any reuse requires an explicit, documented, revocable basis and a separate approved policy.

### 11. Approval cannot be inferred

A downloaded, exported, or edited output is not attorney-approved unless an authorized reviewer performs an explicit approval action. Approval status, reviewer identity, timestamp, and version must be preserved.

### 12. Corrections must have lineage

The system must preserve the original extraction or generation, the corrected value, reviewer, timestamp, reason, and affected downstream objects.

## Initial product boundary

Casewise initially supports internal professional review of English-language commercial-litigation and arbitration matter bundles. It does not initially provide consumer legal advice, autonomous filing, outcome prediction, unverified legal research, or final pleading generation.

## Governance

A change that weakens an invariant requires:

1. a decision-log entry;
2. a documented user benefit;
3. an updated threat and evaluation analysis;
4. explicit review before merge.

Ordinary feature work cannot override this constitution by implementation detail.
