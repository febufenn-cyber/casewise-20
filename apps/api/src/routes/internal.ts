import { Hono } from "hono";
import type { Env, Variables } from "../env";
import { derivedObjectKey, normalizeRelativeArtifactPath } from "../../../../packages/core/src/object-keys.mjs";
import { verifyScopedToken } from "../../../../packages/core/src/tokens.mjs";
import { ApiError } from "../lib/http";
import { verifyProcessorSignature } from "../lib/job-runtime";
import { serviceRest } from "../lib/supabase";

export const internal = new Hono<{ Bindings: Env; Variables: Variables }>();
async function run(env: Env, id: string) { const rows = await serviceRest(env, `/processing_runs?id=eq.${encodeURIComponent(id)}&select=*`); if (!rows?.length) throw new ApiError(404, "Processing run not found", "not_found"); return rows[0]; }

internal.get("/jobs/:jobId/input", async (c) => {
  const job = await run(c.env, c.req.param("jobId")); const file = (await serviceRest(c.env, `/uploaded_files?id=eq.${job.uploaded_file_id}&select=*`))?.[0]; if (!file) throw new ApiError(404, "Input file not found", "not_found");
  await verifyScopedToken(c.req.query("token"), c.env.TOKEN_SIGNING_SECRET, { action: "processor_download", job_id: job.id, file_id: file.id, object_key: file.original_object_key });
  if (job.status !== "running" || ["deletion_pending", "deleted"].includes(file.status)) throw new ApiError(409, "Input unavailable", "job_unavailable");
  const object = await c.env.EVIDENCE_BUCKET.get(file.original_object_key); if (!object) throw new ApiError(404, "Input object not found", "not_found");
  return new Response(object.body, { headers: { "content-type": "application/pdf", "cache-control": "no-store" } });
});

internal.put("/jobs/:jobId/artifacts/*", async (c) => {
  const job = await run(c.env, c.req.param("jobId"));
  await verifyScopedToken(c.req.query("token"), c.env.TOKEN_SIGNING_SECRET, { action: "processor_artifact_upload", job_id: job.id, organization_id: job.organization_id, matter_id: job.matter_id, file_id: job.uploaded_file_id });
  if (job.status !== "running" || !c.req.raw.body) throw new ApiError(409, "Job does not accept artifacts", "job_unavailable");
  const relativePath = normalizeRelativeArtifactPath(c.req.path.split(`/internal/jobs/${job.id}/artifacts/`)[1] ?? "");
  const key = derivedObjectKey({ organizationId: job.organization_id, matterId: job.matter_id, fileId: job.uploaded_file_id, runId: job.id, relativePath });
  await c.env.EVIDENCE_BUCKET.put(key, c.req.raw.body, { httpMetadata: { contentType: c.req.header("content-type") ?? "application/octet-stream" }, customMetadata: { processing_run_id: job.id, relative_path: relativePath } });
  await serviceRest(c.env, "/stored_objects", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: JSON.stringify({ organization_id: job.organization_id, matter_id: job.matter_id, uploaded_file_id: job.uploaded_file_id, processing_run_id: job.id, object_key: key, object_class: "derived", media_type: c.req.header("content-type") ?? "application/octet-stream", status: "active" }) });
  return c.json({ data: { object_key: key } }, 201);
});

internal.post("/jobs/:jobId/complete", async (c) => {
  const raw = await c.req.text(); if (!(await verifyProcessorSignature(raw, c.req.header("x-casewise-signature"), c.env.PROCESSOR_SHARED_SECRET))) throw new ApiError(401, "Invalid processor signature", "unauthorized");
  const job = await run(c.env, c.req.param("jobId")); if (job.status !== "running") throw new ApiError(409, "Job cannot complete", "job_unavailable");
  const result = JSON.parse(raw) as { status: string; sha256?: string; page_count?: number; pages?: Array<{ pdf_page_index: number; width_points?: number; height_points?: number; rotation_degrees?: number; render_path?: string; text_path?: string; extraction_method?: string; text_length?: number; warnings?: string[] }>; file_warnings?: string[]; error_code?: string };
  if (result.sha256 && !/^[a-f0-9]{64}$/.test(result.sha256)) throw new ApiError(400, "Invalid SHA-256", "invalid_processor_result");
  for (const page of result.pages ?? []) {
    const pageId = crypto.randomUUID(); const warning = Boolean(page.warnings?.length);
    await serviceRest(c.env, "/pages", { method: "POST", prefer: "return=minimal", body: JSON.stringify({ id: pageId, organization_id: job.organization_id, matter_id: job.matter_id, uploaded_file_id: job.uploaded_file_id, processing_run_id: job.id, pdf_page_index: page.pdf_page_index, width_points: page.width_points ?? null, height_points: page.height_points ?? null, rotation_degrees: page.rotation_degrees ?? 0, status: warning ? "processed_with_warning" : "processed", warnings: page.warnings ?? [] }) });
    if (page.render_path) await serviceRest(c.env, "/page_renders", { method: "POST", prefer: "return=minimal", body: JSON.stringify({ page_id: pageId, processing_run_id: job.id, object_key: derivedObjectKey({ organizationId: job.organization_id, matterId: job.matter_id, fileId: job.uploaded_file_id, runId: job.id, relativePath: page.render_path }), render_version: job.pipeline_version, status: "active" }) });
    if (page.text_path) await serviceRest(c.env, "/text_extractions", { method: "POST", prefer: "return=minimal", body: JSON.stringify({ page_id: pageId, processing_run_id: job.id, object_key: derivedObjectKey({ organizationId: job.organization_id, matterId: job.matter_id, fileId: job.uploaded_file_id, runId: job.id, relativePath: page.text_path }), extraction_method: page.extraction_method ?? "native_text", extraction_version: job.pipeline_version, character_count: page.text_length ?? 0, status: warning ? "processed_with_warning" : "processed", warnings: page.warnings ?? [] }) });
    await serviceRest(c.env, "/coverage_entries", { method: "POST", prefer: "return=minimal", body: JSON.stringify({ organization_id: job.organization_id, matter_id: job.matter_id, uploaded_file_id: job.uploaded_file_id, page_id: pageId, processing_run_id: job.id, stage: "extract", status: warning ? "processed_with_warning" : "processed", details: { warnings: page.warnings ?? [] } }) });
  }
  const fileStatus = result.status === "security_quarantine" ? "quarantined" : result.status === "permanent_failure" ? "failed" : result.status === "partial_success" ? "processed_with_warning" : "processed";
  await serviceRest(c.env, `/uploaded_files?id=eq.${job.uploaded_file_id}`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ status: fileStatus, sha256: result.sha256 ?? null, page_count: result.page_count ?? null, processing_warnings: result.file_warnings ?? [], processed_at: new Date().toISOString() }) });
  await serviceRest(c.env, `/processing_runs?id=eq.${job.id}`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ status: result.status, completed_at: new Date().toISOString(), last_error_code: result.error_code ?? null }) });
  return c.json({ data: { job_id: job.id, status: result.status } });
});
