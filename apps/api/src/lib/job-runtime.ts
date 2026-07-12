import type { Env, QueuePayload } from "../env";
import { verifyJobEnvelope } from "../../../../packages/core/src/job-envelope.mjs";
import { matterAllowsStage } from "../../../../packages/core/src/job-policy.mjs";
import { signScopedToken } from "../../../../packages/core/src/tokens.mjs";
import { ApiError } from "./http";
import { serviceRest } from "./supabase";

async function getSingle(env: Env, path: string, label: string) {
  const rows = await serviceRest(env, path);
  if (!rows?.length) throw new ApiError(404, `${label} not found`, "not_found");
  return rows[0];
}

export async function authorizeQueuedJob(env: Env, payload: QueuePayload) {
  const run = await getSingle(env, `/processing_runs?id=eq.${encodeURIComponent(payload.job_id)}&select=*`, "Processing run");
  const claims = await verifyJobEnvelope(payload.token, {
    jobId: run.id,
    organizationId: run.organization_id,
    matterId: run.matter_id,
    fileId: run.uploaded_file_id,
    stage: run.stage,
  }, env.TOKEN_SIGNING_SECRET);
  const matter = await getSingle(env, `/matters?id=eq.${run.matter_id}&select=id,organization_id,status`, "Matter");
  if (matter.organization_id !== run.organization_id || !matterAllowsStage(matter.status, run.stage)) throw new ApiError(409, "Matter no longer permits this processing stage", "matter_unavailable");
  if (["cancelled", "succeeded", "deleted", "stale"].includes(run.status)) throw new ApiError(409, "Processing run is not executable", "job_unavailable");
  let file = null;
  if (run.uploaded_file_id) {
    file = await getSingle(env, `/uploaded_files?id=eq.${run.uploaded_file_id}&select=*`, "Uploaded file");
    if (file.matter_id !== run.matter_id || file.organization_id !== run.organization_id) throw new ApiError(403, "Job file scope mismatch", "job_scope_mismatch");
    if (["deletion_pending", "deleted"].includes(file.status)) throw new ApiError(409, "File no longer permits processing", "file_unavailable");
  }
  return { run, matter, file, claims };
}

export async function buildProcessorRequest(env: Env, state: Awaited<ReturnType<typeof authorizeQueuedJob>>) {
  const now = Math.floor(Date.now() / 1000);
  const ttl = Number(env.PROCESSOR_JOB_TTL_SECONDS);
  const inputToken = await signScopedToken({ action: "processor_download", job_id: state.run.id, file_id: state.file.id, object_key: state.file.original_object_key, exp: now + ttl }, env.TOKEN_SIGNING_SECRET, now);
  const artifactToken = await signScopedToken({ action: "processor_artifact_upload", job_id: state.run.id, organization_id: state.run.organization_id, matter_id: state.run.matter_id, file_id: state.file.id, exp: now + ttl }, env.TOKEN_SIGNING_SECRET, now);
  return {
    job_id: state.run.id,
    organization_id: state.run.organization_id,
    matter_id: state.run.matter_id,
    file_id: state.file.id,
    pipeline_version: state.run.pipeline_version,
    input_url: `${env.PUBLIC_BASE_URL}/internal/jobs/${state.run.id}/input?token=${encodeURIComponent(inputToken)}`,
    artifact_base_url: `${env.PUBLIC_BASE_URL}/internal/jobs/${state.run.id}/artifacts`,
    artifact_token: artifactToken,
    callback_url: `${env.PUBLIC_BASE_URL}/internal/jobs/${state.run.id}/complete`,
  };
}

export async function signProcessorBody(body: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  return [...signature].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyProcessorSignature(body: string, signature: string | undefined, secret: string) {
  if (!signature) return false;
  const expected = await signProcessorBody(body, secret);
  if (signature.length !== expected.length) return false;
  let diff = 0;
  for (let index = 0; index < expected.length; index += 1) diff |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  return diff === 0;
}
