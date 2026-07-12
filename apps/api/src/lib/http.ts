import type { Context } from "hono";
import type { Env, Variables } from "../env";

export class ApiError extends Error {
  constructor(public status: number, message: string, public code = "api_error", public details?: unknown) {
    super(message);
  }
}

export function jsonError(c: Context<{ Bindings: Env; Variables: Variables }>, error: unknown) {
  if (error instanceof ApiError) {
    return c.json({ error: { code: error.code, message: error.message, details: error.details ?? null }, request_id: c.get("requestId") }, error.status as 400);
  }
  console.error("unhandled_error", { request_id: c.get("requestId"), error_name: error instanceof Error ? error.name : "unknown" });
  return c.json({ error: { code: "internal_error", message: "An unexpected error occurred" }, request_id: c.get("requestId") }, 500);
}

export async function readJson<T>(request: Request): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) throw new ApiError(415, "Content-Type must be application/json", "unsupported_media_type");
  try { return await request.json<T>(); }
  catch { throw new ApiError(400, "Invalid JSON body", "invalid_json"); }
}
