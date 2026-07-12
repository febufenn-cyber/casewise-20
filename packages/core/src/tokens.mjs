const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

export async function signScopedToken(payload, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!secret || secret.length < 32) throw new Error("token secret must contain at least 32 characters");
  const body = { v: 1, iat: nowSeconds, ...payload };
  if (!Number.isInteger(body.exp) || body.exp <= nowSeconds) throw new Error("token expiry must be in the future");
  const encoded = base64UrlEncode(encoder.encode(JSON.stringify(body)));
  const signature = base64UrlEncode(await hmac(secret, encoded));
  return `${encoded}.${signature}`;
}

export async function verifyScopedToken(token, secret, expectations = {}, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (typeof token !== "string") throw new Error("token is required");
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) throw new Error("malformed token");
  const expectedSignature = await hmac(secret, encoded);
  const providedSignature = base64UrlDecode(signature);
  if (providedSignature.byteLength !== expectedSignature.byteLength) throw new Error("invalid token signature");
  const valid = await crypto.subtle.verify(
    "HMAC",
    await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]),
    providedSignature,
    encoder.encode(encoded),
  );
  if (!valid) throw new Error("invalid token signature");
  const payload = JSON.parse(decoder.decode(base64UrlDecode(encoded)));
  if (payload.v !== 1) throw new Error("unsupported token version");
  if (!Number.isInteger(payload.exp) || payload.exp < nowSeconds) throw new Error("token expired");
  for (const [key, expected] of Object.entries(expectations)) {
    if (expected !== undefined && payload[key] !== expected) throw new Error(`token ${key} mismatch`);
  }
  return payload;
}

export async function sha256Hex(input) {
  const bytes = typeof input === "string" ? encoder.encode(input) : input;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
