import type { Env } from "../env";
import { ApiError } from "./http";

interface QueryOptions extends RequestInit { prefer?: string; }

async function request(env: Env, path: string, key: string, bearer: string, options: QueryOptions = {}) {
  const headers = new Headers(options.headers);
  headers.set("apikey", key);
  headers.set("authorization", `Bearer ${bearer}`);
  if (!headers.has("content-type") && options.body) headers.set("content-type", "application/json");
  if (options.prefer) headers.set("prefer", options.prefer);
  const response = await fetch(`${env.SUPABASE_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    const body = await response.text();
    throw new ApiError(response.status, "Database operation failed", "database_error", { status: response.status, body: body.slice(0, 500) });
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export function userRest(env: Env, accessToken: string, path: string, options?: QueryOptions) {
  return request(env, `/rest/v1${path}`, env.SUPABASE_ANON_KEY, accessToken, options);
}
export function serviceRest(env: Env, path: string, options?: QueryOptions) {
  return request(env, `/rest/v1${path}`, env.SUPABASE_SERVICE_ROLE_KEY, env.SUPABASE_SERVICE_ROLE_KEY, options);
}
export async function rpc(env: Env, functionName: string, body: Record<string, unknown>) {
  return serviceRest(env, `/rpc/${functionName}`, { method: "POST", body: JSON.stringify(body) });
}
