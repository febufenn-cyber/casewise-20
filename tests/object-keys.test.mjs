import test from "node:test";
import assert from "node:assert/strict";
import { originalObjectKey, derivedObjectKey, normalizeRelativeArtifactPath } from "../packages/core/src/object-keys.mjs";
const ids = { organizationId: "11111111-1111-4111-8111-111111111111", matterId: "22222222-2222-4222-8222-222222222222", uploadId: "33333333-3333-4333-8333-333333333333", fileId: "44444444-4444-4444-8444-444444444444", runId: "55555555-5555-4555-8555-555555555555" };
test("original keys never include user filenames", () => { const key = originalObjectKey(ids); assert.match(key, /^quarantine\/organizations\//); assert.doesNotMatch(key, /claim|pdf/i); });
test("derived paths are matter-scoped and traversal-safe", () => { const key = derivedObjectKey({ ...ids, relativePath: "pages/page-0001.png" }); assert.match(key, /page-0001\.png$/); assert.throws(() => normalizeRelativeArtifactPath("../secret"), /unsafe/); });
