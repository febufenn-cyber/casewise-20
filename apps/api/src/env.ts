import type { User } from "./lib/auth";

export interface QueuePayload {
  token: string;
  job_id: string;
  stage: "intake_file" | "process_pdf" | "delete_matter";
}

export interface Env {
  EVIDENCE_BUCKET: R2Bucket;
  INGESTION_QUEUE: Queue<QueuePayload>;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  TOKEN_SIGNING_SECRET: string;
  PROCESSOR_SHARED_SECRET: string;
  PROCESSOR_URL: string;
  PUBLIC_BASE_URL: string;
  MAX_UPLOAD_BYTES: string;
  UPLOAD_TOKEN_TTL_SECONDS: string;
  DOWNLOAD_TOKEN_TTL_SECONDS: string;
  PROCESSOR_JOB_TTL_SECONDS: string;
}

export interface Variables {
  user: User;
  accessToken: string;
  requestId: string;
}
