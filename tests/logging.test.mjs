import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeMetadata } from "../packages/core/src/logging.mjs";
test("ordinary telemetry strips secrets and document content", () => {
  const sanitized = sanitizeMetadata({ job_id: "job-1", authorization: "Bearer secret", nested: { source_text: "privileged matter passage", error_code: "ocr_failed" } });
  assert.equal(sanitized.authorization, "[redacted]");
  assert.equal(sanitized.nested.source_text, "[redacted]");
  assert.equal(sanitized.nested.error_code, "ocr_failed");
});
