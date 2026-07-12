# Workflow and Output Contract

## Existing workflow to validate

A typical matter-onboarding workflow is assumed to be:

1. Files arrive through email, messaging applications, shared drives, or client transfer.
2. A junior team member downloads, renames, sorts, and opens documents.
3. Pleadings are read first to identify parties, claims, responses, dates, and referenced exhibits.
4. Dates and facts are copied into Word or Excel.
5. Annexures are cross-referenced manually.
6. Questions and missing documents are sent to the client or supervising lawyer.
7. An internal matter note is drafted.
8. A senior lawyer reviews, requests corrections, and begins strategy or drafting.
9. Much of the work repeats when a new filing arrives.

This workflow is a hypothesis until verified through observed examples and interviews.

## Target workflow

1. Create an organization-scoped matter.
2. Upload a case bundle.
3. Validate files and disclose coverage.
4. Segment the bundle into logical documents.
5. Build document and party registers.
6. Extract source-linked statements, dates, amounts, and references.
7. Construct a disputed chronology.
8. Map allegations to admissions, denials, partial responses, non-responses, and evidence.
9. Surface contradictions, ambiguities, and missing materials.
10. Route uncertain items to exception-focused human review.
11. Generate an internal matter overview only from the reviewed structured graph.
12. Preserve corrections and approval lineage.

## Required first work products

### Matter overview

- matter title and identifier;
- forum and matter type when present;
- parties and procedural roles;
- relevant date range;
- important amounts;
- document and page counts;
- processing-coverage summary;
- unresolved warnings;
- review status.

### Document register

For each logical document:

- title and document type;
- filing or authoring party;
- document date;
- uploaded file and page range;
- printed page labels where detectable;
- annexure or exhibit label;
- duplicate status;
- extraction method and quality;
- processing status.

### Party and entity map

- parties and roles;
- people and organizations;
- witnesses and representatives;
- contracts, invoices, accounts, properties, and disputed assets;
- aliases, spelling variants, and unresolved identity candidates.

### Chronology

Every entry contains:

- stated or inferred date;
- event description;
- asserting source and party;
- supporting and contradictory passages;
- event status: uncontested, contested, ambiguous, inferred, or unresolved;
- reviewer status.

### Allegation-response matrix

Every row contains:

- allegation;
- alleging party and source;
- response and responding source;
- response class: admitted, denied, partially admitted, not specifically answered, ambiguous, or contradicted;
- supporting and contradictory evidence;
- materiality and review status.

### Contradiction register

- statement A and source;
- statement B and source;
- contradiction type;
- explanation of possible conflict;
- materiality;
- reviewer decision: confirmed, explained, duplicate, false positive, or unresolved.

### Missing-information register

- referenced but absent document;
- unreadable or failed page;
- allegation without identified support;
- response that does not address an allegation;
- inconsistent date or amount;
- unresolved identity;
- question for client or lawyer.

### Internal matter overview

A prose view derived only from the structured matter graph. It must preserve disputes, uncertainty, sources, and unresolved questions. It is not the system of record.

## Output acceptance contract

An output is reviewable only when:

- every material statement has one or more source links or an explicit unsupported marker;
- source links open the correct original file and page;
- allegations retain the asserting party;
- conflicting evidence is not silently removed;
- processing gaps are visible;
- generated prose can be traced back to structured objects;
- review state is visible;
- the output does not represent itself as legal advice or attorney-approved work.

## Deferred output

An attorney-controlled response outline is deferred until the matter graph, source viewer, citation validation, contradiction handling, and review workflow meet their gates. A filing-ready pleading is outside the initial product contract.
