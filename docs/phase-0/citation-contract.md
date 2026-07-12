# Citation and Provenance Contract

## Principle

A citation is not decorative metadata. It is an executable path from a surfaced claim to the exact source material a reviewer can inspect.

## Minimum citation object

A valid citation must be capable of recording:

```json
{
  "organization_id": "org_123",
  "matter_id": "matter_123",
  "uploaded_file_id": "file_456",
  "logical_document_id": "doc_789",
  "source_file_sha256": "sha256:...",
  "pdf_page_index": 40,
  "printed_page_label": "17",
  "paragraph_label": "12",
  "text_start": 891,
  "text_end": 1014,
  "quoted_text": "The defendant acknowledges receipt...",
  "bounding_boxes": [],
  "extraction_method": "native_text",
  "ocr_confidence": null,
  "processing_version": "pipeline-version",
  "verification_status": "unreviewed"
}
```

The machine-readable baseline is in `evals/schemas/citation.schema.json`.

## Page identity

The product must distinguish:

- zero-based or one-based PDF page index used internally;
- page number shown by the PDF viewer;
- printed page label visible on the document;
- logical document page number;
- annexure or exhibit pagination;
- paragraph or line labels where available.

A UI label such as “page 14” is insufficient unless its page system is explicit.

## Citation validation layers

### 1. File integrity

- the referenced original file exists or has an approved archival record;
- the stored hash matches the immutable original;
- the citation belongs to the authorized matter.

### 2. Location integrity

- the page index resolves correctly;
- the logical document contains the page or span;
- the quoted text or visual region can be found;
- the highlighted region aligns with the quotation;
- printed-page metadata is treated as a label, not the primary identity.

### 3. Claim support

A real passage can still be misused. Claim support must be classified separately as:

- directly supported;
- partially supported;
- contradicted;
- context only;
- ambiguous;
- no supporting passage found.

The verifier must examine whether the claim adds certainty, scope, causation, amount, date, intent, or legal significance not present in the source.

### 4. Scope and attribution

- the asserting party or author is correct;
- quoted text is not attributed to the court when it came from a party submission;
- allegation, evidence, and finding are not conflated;
- a document reference is not treated as proof that the referenced document was uploaded or verified.

## Citation lifecycle

Suggested states:

- `located` — source location exists;
- `source_verified` — source integrity and location checks pass;
- `support_verified` — the passage supports the claim at the stated scope;
- `partially_supported`;
- `contradicted`;
- `ambiguous`;
- `invalid`;
- `reviewed` — an authorized user has reviewed the relationship.

## OCR-sensitive citations

A citation relying on OCR must preserve the page image and extraction confidence. Critical tokens require heightened review:

- negations;
- dates;
- monetary amounts;
- percentages;
- party names;
- statutory or contractual clause numbers;
- words that reverse obligations or permissions.

Low-confidence OCR must not be hidden by a high-confidence language-model conclusion.

## Export requirements

A reviewed report or outline should allow a recipient to:

1. identify the original file;
2. open the exact page;
3. see the highlighted source passage;
4. distinguish printed and PDF pagination;
5. see whether the support relationship was AI-verified, human-reviewed, or unresolved.

## Forbidden citation behavior

- citing a page selected only because it is semantically similar;
- quoting text that does not exist verbatim without labeling it as a paraphrase;
- citing one passage for a compound claim when it supports only part;
- silently substituting a regenerated or normalized file for the original identity;
- using a citation from another matter;
- presenting a legal authority citation without a separately governed authority-verification process.

## Phase 1 implication

Secure ingestion is not complete until every extracted span can reopen the correct original page and the system can disclose when text and page identity are uncertain.
