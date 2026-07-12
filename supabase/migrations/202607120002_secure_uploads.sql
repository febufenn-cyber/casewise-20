begin;
create type public.upload_session_status as enum ('authorized', 'uploaded', 'finalized', 'expired', 'rejected');
create type public.file_status as enum ('quarantined', 'accepted', 'processing', 'processed', 'processed_with_warning', 'failed', 'deletion_pending', 'deleted');
create type public.object_status as enum ('active', 'stale', 'deletion_pending', 'deleted');
create table public.upload_sessions (
  id uuid primary key, organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade, created_by uuid not null references auth.users(id),
  original_filename text not null, declared_media_type text not null, declared_size_bytes bigint not null check (declared_size_bytes > 0),
  object_key text not null unique, status public.upload_session_status not null, expires_at timestamptz not null,
  uploaded_at timestamptz, finalized_at timestamptz, uploaded_file_id uuid, created_at timestamptz not null default now()
);
create table public.uploaded_files (
  id uuid primary key, organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade, upload_session_id uuid not null unique references public.upload_sessions(id),
  original_filename text not null, display_filename text, media_type text not null check (media_type = 'application/pdf'),
  size_bytes bigint not null check (size_bytes > 0), sha256 text check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  original_object_key text not null unique, accepted_object_key text not null unique, page_count integer check (page_count is null or page_count > 0),
  status public.file_status not null, processing_warnings jsonb not null default '[]'::jsonb,
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), processed_at timestamptz, deleted_at timestamptz
);
alter table public.upload_sessions add constraint upload_sessions_uploaded_file_fk foreign key (uploaded_file_id) references public.uploaded_files(id) deferrable initially deferred;
create table public.stored_objects (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade, uploaded_file_id uuid references public.uploaded_files(id) on delete cascade,
  processing_run_id uuid, object_key text not null unique, object_class text not null check (object_class in ('quarantine_original','accepted_original','derived','export','temporary')),
  media_type text not null, size_bytes bigint, sha256 text, status public.object_status not null default 'active', created_at timestamptz not null default now(), deleted_at timestamptz
);
create index upload_sessions_matter_idx on public.upload_sessions(matter_id, created_at desc);
create index uploaded_files_matter_idx on public.uploaded_files(matter_id, created_at desc);
create index uploaded_files_hash_idx on public.uploaded_files(matter_id, sha256) where sha256 is not null;
create index stored_objects_matter_idx on public.stored_objects(matter_id, status);
alter table public.upload_sessions enable row level security;
alter table public.uploaded_files enable row level security;
alter table public.stored_objects enable row level security;
create policy upload_sessions_select on public.upload_sessions for select to authenticated using (private.has_matter_membership(matter_id));
create policy uploaded_files_select on public.uploaded_files for select to authenticated using (private.has_matter_membership(matter_id));
create policy stored_objects_select on public.stored_objects for select to authenticated using (private.has_matter_membership(matter_id));
revoke all on public.upload_sessions, public.uploaded_files, public.stored_objects from anon;
revoke insert, update, delete on public.upload_sessions, public.uploaded_files, public.stored_objects from authenticated;
grant select on public.upload_sessions, public.uploaded_files, public.stored_objects to authenticated;
commit;
