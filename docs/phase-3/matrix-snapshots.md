# Matter matrix snapshot contract

A matter matrix snapshot is an immutable versioned view over reviewed allegations, mapped responses, evidence relationships, contradiction candidates, missing-information items, and processing coverage.

Each row remains anchored to one allegation and preserves response classifications, response-search coverage, evidence-support states, contradiction decisions, missing-information status, warnings, and readiness state.

The snapshot may be ready, review required, blocked, attorney approved, rejected, superseded, stale, or deleted. Attorney approval is rejected while any blocked or review-required row remains, while processing failures are present, or while material contradiction and missing-information gates remain open.

Approval applies only to that exact snapshot version. Later corrections make dependent snapshots stale and require targeted rebuilding.
