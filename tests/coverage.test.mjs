import test from "node:test";
import assert from "node:assert/strict";
import { summarizeCoverage, canRepresentAsComplete } from "../packages/core/src/coverage.mjs";
test("unreadable pages prevent complete status", () => { const summary = summarizeCoverage([{ status: "processed" }, { status: "unreadable" }]); assert.equal(summary.overall, "partial_success"); assert.equal(canRepresentAsComplete(summary), false); });
test("warnings remain visible", () => { assert.equal(summarizeCoverage([{ status: "processed_with_warning" }]).overall, "complete_with_warnings"); });
