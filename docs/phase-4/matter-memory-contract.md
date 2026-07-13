# Matter memory and delta approval contract

Matter memory is populated only from one attorney-approved delta snapshot. Approval is version-specific and does not transfer automatically to later delta runs.

## Approval blockers

A delta snapshot cannot be approved while:

- an ambiguous cross-version match remains unresolved;
- any active critical or high-materiality delta remains unreviewed;
- any active lower-materiality delta remains unreviewed;
- a required prior or current source span is missing;
- a rejected or stale item is still presented as active.

## Matter memory

Approval creates a new immutable matter-memory snapshot. Every entry preserves:

- its originating delta snapshot and item;
- prior and current filing-version identifiers;
- prior and current source spans;
- party and logical-document context;
- change classification, materiality, and reviewed details.

Previous memory snapshots are superseded rather than overwritten. Matter memory is an auditable history of reviewed changes, not a generated narrative and not a legal conclusion.
