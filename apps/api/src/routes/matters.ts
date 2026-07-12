import { Hono } from "hono";
import type { Env, Variables } from "../env";
import { audit } from "../lib/audit";
import { ApiError, readJson } from "../lib/http";
import { serviceRest, userRest } from "../lib/supabase";

export const matters = new Hono<{ Bindings: Env; Variables: Variables }>();

matters.get("/", async (c) => {
  const rows = await userRest(c.env, c.get("accessToken"), "/matters?select=id,organization_id,title,status,created_at&order=created_at.desc");
  return c.json({ data: rows });
});

matters.post("/", async (c) => {
  const body = await readJson<{ organization_id?: string; title?: string }>(c.req.raw);
  if (!body.organization_id || !body.title?.trim()) throw new ApiError(400, "organization_id and title are required", "invalid_request");
  const user = c.get("user");
  const memberships = await userRest(c.env, c.get("accessToken"), `/organization_memberships?organization_id=eq.${encodeURIComponent(body.organization_id)}&user_id=eq.${user.id}&status=eq.active&select=role&limit=1`);
  if (!memberships?.length) throw new ApiError(403, "Organization access denied", "forbidden");
  const matterId = crypto.randomUUID();
  await serviceRest(c.env, "/matters", { method: "POST", prefer: "return=minimal", body: JSON.stringify({ id: matterId, organization_id: body.organization_id, title: body.title.trim(), status: "active", created_by: user.id }) });
  await serviceRest(c.env, "/matter_memberships", { method: "POST", prefer: "return=minimal", body: JSON.stringify({ matter_id: matterId, user_id: user.id, role: "matter_manager", status: "active" }) });
  await audit(c.env, { organization_id: body.organization_id, matter_id: matterId, actor_id: user.id, action: "matter.created", resource_type: "matter", resource_id: matterId, request_id: c.get("requestId") });
  return c.json({ data: { id: matterId, title: body.title.trim(), status: "active" } }, 201);
});
