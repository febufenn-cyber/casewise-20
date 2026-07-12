import type { Env } from "../env";
import { serviceRest } from "./supabase";
import { sanitizeMetadata } from "../../../../packages/core/src/logging.mjs";

export async function audit(env: Env, event: {
  organization_id: string; matter_id?: string | null; actor_id?: string | null; action: string;
  resource_type: string; resource_id?: string | null; outcome?: "success" | "denied" | "failed";
  request_id?: string | null; metadata?: Record<string, unknown>;
}) {
  await serviceRest(env, "/audit_events", { method: "POST", prefer: "return=minimal", body: JSON.stringify({
    ...event, matter_id: event.matter_id ?? null, actor_id: event.actor_id ?? null, resource_id: event.resource_id ?? null,
    outcome: event.outcome ?? "success", request_id: event.request_id ?? null, metadata: sanitizeMetadata(event.metadata ?? {}),
  }) });
}
