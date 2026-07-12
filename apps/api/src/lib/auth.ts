import type { MiddlewareHandler } from "hono";
import type { Env, Variables } from "../env";
import { ApiError } from "./http";

export interface User { id: string; email?: string; app_metadata?: Record<string, unknown>; }

export const requestContext: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (c, next) => {
  c.set("requestId", c.req.header("cf-ray") ?? crypto.randomUUID());
  await next();
  c.header("x-request-id", c.get("requestId"));
  c.header("cache-control", "no-store");
  c.header("x-content-type-options", "nosniff");
  c.header("referrer-policy", "no-referrer");
};

export const requireAuth: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (c, next) => {
  const authorization = c.req.header("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new ApiError(401, "Bearer token required", "unauthorized");
  const accessToken = match[1];
  const response = await fetch(`${c.env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: c.env.SUPABASE_ANON_KEY, authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new ApiError(401, "Invalid or expired session", "unauthorized");
  const user = await response.json<User>();
  c.set("user", user);
  c.set("accessToken", accessToken);
  await next();
};
