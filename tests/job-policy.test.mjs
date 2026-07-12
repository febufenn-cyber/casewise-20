import test from "node:test";
import assert from "node:assert/strict";
import { matterAllowsStage } from "../packages/core/src/job-policy.mjs";

test("normal processing requires an active matter", () => {
  assert.equal(matterAllowsStage("active", "intake_file"), true);
  assert.equal(matterAllowsStage("deletion_pending", "intake_file"), false);
  assert.equal(matterAllowsStage("deleted", "process_pdf"), false);
});

test("deletion jobs may finish after access revocation", () => {
  assert.equal(matterAllowsStage("active", "delete_matter"), true);
  assert.equal(matterAllowsStage("deletion_pending", "delete_matter"), true);
  assert.equal(matterAllowsStage("deleted", "delete_matter"), false);
});
