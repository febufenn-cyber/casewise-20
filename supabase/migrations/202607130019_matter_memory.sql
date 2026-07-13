begin;

alter table public.delta_snapshots
  add column approval_status text not null default 'draft' check (approval_status in ('draft','blocked','review_required','ready','attorney_approved','rejected','stale','deleted')),
  add column approved_by uuid references auth.users(id) on delete set null,
  add column approved_at timestamptz;

create table public.delta_snapshot_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  delta_snapshot_id uuid not null references public.delta_snapshots(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  decision text not null check (decision in ('approved','rejected','unresolved')),
  readiness jsonb not null default '{}'::jsonb,
  previous_value jsonb,
  new_value jsonb,
  rationale text,
  created_at timestamptz not null default now()
);

create table public.matter_memory_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  delta_snapshot_id uuid not null references public.delta_snapshots(id) on delete cascade,
  entry_count integer not null default 0 check (entry_count >= 0),
  status text not null default 'active' check (status in ('active','superseded','stale','deleted')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (matter_id, version_number),
  unique (delta_snapshot_id)
);

create table public.matter_memory_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  memory_snapshot_id uuid not null references public.matter_memory_snapshots(id) on delete cascade,
  delta_snapshot_id uuid not null references public.delta_snapshots(id) on delete cascade,
  delta_item_id uuid not null references public.delta_items(id) on delete cascade,
  memory_key text not null,
  object_type text not null,
  change_type text not null,
  materiality text not null check (materiality in ('critical','high','medium','low','unrated')),
  headline text not null,
  prior_version_id uuid not null references public.filing_versions(id) on delete cascade,
  current_version_id uuid not null references public.filing_versions(id) on delete cascade,
  prior_source_span_ids uuid[] not null default '{}',
  current_source_span_ids uuid[] not null default '{}',
  party_entity_ids uuid[] not null default '{}',
  logical_document_ids uuid[] not null default '{}',
  details jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','superseded','stale','deleted')),
  created_at timestamptz not null default now(),
  check (
    (change_type = 'new' and cardinality(current_source_span_ids) > 0)
    or (change_type = 'removed' and cardinality(prior_source_span_ids) > 0)
    or (change_type not in ('new','removed') and cardinality(prior_source_span_ids) > 0 and cardinality(current_source_span_ids) > 0)
  ),
  unique (memory_snapshot_id, delta_item_id)
);

create index delta_snapshot_reviews_snapshot_idx on public.delta_snapshot_reviews(delta_snapshot_id, created_at desc);
create index matter_memory_snapshots_matter_idx on public.matter_memory_snapshots(matter_id, version_number desc, status);
create index matter_memory_entries_snapshot_idx on public.matter_memory_entries(memory_snapshot_id, materiality, change_type);
create index matter_memory_entries_party_idx on public.matter_memory_entries using gin(party_entity_ids);
create index matter_memory_entries_document_idx on public.matter_memory_entries using gin(logical_document_ids);

alter table public.delta_snapshot_reviews enable row level security;
alter table public.matter_memory_snapshots enable row level security;
alter table public.matter_memory_entries enable row level security;

create policy delta_snapshot_reviews_select on public.delta_snapshot_reviews for select to authenticated using (private.has_matter_membership(matter_id));
create policy matter_memory_snapshots_select on public.matter_memory_snapshots for select to authenticated using (private.has_matter_membership(matter_id));
create policy matter_memory_entries_select on public.matter_memory_entries for select to authenticated using (private.has_matter_membership(matter_id));

revoke all on public.delta_snapshot_reviews, public.matter_memory_snapshots, public.matter_memory_entries from anon;
revoke insert, update, delete on public.delta_snapshot_reviews, public.matter_memory_snapshots, public.matter_memory_entries from authenticated;
grant select on public.delta_snapshot_reviews, public.matter_memory_snapshots, public.matter_memory_entries to authenticated;

commit;
