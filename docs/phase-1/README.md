# Phase 1 — Secure ingestion and provenance

Phase 1 implements Casewise's evidence-custody layer, not legal summarization or drafting.

Components: Cloudflare Worker + Hono, Supabase Auth/Postgres with RLS, R2 evidence storage, Cloudflare Queue with DLQ, and an isolated PDF processor.

Security properties include explicit matter membership, no browser service credentials, short-lived scoped capabilities, random object keys, immutable originals, signed job scope, worker reauthorization, visible partial failures, canonical page identity, and access revocation before deletion.

Deployment still requires provider, region, retention, incident-response, and Phase 0 customer-evidence approval.
