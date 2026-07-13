begin;

create table public.filing_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  label text not null,
  filing_kind text not null check (filing_kind in ('initial_filing','amended_filing','response_filing','evidence_production','order','document_revision','other')),
  uploaded_file_id uuid references public.uploaded_files(id) on delete set null,
  logical_document_id uuid references public.logical_documents(id) on delete set null,
  matrix_snapshot_id uuid references public.matter_matrix_snapshots(id) on delete set null,
  parent_version_id uuid references public.filing_versions(id) on delete set null,
  effective_at timestamptz,
  notes text,
  object_count integer not null default 0 check (object_count >= 0),
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed','accepted','corrected','rejected','unresolved')),
  status text not null default 'draft' check (status in ('draft','active','superseded','stale','deleted')),
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  reviewed_at timestamptz,
  unique (matter_id, version_number)
);

create table public.filing_version_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  filing_version_id uuid not null references public.filing_versions(id) on delete cascade,
  object_type text not null check (object_type in ('allegation','response','event_assertion','candidate_event','evidence_item','contradiction_candidate','missing_information','date_mention','amount_mention','document_reference','entity')),
  object_id uuid not null,
  logical_document_id uuid references public.logical_documents(id) on delete set null,
  party_entity_ids uuid[] not null default '{}',
  source_span_ids uuid[] not null,
  payload jsonb not null,
  object_fingerprint text not null,
  review_status text not null check (review_status in ('unreviewed','accepted','corrected','confirmed','resolved','attorney_approved','rejected','unresolved')),
  warnings text[] not null default '{}',
  created_at timestamptz not null default now(),
  check (cardinality(source_span_ids) > 0),
  unique (filing_version_id, object_type, object_id)
);

create table public.filing_version_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  filing_version_id uuid not null references public.filing_versions(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  decision text not null check (decision in ('activated','corrected','rejected','unresolved')),
  readiness jsonb not null default '{}'::jsonb,
  rationale text,
  created_at timestamptz not null default now()
);

create index filing_versions_matter_idx on public.filing_versions(matter_id, version_number desc, status);
create index filing_version_members_version_idx on public.filing_version_members(filing_version_id, object_type);
create index filing_version_members_object_idx on public.filing_version_members(matter_id, object_type, object_id);

alter table public.filing_versions enable row level security;
alter table public.filing_version_members enable row level security;
alter table public.filing_version_reviews enable row level security;

create policy filing_versions_select on public.filing_versions for select to authenticated using (private.has_matter_membership(matter_id));
create policy filing_version_members_select on public.filing_version_members for select to authenticated using (private.has_matter_membership(matter_id));
create policy filing_version_reviews_select on public.filing_version_reviews for select to authenticated using (private.has_matter_membership(matter_id));

revoke all on public.filing_versions, public.filing_version_members, public.filing_version_reviews from anon;
revoke insert, update, delete on public.filing_versions, public.filing_version_members, public.filing_version_reviews from authenticated;
grant select on public.filing_versions, public.filing_version_members, public.filing_version_reviews to authenticated;

commit;
