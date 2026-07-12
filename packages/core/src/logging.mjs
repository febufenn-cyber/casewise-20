const SENSITIVE_KEYS = /(?:token|authorization|cookie|secret|password|signed_url|document_text|source_text|prompt|response_body)/i;

export function sanitizeMetadata(value, depth = 0) {
  if (depth > 5) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeMetadata(item, depth + 1));
  if (value && typeof value === "object") {
    const output = {};
    for (const [key, item] of Object.entries(value)) output[key] = SENSITIVE_KEYS.test(key) ? "[redacted]" : sanitizeMetadata(item, depth + 1);
    return output;
  }
  if (typeof value === "string") return value.length > 256 ? `${value.slice(0, 256)}…` : value;
  return value;
}
