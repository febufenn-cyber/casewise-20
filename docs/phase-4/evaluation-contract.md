# Phase 4 evaluation contract

Phase 4 is evaluated on frozen, permissible, versioned matter packs with independently annotated changes. Evaluation measures whether Casewise finds and classifies reviewed graph changes accurately and whether lawyers review them faster than rebuilding a matter note manually.

## Required observations

Each observation records:

- the expected change and predicted change;
- true positive, false positive, false negative, type mismatch, or material omission;
- materiality;
- the associated delta item when one exists;
- whether both prior and current source locations were independently reopened and verified;
- evaluator notes.

A type mismatch counts against both precision and recall. A material omission is tracked separately and also counts as a false negative.

## Required metrics

- precision;
- recall;
- F1;
- material-omission count;
- source-pair failure count;
- baseline manual-review minutes;
- Casewise review minutes;
- absolute and proportional time savings.

## Provisional gate

The repository defaults are hypotheses until calibrated with design partners:

- at least 20 observations per evaluated pack or aggregate gate;
- precision of at least 0.90;
- recall of at least 0.90;
- zero material omissions;
- zero source-pair failures;
- at least 25% review-time savings.

A small sample is incomplete rather than passed. Metrics are evaluation evidence, not confidence scores for individual legal conclusions. Passing repository tests does not substitute for evaluation on permissible legal matter packs.
