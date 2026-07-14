# Phase 5 evaluation contract

Phase 5 promotion is based on independently annotated artifact observations, not repository test success or demonstration quality.

## Evaluation unit

Every run is locked to:

- one active attorney-approved matter-overview snapshot;
- one active attorney-approved response-plan snapshot tied to that overview;
- optionally, one active internal-export package created from those exact versions;
- one named permissible evaluation pack;
- independently recorded manual and Casewise review times.

## Observation types

### Overview sentence

Checks whether an exact overview sentence:

- has the expected structured support;
- reopens the correct source location;
- preserves attribution, disputes, uncertainty and omissions;
- contains unsupported material language;
- required minor, major or material correction;
- omitted a material proposition.

### Response-plan node

Checks whether an exact planning node:

- belongs to the locked allegation row;
- has expected structured and source support;
- is correctly typed as factual work, evidence verification, client question, contradiction resolution, authority-research task or internal note;
- required correction or omitted material work.

### Stale propagation

Checks whether changing an upstream sentence, source span or structured object invalidated every affected overview, plan, approval and export package.

## Metrics

- citation fidelity;
- unsupported material-language count and rate;
- sentence support coverage;
- response-plan-node support coverage;
- material omissions;
- stale-propagation failures;
- minor, major and material corrections;
- manual baseline time;
- Casewise review time;
- absolute and fractional time savings.

## Provisional gates

The default repository thresholds require:

- at least 20 observations;
- overview, plan and stale-propagation samples;
- citation fidelity of at least 99%;
- zero unsupported material-language rate;
- at least 98% sentence support coverage;
- at least 98% plan-node support coverage;
- zero material omissions;
- zero stale-propagation failures;
- zero material corrections;
- at least 25% review-time savings.

These thresholds are provisional until calibrated with permissible design-partner matter packs. A small or incomplete sample returns `incomplete`; a material defect returns `failed`.

## Trust boundary

A passing repository fixture does not establish legal accuracy, production security or customer value. Phase 6 production use remains blocked until the Phase 1 security controls and Phase 5 real-matter gates are independently verified.
