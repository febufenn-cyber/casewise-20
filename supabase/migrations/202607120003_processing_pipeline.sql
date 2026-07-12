begin;
create type public.processing_status as enum ('created','queued','running','succeeded','partial_success','retryable_failure','permanent_failure','security_quarantine','cancelled','stale','deleted');
create type public.coverage_status as enum ('processed','processed_with_warning','failed','unreadable','unsupported','excluded_by_user','duplicate','quarantined','not_attempted','cancelled','deleted','stale');
create table public.processing_runs (
  id uuid primary key, organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade, uploaded_file_id uuid references public.uploaded_files(id) on delete cascade,
  stage text not null check (stage in ('intake_file','process_pdf','delete_matter')), status public.processing_status not null,
  pipeline_version text not null, configuration_hash text, input_sha256 text, requested_by uuid references auth.users(id) on delete set null,
  authorization_token_hash text, attempt_count integer not null default 0, last_error_code text,
  created_at timestamptz not null default now(), started_at timestamptz, completed_at timestamptz,
  unique nulls not distinct (uploaded_file_id, stage, input_sha256, pipeline_version, configuration_hash)
);
alter table public.stored_objects add constraint stored_objects_processing_run_fk foreign key (processing_run_id) references public.processing_runs(id) on delete cascade;
create table public.pages (
  id uuid primary key, organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade, uploaded_file_id uuid not null references public.uploaded_files(id) on delete cascade,
  processing_run_id uuid not null references public.processing_runs(id) on delete cascade, pdf_page_index integer not null check (pdf_page_index >= 0),
  viewer_page_number integer generated always as (pdf_page_index + 1) stored, printed_page_label text, logical_document_page integer,
  width_points numeric, height_points numeric, rotation_degrees integer not null default 0 check (rotation_degrees in (0,90,180,270)),
  status public.coverage_status not null, warnings jsonb not null default '[]'::jsonb, created_at timestamptz not null default now(), unique (uploaded_file_id, processing_run_id, pdf_page_index)
);
create table public.page_renders (
  id uuid primary key default gen_random_uuid(), page_id uuid not null references public.pages(id) on delete cascade,
  processing_run_id uuid not null references public.processing_runs(id) on delete cascade, object_key text not null unique,
  render_version text not null, image_width integer, image_height integer, sha256 text, status public.object_status not null default 'active', created_at timestamptz not null default now()
);
create table public.text_extractions (
  id uuid primary key default gen_random_uuid(), page_id uuid not null references public.pages(id) on delete cascade,
  processing_run_id uuid not null references public.processing_runs(id) on delete cascade, object_key text not null unique,
  extraction_method text not null check (extraction_method in ('native_text','ocr','hybrid')), extraction_version text not null,
  character_count integer not null default 0, quality_score numeric, warnings jsonb not null default '[]'::jsonb,
  status public.coverage_status not null, created_at timestamptz not null default now()
);
create table public.coverage_entries (
  id bigint generated always as identity primary key, organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade, uploaded_file_id uuid references public.uploaded_files(id) on delete cascade,
  page_id uuid references public.pages(id) on delete cascade, processing_run_id uuid not null references public.processing_runs(id) on delete cascade,
  stage text not null, status public.coverage_status not null, details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index processing_runs_matter_idx on public.processing_runs(matter_id, created_at desc);
create index processing_runs_status_idx on public.processing_runs(status, created_at);
create index pages_file_idx on public.pages(uploaded_file_id, pdf_page_index);
create index coverage_file_idx on public.coverage_entries(uploaded_file_id, stage, status);
alter table public.processing_runs enable row level security;
alter table public.pages enable row level security;
alter table public.page_renders enable row level security;
alter table public.text_extractions enable row level security;
alter table public.coverage_entries enable row level security;
create policy processing_runs_select on public.processing_runs for select to authenticated using (private.has_matter_membership(matter_id));
create policy pages_select on public.pages for select to authenticated using (private.has_matter_membership(matter_id));
create policy page_renders_select on public.page_renders for select to authenticated using (exists (select 1 from public.pages p where p.id = page_id and private.has_matter_membership(p.matter_id)));
create policy text_extractions_select on public.text_extractions for select to authenticated using (exists (select 1 from public.pages p where p.id = page_id and private.has_matter_membership(p.matter_id)));
create policy coverage_entries_select on public.coverage_entries for select to authenticated using (private.has_matter_membership(matter_id));
revoke all on public.processing_runs, public.pages, public.page_renders, public.text_extractions, public.coverage_entries from anon;
revoke insert, update, delete on public.processing_runs, public.pages, public.page_renders, public.text_extractions, public.coverage_entries from authenticated;
grant select on public.processing_runs, public.pages, public.page_renders, public.text_extractions, public.coverage_entries to authenticated;
commit;
