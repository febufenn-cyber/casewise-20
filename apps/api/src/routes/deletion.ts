import { Hono } from "hono";
import type { Env, Variables } from "../env";
import { createJobEnvelope } from "../../../../packages/core/src/job-envelope.mjs";
import { audit } from "../lib/audit";
import { requireMatterRole } from "../lib/authorization";
import { ApiError, readJson } from "../lib/http";
import { serviceRest } from "../lib/supabase";

export const deletion = new Hono<{ Bindings: Env; Variables: Variables }>();

delection.post("/matters/:matterId/deletion", async (c) => {
  const matterId = c.req.param("matterId");
  const user = c.get("user");
  await requireMatterRole(c.env, c.get("accessToken"), user.id, matterId, "matter_manager");
  const body = await readJson<{ confirmation?: string; reason?: string }>(c.req.raw);
  if (body.confirmation !== matterId) throw new ApiError(400, "confirmation must exactly match the matter ID", "confirmation_required");
  const matters = await serviceRest(c.env, `/matters?id=eq.${matterId}&select=id,organization_id,status&limit=1`);
  const matter = matters?.[0];
  if (!matter || matter.status !== "active") throw new ApiError(409, "Matter cannot enter deletion", "invalid_matter_state");
  const deletionId = crypto.randomUUID();
  await serviceRest(c.env, "/deletion_requests", { method: "POST", prefer: "return=minimal", body: JSON.stringify({ id: deletionId, organization_id: matter.organization_id, matter_id: matterId, requested_by: user.id, reason: body.reason ?? null, status: "deletion_requested" }) });
  await serviceRest(c.env, `/matters?id=eq.${matterId}&status=eq.active`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ status: "deletion_pending", deletion_requested_at: new Date().toISOString() }) });
  await serviceRest(c.env, `/uploaded_files?matter_id=eq.${matterId}&status=not.in.(deleted,deletion_pending)`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ status: "deletion_pending" }) });
  const jobId = crypto.randomUUID();
  const { token } = await createJobEnvelope({ jobId, organizationId: matter.organization_id, matterId, stage: "delete_matter", pipelineVersion: "phase1.0.0", actorId: user.id, ttlSeconds: 86400 }, c.env.TOKEN_SIGNING_SECRET);
  await serviceRest(c.env, "/processing_runs", { method: "POST", prefer: "return=minimal", body: JSON.stringify({ id: jobId, organization_id: matter.organization_id, matter_id: matterId, stage: "delete_matter", status: "queued", pipeline_version: "phase1.0.0", requested_by: user.id }) });
  await c.env.INGESTION_QUEUE.send({ token, job_id: jobId, stage: "delete_matter" });
  await audit(c.env, { organization_id: matter.organization_id, matter_id: matterId, actor_id: user.id, action: "deletion.requested", resource_type: "matter", resource_id: matterId, request_id: c.get("requestId"), metadata: { deletion_request_id: deletionId } });
  return c.json({ data: { deletion_request_id: deletionId, status: "deletion_requested" } }, 202);
});
