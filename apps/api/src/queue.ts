import type { Env, QueuePayload } from "./env";
import { audit } from "./lib/audit";
import { authorizeQueuedJob, buildProcessorRequest, signProcessorBody } from "./lib/job-runtime";
import { serviceRest } from "./lib/supabase";

export async function consumeQueue(batch: MessageBatch<QueuePayload>, env: Env) {
  for (const message of batch.messages) {
    try {
      const state = await authorizeQueuedJob(env, message.body);
      await serviceRest(env, `/processing_runs?id=eq.${state.run.id}`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ status: "running", started_at: new Date().toISOString(), attempt_count: Number(state.run.attempt_count ?? 0) + 1 }) });
      const request = await buildProcessorRequest(env, state);
      const body = JSON.stringify(request);
      const response = await fetch(`${env.PROCESSOR_URL.replace(/\/$/, "")}/process`, { method: "POST", headers: { "content-type": "application/json", "x-casewise-signature": await signProcessorBody(body, env.PROCESSOR_SHARED_SECRET) }, body });
      if (!response.ok) throw new Error(`processor dispatch failed with ${response.status}`);
      await audit(env, { organization_id: state.run.organization_id, matter_id: state.run.matter_id, actor_id: state.run.requested_by, action: "processing.started", resource_type: "processing_run", resource_id: state.run.id, metadata: { stage: state.run.stage } });
      message.ack();
    } catch (error) {
      console.error("queue_job_failed", { job_id: message.body.job_id, stage: message.body.stage, error_name: error instanceof Error ? error.name : "unknown" });
      const rows = await serviceRest(env, `/processing_runs?id=eq.${message.body.job_id}&select=attempt_count`).catch(() => []);
      const attempts = Number(rows?.[0]?.attempt_count ?? 0);
      await serviceRest(env, `/processing_runs?id=eq.${message.body.job_id}`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ status: attempts >= 3 ? "permanent_failure" : "retryable_failure", last_error_code: error instanceof Error ? error.name : "unknown" }) }).catch(() => null);
      if (attempts >= 3) message.ack(); else message.retry({ delaySeconds: Math.min(300, 2 ** Math.max(attempts, 1) * 5) });
    }
  }
}
