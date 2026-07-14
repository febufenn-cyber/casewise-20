begin;

create table public.matter_overview_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  support_set_id uuid not null references public.narrative_support_sets(id) on delete restrict,
  matrix_snapshot_id uuid not null references public.matter_matrix_snapshots(id) on delete restrict,
  memory_snapshot_id uuid references public.matter_memory_snapshots(id) on delete set null,
  title text not null,
  artifact_locks jsonb not null,
  readiness jsonb not null default '{}'::jsonb,
  source_manifest_fingerprint text,
  section_count integer not null default 0,
  sentence_count integer not null default 0,
  approval_status text not null default 'draft' check (approval_status in ('draft','blocked','review_required','ready','attorney_approved','rejected')),
  production_use_allowed boolean not null default false,
  status text not null default 'draft' check (status in ('draft','active','stale','superseded','deleted')),
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed','accepted','corrected','rejected','unresolved')),
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  approved_at timestamptz,
  unique (matter_id, version_number)
);

create table public.matter_overview_sections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  overview_snapshot_id uuid not null references public.matter_overview_snapshots(id) on delete cascade,
  section_key text not null,
  title text not null,
  position integer not null default 0 check (position >= 0),
  status text not null default 'active' check (status in ('active','stale','superseded','deleted')),
  created_at timestamptz not null default now(),
  unique (overview_snapshot_id, section_key),
  unique (overview_snapshot_id, position)
);

create table public.matter_overview_section_sentences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  overview_snapshot_id uuid not null references public.matter_overview_snapshots(id) on delete cascade,
  section_id uuid not null references public.matter_overview_sections(id) on delete cascade,
  sentence_id uuid not null references public.narrative_sentences(id) on delete restrict,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  unique (overview_snapshot_id, sentence_id),
  unique (section_id, position)
);

create table public.matter_overview_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  overview_snapshot_id uuid not null references public.matter_overview_snapshots(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  decision text not null check (decision in ('accepted','corrected','rejected','unresolved')),
  readiness jsonb not null default '{}'::jsonb,
  previous_value jsonb,
  new_value jsonb,
  rationale text,
  created_at timestamptz not null default now()
);

create index matter_overview_snapshots_matter_idx on public.matter_overview_snapshots(matter_id, version_number desc, status, approval_status);
create index matter_overview_sections_snapshot_idx on public.matter_overview_sections(overview_snapshot_id, position);
create index matter_overview_sentence_links_snapshot_idx on public.matter_overview_section_sentences(overview_snapshot_id, section_id, position);

alter table public.matter_overview_snapshots enable row level security;
alter table public.matter_overview_sections enable row level security;
alter table public.matter_overview_section_sentences enable row level security;
alter table public.matter_overview_reviews enable row level security;

create policy matter_overview_snapshots_select on public.matter_overview_snapshots for select to authenticated using (private.has_matter_membership(matter_id));
create policy matter_overview_sections_select on public.matter_overview_sections for select to authenticated using (private.has_matter_membership(matter_id));
create policy matter_overview_section_sentences_select on public.matter_overview_section_sentences for select to authenticated using (private.has_matter_membership(matter_id));
create policy matter_overview_reviews_select on public.matter_overview_reviews for select to authenticated using (private.has_matter_membership(matter_id));

revoke all on public.matter_overview_snapshots, public.matter_overview_sections, public.matter_overview_section_sentences, public.matter_overview_reviews from anon;
revoke insert, update, delete on public.matter_overview_snapshots, public.matter_overview_sections, public.matter_overview_section_sentences, public.matter_overview_reviews from authenticated;
grant select on public.matter_overview_snapshots, public.matter_overview_sections, public.matter_overview_section_sentences, public.matter_overview_reviews to authenticated;

commit;
