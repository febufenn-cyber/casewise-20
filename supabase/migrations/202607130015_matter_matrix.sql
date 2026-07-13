begin;
create table public.matter_matrix_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  processing_version text not null,
  row_count integer not null default 0,
  blocked_row_count integer not null default 0,
  review_required_row_count integer not null default 0,
  coverage_summary jsonb not null default '{}'::jsonb,
  export_status text not null default 'draft' check (export_status in ('draft','blocked','review_required','ready','attorney_approved','rejected','superseded','stale','deleted')),
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  approved_at timestamptz,
  unique (matter_id, version_number)
);

create table public.matter_matrix_rows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  snapshot_id uuid not null references public.matter_matrix_snapshots(id) on delete cascade,
  allegation_id uuid not null references public.allegations(id) on delete cascade,
  readiness_status text not null check (readiness_status in ('ready','review_required','blocked')),
  warnings text[] not null default '{}',
  response_summary jsonb not null default '[]'::jsonb,
  evidence_summary jsonb not null default '[]'::jsonb,
  contradiction_summary jsonb not null default '[]'::jsonb,
  missing_summary jsonb not null default '[]'::jsonb,
  row_data jsonb not null,
  created_at timestamptz not null default now(),
  unique (snapshot_id, allegation_id)
);

create table public.matter_matrix_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  snapshot_id uuid not null references public.matter_matrix_snapshots(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  decision text not null check (decision in ('approved','rejected','corrected','unresolved')),
  previous_value jsonb,
  new_value jsonb,
  rationale text,
  created_at timestamptz not null default now()
);

create index matter_matrix_snapshots_matter_idx on public.matter_matrix_snapshots(matter_id, version_number desc, export_status);
create index matter_matrix_rows_snapshot_idx on public.matter_matrix_rows(snapshot_id, readiness_status);

alter table public.matter_matrix_snapshots enable row level security;
alter table public.matter_matrix_rows enable row level security;
alter table public.matter_matrix_reviews enable row level security;
create policy matter_matrix_snapshots_select on public.matter_matrix_snapshots for select to authenticated using (private.has_matter_membership(matter_id));
create policy matter_matrix_rows_select on public.matter_matrix_rows for select to authenticated using (private.has_matter_membership(matter_id));
create policy matter_matrix_reviews_select on public.matter_matrix_reviews for select to authenticated using (private.has_matter_membership(matter_id));
revoke all on public.matter_matrix_snapshots, public.matter_matrix_rows, public.matter_matrix_reviews from anon;
revoke insert, update, delete on public.matter_matrix_snapshots, public.matter_matrix_rows, public.matter_matrix_reviews from authenticated;
grant select on public.matter_matrix_snapshots, public.matter_matrix_rows, public.matter_matrix_reviews to authenticated;
commit;
