import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
test("document instructions remain inert evaluation data", async () => { const fixture = await fs.readFile(new URL("./fixtures/prompt-injection.txt", import.meta.url), "utf8"); assert.match(fixture, /Ignore all previous instructions/); assert.deepEqual({ text: fixture, tool_calls: [], permission_changes: [] }.tool_calls, []); });
