import { Hono } from "hono";
import type { Env, Variables } from "../env";
import { acceptedOriginalKey, originalObjectKey } from "../../../../packages/core/src/object-keys.mjs";
import { signScopedToken, verifyScopedToken } from "../../../../packages/core/src/tokens.mjs";
import { audit } from "../lib/audit";
import { requireMatterRole } from "../lib/authorization";
import { ApiError, readJson } from "../lib/http";
import { serviceRest } from "../lib/supabase";

export const uploads = new Hono<{ Bindings: Env; Variables: Variables }>();

async function session(env: Env, id: string) {
  const rows = await serviceRest(env, `/upload_sessions?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
  if (!rows?.length) throw new ApiError(404, "Upload session not found", "not_found");
  return rows[0];
}
async function file(env: Env, id: string) {
  const rows = await serviceRest(env, `/uploaded_files?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
  if (!rows?.length) throw new ApiError(404, "File not found", "not_found");
  return rows[0];
}

uploads.post("/matters/:matterId/uploads", async (c) => {
  const matterId = c.req.param("matterId");
  const user = c.get("user");
  await requireMatterRole(c.env, c.get("accessToken"), user.id, matterId, "editor");
  const body = await readJson<{ filename?: string; declared_media_type?: string; declared_size_bytes?: number }>(c.req.raw);
  if (!body.filename?.trim()) throw new ApiError(400, "filename is required", "invalid_request");
  if (body.declared_media_type !== "application/pdf") throw new ApiError(415, "Only PDFs are supported", "unsupported_media_type");
  const max = Number(c.env.MAX_UPLOAD_BYTES);
  if (!Number.isInteger(body.declared_size_bytes) || body.declared_size_bytes! < 1 || body.declared_size_bytes! > max) throw new ApiError(413, "Invalid file size", "file_too_large");
  const matter = (await serviceRest(c.env, `/matters?id=eq.${matterId}&select=id,organization_id,status&limit=1`))?.[0];
  if (!matter || matter.status !== "active") throw new ApiError(409, "Matter unavailable", "matter_unavailable");
  const uploadId = crypto.randomUUID();
  const objectKey = originalObjectKey({ organizationId: matter.organization_id, matterId, uploadId });
  const ttl = Number(c.env.UPLOAD_TOKEN_TTL_SECONDS);
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
  await serviceRest(c.env, "/upload_sessions", { method: "POST", prefer: "return=minimal", body: JSON.stringify({ id: uploadId, organization_id: matter.organization_id, matter_id: matterId, created_by: user.id, original_filename: body.filename.trim(), declared_media_type: body.declared_media_type, declared_size_bytes: body.declared_size_bytes, object_key: objectKey, status: "authorized", expires_at: expiresAt }) });
  const now = Math.floor(Date.now() / 1000);
  const token = await signScopedToken({ action: "upload_content", upload_session_id: uploadId, object_key: objectKey, exp: now + ttl }, c.env.TOKEN_SIGNING_SECRET, now);
  await audit(c.env, { organization_id: matter.organization_id, matter_id: matterId, actor_id: user.id, action: "upload.initiated", resource_type: "upload_session", resource_id: uploadId, request_id: c.get("requestId") });
  return c.json({ data: { upload_session_id: uploadId, upload_url: `${c.env.PUBLIC_BASE_URL}/api/uploads/${uploadId}/content?token=${encodeURIComponent(token)}`, expires_at: expiresAt } }, 201);
});

uploads.put("/uploads/:uploadId/content", async (c) => {
  const uploadId = c.req.param("uploadId");
  const current = await session(c.env, uploadId);
  await verifyScopedToken(c.req.query("token"), c.env.TOKEN_SIGNING_SECRET, { action: "upload_content", upload_session_id: uploadId, object_key: current.object_key });
  if (current.status !== "authorized") throw new ApiError(409, "Upload session is closed", "upload_session_closed");
  if (new Date(current.expires_at).getTime() < Date.now()) throw new ApiError(410, "Upload session expired", "upload_session_expired");
  const length = Number(c.req.header("content-length"));
  if (length !== current.declared_size_bytes || !c.req.raw.body) throw new ApiError(400, "Upload size mismatch", "size_mismatch");
  if (await c.env.EVIDENCE_BUCKET.head(current.object_key)) throw new ApiError(409, "Immutable object conflict", "immutable_object_conflict");
  await c.env.EVIDENCE_BUCKET.put(current.object_key, c.req.raw.body, { httpMetadata: { contentType: "application/pdf" }, customMetadata: { upload_session_id: uploadId, matter_id: current.matter_id } });
  await serviceRest(c.env, `/upload_sessions?id=eq.${uploadId}&status=eq.authorized`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ status: "uploaded", uploaded_at: new Date().toISOString() }) });
  return c.json({ data: { upload_session_id: uploadId, status: "uploaded" } });
});

uploads.post("/uploads/:uploadId/finalize", async (c) => {
  const current = await session(c.env, c.req.param("uploadId"));
  const user = c.get("user");
  await requireMatterRole(c.env, c.get("accessToken"), user.id, current.matter_id, "editor");
  if (current.created_by !== user.id || current.status !== "uploaded") throw new ApiError(409, "Upload is not finalizable", "invalid_upload_state");
  const object = await c.env.EVIDENCE_BUCKET.head(current.object_key);
  if (!object || object.size !== current.declared_size_bytes) throw new ApiError(409, "Stored object mismatch", "stored_object_mismatch");
  const fileId = crypto.randomUUID();
  await serviceRest(c.env, "/uploaded_files", { method: "POST", prefer: "return=minimal", body: JSON.stringify({ id: fileId, organization_id: current.organization_id, matter_id: current.matter_id, upload_session_id: current.id, original_filename: current.original_filename, media_type: "application/pdf", size_bytes: object.size, original_object_key: current.object_key, accepted_object_key: acceptedOriginalKey({ organizationId: current.organization_id, matterId: current.matter_id, fileId }), status: "quarantined", created_by: user.id }) });
  await serviceRest(c.env, `/upload_sessions?id=eq.${current.id}`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ status: "finalized", finalized_at: new Date().toISOString(), uploaded_file_id: fileId }) });
  await audit(c.env, { organization_id: current.organization_id, matter_id: current.matter_id, actor_id: user.id, action: "upload.finalized", resource_type: "uploaded_file", resource_id: fileId, request_id: c.get("requestId") });
  return c.json({ data: { file_id: fileId, status: "quarantined", next: "processing_pipeline" } }, 201);
});

uploads.post("/files/:fileId/download-token", async (c) => {
  const current = await file(c.env, c.req.param("fileId"));
  const user = c.get("user");
  await requireMatterRole(c.env, c.get("accessToken"), user.id, current.matter_id, "viewer");
  const now = Math.floor(Date.now() / 1000);
  const token = await signScopedToken({ action: "download_original", file_id: current.id, object_key: current.original_object_key, exp: now + Number(c.env.DOWNLOAD_TOKEN_TTL_SECONDS) }, c.env.TOKEN_SIGNING_SECRET, now);
  return c.json({ data: { url: `${c.env.PUBLIC_BASE_URL}/api/files/${current.id}/content?token=${encodeURIComponent(token)}` } });
});

uploads.get("/files/:fileId/content", async (c) => {
  const current = await file(c.env, c.req.param("fileId"));
  await verifyScopedToken(c.req.query("token"), c.env.TOKEN_SIGNING_SECRET, { action: "download_original", file_id: current.id, object_key: current.original_object_key });
  const object = await c.env.EVIDENCE_BUCKET.get(current.original_object_key);
  if (!object) throw new ApiError(404, "Stored file not found", "not_found");
  return new Response(object.body, { headers: { "content-type": "application/pdf", "cache-control": "private, no-store" } });
});
