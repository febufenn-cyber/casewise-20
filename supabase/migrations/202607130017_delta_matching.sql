begin;

create table public.delta_match_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  prior_version_id uuid not null references public.filing_versions(id) on delete cascade,
  current_version_id uuid not null references public.filing_versions(id) on delete cascade,
  processing_version text not null,
  thresholds jsonb not null default '{}'::jsonb,
  match_count integer not null default 0,
  ambiguous_count integer not null default 0,
  status text not null default 'active' check (status in ('active','superseded','stale','deleted')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (prior_version_id <> current_version_id)
);

create table public.delta_match_candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  match_run_id uuid not null references public.delta_match_runs(id) on delete cascade,
  object_type text not null,
  prior_member_id uuid references public.filing_version_members(id) on delete cascade,
  current_member_id uuid references public.filing_version_members(id) on delete cascade,
  match_status text not null check (match_status in ('exact','probable','ambiguous','new','removed')),
  similarity_score numeric not null default 0 check (similarity_score >= 0 and similarity_score <= 1),
  features jsonb not null default '{}'::jsonb,
  selected boolean not null default true,
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed','accepted','corrected','rejected','unresolved')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (prior_member_id is not null or current_member_id is not null)
);

create table public.delta_match_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  match_candidate_id uuid not null references public.delta_match_candidates(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  decision text not null check (decision in ('accepted','corrected','rejected','unresolved')),
  previous_value jsonb,
  new_value jsonb,
  rationale text,
  created_at timestamptz not null default now()
);

create index delta_match_runs_pair_idx on public.delta_match_runs(matter_id, prior_version_id, current_version_id, status);
create index delta_match_candidates_run_idx on public.delta_match_candidates(match_run_id, match_status, review_status);
create index delta_match_candidates_prior_idx on public.delta_match_candidates(prior_member_id);
create index delta_match_candidates_current_idx on public.delta_match_candidates(current_member_id);

alter table public.delta_match_runs enable row level security;
alter table public.delta_match_candidates enable row level security;
alter table public.delta_match_reviews enable row level security;

create policy delta_match_runs_select on public.delta_match_runs for select to authenticated using (private.has_matter_membership(matter_id));
create policy delta_match_candidates_select on public.delta_match_candidates for select to authenticated using (private.has_matter_membership(matter_id));
create policy delta_match_reviews_select on public.delta_match_reviews for select to authenticated using (private.has_matter_membership(matter_id));

revoke all on public.delta_match_runs, public.delta_match_candidates, public.delta_match_reviews from anon;
revoke insert, update, delete on public.delta_match_runs, public.delta_match_candidates, public.delta_match_reviews from authenticated;
grant select on public.delta_match_runs, public.delta_match_candidates, public.delta_match_reviews to authenticated;

commit;
