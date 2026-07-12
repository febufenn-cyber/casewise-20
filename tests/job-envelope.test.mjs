import test from "node:test";
import assert from "node:assert/strict";
import { createJobEnvelope, verifyJobEnvelope } from "../packages/core/src/job-envelope.mjs";
const secret = "01234567890123456789012345678901";
const input = { jobId: "job-1", organizationId: "org-1", matterId: "matter-1", fileId: "file-1", stage: "intake_file", pipelineVersion: "phase1.0.0", ttlSeconds: 100 };
test("worker envelope is bound to stored scope", async () => { const { token } = await createJobEnvelope(input, secret, 100); assert.equal((await verifyJobEnvelope(token, input, secret, 110)).file_id, "file-1"); await assert.rejects(() => verifyJobEnvelope(token, { ...input, matterId: "matter-2" }, secret, 110), /mismatch/); });
test("unsupported processing stage cannot be signed", async () => { await assert.rejects(() => createJobEnvelope({ ...input, stage: "summarize" }, secret, 100), /unsupported/); });
