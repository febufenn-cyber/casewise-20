# Delta matching contract

Cross-version matching proposes identity continuity between frozen filing-version members. It does not decide whether a changed proposition is true and does not modify either source version.

## Matching rules

- members are compared only within the same object type;
- exact canonical fingerprints produce exact matches;
- probable matches expose their component features and similarity score;
- close competing candidates remain ambiguous;
- unmatched current members are recorded as new;
- unmatched prior members are recorded as removed;
- ambiguous matches require reviewer resolution before a delta snapshot can be approved;
- a rejected candidate remains in review history and is not silently deleted.

Similarity is only a routing aid. It is not a legal confidence score and must not be displayed as a probability that the propositions are equivalent.
