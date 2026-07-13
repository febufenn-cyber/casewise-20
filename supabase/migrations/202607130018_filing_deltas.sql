begin;

alter table public.filing_version_members drop constraint if exists filing_version_members_object_type_check;
alter table public.filing_version_members add constraint filing_version_members_object_type_check check (
  object_type in ('allegation','response','response_search','event_assertion','candidate_event','evidence_item','evidence_relationship','contradiction_candidate','missing_information','date_mention','amount_mention','document_reference','entity','entity_role')
);

create table public.delta_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  prior_version_id uuid not null references public.filing_versions(id) on delete cascade,
  current_version_id uuid not null references public.filing_versions(id) on delete cascade,
  match_run_id uuid not null references public.delta_match_runs(id) on delete cascade,
  processing_version text not null,
  item_count integer not null default 0,
  changed_item_count integer not null default 0,
  blocked_item_count integer not null default 0,
  review_required_item_count integer not null default 0,
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed','accepted','corrected','rejected','unresolved')),
  status text not null default 'active' check (status in ('active','superseded','stale','deleted')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (matter_id, version_number),
  check (prior_version_id <> current_version_id)
);

create table public.delta_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  delta_snapshot_id uuid not null references public.delta_snapshots(id) on delete cascade,
  match_candidate_id uuid references public.delta_match_candidates(id) on delete set null,
  object_type text not null,
  change_type text not null check (change_type in ('new','removed','unchanged','restated','narrowed','expanded','amended','response_changed','response_coverage_changed','date_changed','amount_changed','party_or_role_changed','document_reference_changed','evidence_relationship_changed','contradiction_opened','contradiction_resolved','information_gap_opened','information_gap_resolved')),
  prior_member_id uuid references public.filing_version_members(id) on delete set null,
  current_member_id uuid references public.filing_version_members(id) on delete set null,
  materiality text not null default 'unrated' check (materiality in ('critical','high','medium','low','unrated')),
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  prior_source_span_ids uuid[] not null default '{}',
  current_source_span_ids uuid[] not null default '{}',
  party_entity_ids uuid[] not null default '{}',
  logical_document_ids uuid[] not null default '{}',
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed','accepted','corrected','rejected','unresolved')),
  status text not null default 'active' check (status in ('active','stale','deleted')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (change_type = 'new' and cardinality(current_source_span_ids) > 0)
    or (change_type = 'removed' and cardinality(prior_source_span_ids) > 0)
    or (change_type not in ('new','removed') and cardinality(prior_source_span_ids) > 0 and cardinality(current_source_span_ids) > 0)
  )
);

create table public.delta_item_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  delta_item_id uuid not null references public.delta_items(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  decision text not null check (decision in ('accepted','corrected','rejected','unresolved')),
  previous_value jsonb,
  new_value jsonb,
  rationale text,
  created_at timestamptz not null default now()
);

create index delta_snapshots_pair_idx on public.delta_snapshots(matter_id, prior_version_id, current_version_id, status);
create index delta_items_snapshot_idx on public.delta_items(delta_snapshot_id, review_status, materiality);
create index delta_items_party_idx on public.delta_items using gin(party_entity_ids);
create index delta_items_document_idx on public.delta_items using gin(logical_document_ids);

alter table public.delta_snapshots enable row level security;
alter table public.delta_items enable row level security;
alter table public.delta_item_reviews enable row level security;

create policy delta_snapshots_select on public.delta_snapshots for select to authenticated using (private.has_matter_membership(matter_id));
create policy delta_items_select on public.delta_items for select to authenticated using (private.has_matter_membership(matter_id));
create policy delta_item_reviews_select on public.delta_item_reviews for select to authenticated using (private.has_matter_membership(matter_id));

revoke all on public.delta_snapshots, public.delta_items, public.delta_item_reviews from anon;
revoke insert, update, delete on public.delta_snapshots, public.delta_items, public.delta_item_reviews from authenticated;
grant select on public.delta_snapshots, public.delta_items, public.delta_item_reviews to authenticated;

commit;
