begin;
create table public.logical_documents (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade, uploaded_file_id uuid not null references public.uploaded_files(id) on delete cascade,
  title text, document_type text, start_pdf_page_index integer not null default 0, end_pdf_page_index integer,
  segmentation_version text not null default 'default-file-boundary-v1', status public.object_status not null default 'active', created_at timestamptz not null default now()
);
create type public.source_span_status as enum ('located','source_verified','support_verified','partially_supported','contradicted','ambiguous','invalid','reviewed','stale');
create table public.source_spans (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade, logical_document_id uuid references public.logical_documents(id) on delete set null,
  text_extraction_id uuid not null references public.text_extractions(id) on delete cascade, text_start integer not null check (text_start >= 0),
  text_end integer not null check (text_end > text_start), quoted_text text not null, quoted_text_sha256 text not null check (quoted_text_sha256 ~ '^[a-f0-9]{64}$'),
  bounding_polygon jsonb, paragraph_label text, status public.source_span_status not null default 'located', created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.artifact_dependencies (
  id bigint generated always as identity primary key, organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade, source_type text not null, source_id text not null,
  dependent_type text not null, dependent_id text not null, source_version text not null, status public.object_status not null default 'active', created_at timestamptz not null default now(),
  unique (source_type, source_id, dependent_type, dependent_id, source_version)
);
create index logical_documents_file_idx on public.logical_documents(uploaded_file_id, start_pdf_page_index);
create index source_spans_extraction_idx on public.source_spans(text_extraction_id, text_start, text_end);
create index artifact_dependencies_source_idx on public.artifact_dependencies(source_type, source_id, status);
alter table public.logical_documents enable row level security;
alter table public.source_spans enable row level security;
alter table public.artifact_dependencies enable row level security;
create policy logical_documents_select on public.logical_documents for select to authenticated using (private.has_matter_membership(matter_id));
create policy source_spans_select on public.source_spans for select to authenticated using (private.has_matter_membership(matter_id));
create policy artifact_dependencies_select on public.artifact_dependencies for select to authenticated using (private.has_matter_membership(matter_id));
revoke all on public.logical_documents, public.source_spans, public.artifact_dependencies from anon;
revoke insert, update, delete on public.logical_documents, public.source_spans, public.artifact_dependencies from authenticated;
grant select on public.logical_documents, public.source_spans, public.artifact_dependencies to authenticated;
commit;
