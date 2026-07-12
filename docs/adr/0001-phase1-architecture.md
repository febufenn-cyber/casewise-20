# ADR 0001: Phase 1 evidence-custody architecture

- Status: accepted for implementation
- Date: 2026-07-12

Casewise uses four trust zones: a Hono Worker for authenticated API orchestration; Supabase Postgres for RLS, audit, and durable jobs; R2 for immutable evidence objects; and an isolated native PDF/OCR processor. Queue messages wake work but are not durable truth. The processor receives scoped input and artifact capabilities and no database or model-provider credentials.
