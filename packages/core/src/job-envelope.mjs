import { signScopedToken, verifyScopedToken } from "./tokens.mjs";
const STAGES = new Set(["intake_file", "process_pdf", "delete_matter"]);
export async function createJobEnvelope(input, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  for (const field of ["jobId", "organizationId", "matterId", "stage", "pipelineVersion"]) if (!input[field]) throw new Error(`job envelope missing ${field}`);
  if (!STAGES.has(input.stage)) throw new Error("unsupported job stage");
  const payload = { action: "process_job", job_id: input.jobId, organization_id: input.organizationId, matter_id: input.matterId, file_id: input.fileId ?? null, stage: input.stage, pipeline_version: input.pipelineVersion, input_sha256: input.inputSha256 ?? null, actor_id: input.actorId ?? null, nonce: input.nonce ?? crypto.randomUUID(), exp: nowSeconds + (input.ttlSeconds ?? 1800) };
  return { payload, token: await signScopedToken(payload, secret, nowSeconds) };
}
export async function verifyJobEnvelope(token, expected, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  const payload = await verifyScopedToken(token, secret, { action: "process_job" }, nowSeconds);
  const mappings = { jobId: "job_id", organizationId: "organization_id", matterId: "matter_id", fileId: "file_id", stage: "stage", inputSha256: "input_sha256" };
  for (const [inputKey, payloadKey] of Object.entries(mappings)) if (expected[inputKey] !== undefined && payload[payloadKey] !== expected[inputKey]) throw new Error(`job envelope ${payloadKey} mismatch`);
  return payload;
}
