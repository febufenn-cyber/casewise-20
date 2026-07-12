# Matter Ontology

## Purpose

The ontology prevents the product from encoding legal conclusions inside convenient but misleading data structures. It is conceptual in Phase 0; Phase 1 and later phases may translate it into database tables, typed schemas, and APIs without weakening the distinctions below.

## Root hierarchy

```text
Organization
└── Matter
    ├── Membership and permission
    ├── Uploaded file
    │   ├── Immutable original
    │   ├── Derived representation
    │   └── Logical document
    │       ├── Page
    │       ├── Source span
    │       └── Document reference
    ├── Entity
    ├── Statement
    ├── Event assertion
    ├── Allegation
    ├── Response
    ├── Evidence item
    ├── Issue
    ├── Contradiction candidate
    ├── Missing-information item
    ├── Review decision
    └── Generated view
```

## Core distinctions

### Uploaded file versus logical document

An uploaded PDF is a binary file. It may contain an index, pleading, affidavit, annexures, orders, correspondence, duplicates, and blank pages. Logical documents are segmented semantic objects linked to page ranges inside the uploaded file.

### Statement versus fact

A statement is something a person, party, document, or authority says. It records:

- text or normalized proposition;
- asserting entity or source;
- source span;
- procedural context;
- extraction method;
- review state.

A statement is not automatically an established fact.

### Event assertion versus event

An event assertion represents a source's claim that something happened. Multiple assertions may refer to the same candidate event and disagree about date, amount, participants, or occurrence.

An event view may group assertions, but must retain:

- supporting assertions;
- contradicting assertions;
- evidence items;
- status: uncontested, contested, inferred, ambiguous, or unresolved;
- reviewer decision.

### Allegation versus response

An allegation is a material proposition asserted against or about another party. A response is a separate object linked to the allegation and classified as:

- admitted;
- denied;
- partially admitted;
- not specifically answered;
- ambiguous;
- contradicted elsewhere;
- response not located.

“Response not located” does not mean “not denied.”

### Evidence item versus allegation

An evidence item is material offered or identified as supporting, contradicting, or contextualizing a proposition. The model must not infer that the existence of an exhibit proves the proposition for which a party relies on it.

### Contradiction candidate versus confirmed contradiction

The system may generate a contradiction candidate when two source-linked statements appear incompatible. A reviewer determines whether the conflict is material, explainable, duplicative, based on OCR error, or confirmed.

### Missing versus nonexistent

A missing-information item means the system has not located required or referenced material in the processed scope. It does not prove that the item does not exist elsewhere.

### Matter evidence versus legal authority

Matter evidence is derived from the customer's uploaded materials. Legal authority is obtained from a separately governed source and supports legal propositions. They must not share an undifferentiated retrieval index.

## Minimum shared fields

Every matter object that can appear in output should carry:

- `organization_id`;
- `matter_id`;
- stable object identifier;
- creation method: extracted, inferred, generated, or manual;
- source references where applicable;
- processing version;
- review status;
- created and updated timestamps;
- supersession or deletion status.

## Entity resolution

Names may vary across documents. Entity resolution must preserve:

- canonical display name;
- observed names and spellings;
- procedural roles over time;
- confidence or review status;
- reasons for merge or separation;
- ability to undo an incorrect merge.

## Generated views

Summaries, reports, chat answers, and outlines are generated views. They must reference the object identifiers used to produce each material section. Regeneration must not erase prior approved versions.

## Correction propagation

A correction to a source boundary, page label, entity, date, amount, allegation, or response may invalidate downstream objects. The implementation must support stale-state detection and targeted regeneration rather than silently preserving dependent conclusions.
