import type { Env, QueuePayload } from "./env";
import { audit } from "./lib/audit";
import { authorizeQueuedJob, buildProcessorRequest, signProcessorBody } from "./lib/job-runtime";
import { serviceRest } from "./lib/supabase";

async function dispatchProcessing(env: Env, payload: QueuePayload) {
  const state = await authorizeQueuedJob(env, payload);
  await serviceRest(env, `/processing_runs?id=eq.${state.run.id}`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ status: "running", started_at: new Date().toISOString(), attempt_count: Number(state.run.attempt_count ?? 0) + 1 }) });
  const processorRequest = await buildProcessorRequest(env, state);
  const body = JSON.stringify(processorRequest);
  const signature = await signProcessorBody(body, env.PROCESSOR_SHARED_SECRET);
  const response = await fetch(`${env.PROCESSOR_URL.replace(/\/$/, "")}/process`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-casewise-signature": signature },
    body,
  });
  if (!response.ok) throw new Error(`processor dispatch failed with ${response.status}`);
  await audit(env, { organization_id: state.run.organization_id, matter_id: state.run.matter_id, actor_id: state.run.requested_by, action: "processing.started", resource_type: "processing_run", resource_id: state.run.id, metadata: { stage: state.run.stage } });
}

async function deleteMatter(env: Env, payload: QueuePayload) {
  const state = await authorizeQueuedJob(env, payload);
  const matterId = state.run.matter_id;
  await serviceRest(env, `/processing_runs?matter_id=eq.${matterId}&id=neq.${state.run.id}&status=in.(queued,running,retryable_failure)`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ status: "cancelled", completed_at: new Date().toISOString() }) });
  const prefix = `originals/organizations/${state.run.organization_id}/matters/${matterId}/`;
  const quarantinePrefix = `quarantine/organizations/${state.run.organization_id}/matters/${matterId}/`;
  const derivedPrefix = `derived/organizations/${state.run.organization_id}/matters/${matterId}/`;
  let deletedObjects = 0;
  for (const objectPrefix of [prefix, quarantinePrefix, derivedPrefix]) {
    let cursor: string | undefined;
    do {
      const listing = await env.EVIDENCE_BUCKET.list({ prefix: objectPrefix, cursor, limit: 1000 });
      if (listing.objects.length) {
        await env.EVIDENCE_BUCKET.delete(listing.objects.map((object) => object.key));
        deletedObjects += listing.objects.length;
      }
      cursor = listing.truncated ? listing.cursor : undefined;
    } while (cursor);
  }
  await serviceRest(env, `/uploaded_files?matter_id=eq.${matterId}`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ status: "deleted", deleted_at: new Date().toISOString() }) });
  await serviceRest(env, `/matters?id=eq.${matterId}`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ status: "deleted", deleted_at: new Date().toISOString() }) });
  await serviceRest(env, `/deletion_requests?matter_id=eq.${matterId}&status=neq.deleted`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ status: "deleted", completed_at: new Date().toISOString(), verification_metadata: { deleted_objects: deletedObjects } }) });
  await serviceRest(env, `/processing_runs?id=eq.${state.run.id}`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ status: "succeeded", completed_at: new Date().toISOString() }) });
  await audit(env, { organization_id: state.run.organization_id, matter_id: matterId, actor_id: state.run.requested_by, action: "deletion.completed", resource_type: "matter", resource_id: matterId, metadata: { deleted_objects: deletedObjects } });
}

export async function consumeQueue(batch: MessageBatch<QueuePayload>, env: Env) {
  for (const message of batch.messages) {
    try {
      if (message.body.stage === "delete_matter") await deleteMatter(env, message.body);
      else await dispatchProcessing(env, message.body);
      message.ack();
    } catch (error) {
      console.error("queue_job_failed", { job_id: message.body.job_id, stage: message.body.stage, error_name: error instanceof Error ? error.name : "unknown" });
      const rows = await serviceRest(env, `/processing_runs?id=eq.${encodeURIComponent(message.body.job_id)}&select=attempt_count`).catch(() => []);
      const attempts = Number(rows?.[0]?.attempt_count ?? 0);
      await serviceRest(env, `/processing_runs?id=eq.${encodeURIComponent(message.body.job_id)}`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ status: attempts >= 3 ? "permanent_failure" : "retryable_failure", last_error_code: error instanceof Error ? error.name : "unknown" }) }).catch(() => null);
      if (attempts >= 3) message.ack();
      else message.retry({ delaySeconds: Math.min(300, 2 ** Math.max(attempts, 1) * 5) });
    }
  }
}
