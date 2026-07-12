# Provider Due-Diligence Checklist

Complete this checklist before sending confidential pilot material to any model, OCR, storage, analytics, logging, or support provider.

## Provider identity and service

- provider and product name;
- contracted entity;
- service purpose;
- data categories received;
- whether full files, page images, text spans, prompts, outputs, metadata, or identifiers are sent;
- production region and possible transfer locations;
- subprocessors relevant to the workflow.

## Retention and deletion

- default request retention;
- configurable zero- or reduced-retention mode;
- output retention;
- abuse-monitoring retention;
- backup retention;
- deletion mechanism and expected completion;
- whether API deletion covers derived provider artifacts;
- evidence available for deletion settings.

## Training and product improvement

- whether inputs or outputs are used for model training;
- whether they are used for human review or product improvement;
- opt-out mechanism and contractual enforceability;
- treatment of metadata and feedback;
- difference between consumer and enterprise/API terms.

## Access and security

- employee access policy;
- support access process;
- encryption in transit and at rest;
- tenant separation;
- authentication and key management;
- audit or compliance reports available;
- incident-notification terms;
- vulnerability and penetration-testing posture;
- data-export or exfiltration controls.

## Contract and governance

- data-processing agreement availability;
- confidentiality obligations;
- controller/processor roles where relevant;
- subprocessor notice and objection process;
- breach responsibilities;
- liability and indemnity limitations;
- termination and data return/deletion;
- acceptable-use restrictions affecting legal documents;
- law and dispute venue;
- ability to support customer contractual commitments.

## Technical minimization

- can Casewise send selected spans instead of full files?
- can identifiers be pseudonymized?
- can provider-side storage be disabled?
- can logs omit request bodies?
- can processing be pinned to approved models and regions?
- can retries and fallbacks avoid unapproved providers?

## Decision record

```text
Provider:
Operation:
Data sent:
Approved environments:
Approved matter classes:
Retention setting:
Training setting:
Region:
Subprocessors reviewed:
Contract/DPA status:
Known gaps:
Risk owner:
Approval date:
Review date:
Decision: approved / restricted / rejected / pending
```

A provider is not approved merely because it is technically accessible or commonly used. Approval is operation-specific and may differ for public evaluation packs, synthetic data, redacted pilots, and confidential production matters.
