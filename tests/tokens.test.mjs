import test from "node:test";
import assert from "node:assert/strict";
import { signScopedToken, verifyScopedToken, sha256Hex } from "../packages/core/src/tokens.mjs";
const secret = "01234567890123456789012345678901";
test("scoped tokens verify expected scope", async () => {
  const token = await signScopedToken({ action: "upload_content", object_key: "one", exp: 110 }, secret, 100);
  const payload = await verifyScopedToken(token, secret, { action: "upload_content", object_key: "one" }, 105);
  assert.equal(payload.action, "upload_content");
});
test("scoped tokens reject mismatch", async () => {
  const token = await signScopedToken({ action: "upload_content", object_key: "one", exp: 110 }, secret, 100);
  await assert.rejects(() => verifyScopedToken(token, secret, { object_key: "two" }, 105), /mismatch/);
});
test("scoped tokens reject expiry and tampering", async () => {
  const token = await signScopedToken({ action: "download", exp: 110 }, secret, 100);
  await assert.rejects(() => verifyScopedToken(token, secret, {}, 111), /expired/);
  const tampered = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;
  await assert.rejects(() => verifyScopedToken(tampered, secret, {}, 105), /signature/);
});
test("sha256Hex is deterministic", async () => {
  assert.equal(await sha256Hex("casewise"), "261a72bc9347e2f1599885c97f267f125b549ecab261cf1bc747fc3321c3ee43");
});
