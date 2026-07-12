begin;
create table public.candidate_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade, event_type text not null, title text,
  date_start date, date_end date, date_precision text not null default 'unknown', actor_entity_ids uuid[] not null default '{}', object_entity_ids uuid[] not null default '{}',
  event_status text not null check (event_status in ('uncontested','contested','ambiguous','inferred','unresolved','duplicate_candidate','excluded')),
  independent_source_keys text[] not null default '{}', processing_version text not null, review_status text not null default 'unreviewed',
  status text not null default 'active' check (status in ('active','stale','superseded','deleted')),
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.candidate_event_members (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade, candidate_event_id uuid not null references public.candidate_events(id) on delete cascade,
  event_assertion_id uuid not null references public.event_assertions(id) on delete cascade, member_role text not null default 'assertion' check (member_role in ('assertion','supporting','contradicting','context')),
  created_at timestamptz not null default now(), unique (candidate_event_id, event_assertion_id)
);

create table public.candidate_event_reviews (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade, candidate_event_id uuid not null references public.candidate_events(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null, decision text not null check (decision in ('accepted','corrected','excluded','split','merged','unresolved')),
  previous_value jsonb, new_value jsonb, rationale text, created_at timestamptz not null default now()
);

create table public.review_tasks (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade, task_type text not null, object_type text not null, object_id uuid not null,
  priority numeric not null default 1 check (priority >= 0), status text not null default 'open' check (status in ('open','in_progress','resolved','dismissed','stale')),
  reason text, assigned_to uuid references auth.users(id) on delete set null, resolution text, resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), resolved_at timestamptz
);

create table public.object_revisions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade, object_type text not null, object_id uuid not null,
  previous_value jsonb, new_value jsonb, reason text, reviewer_id uuid references auth.users(id) on delete set null,
  affected_object_ids jsonb not null default '[]'::jsonb, created_at timestamptz not null default now()
);

create table public.regeneration_requests (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade, source_type text not null, source_id text not null,
  target_types text[] not null default '{}', reason text not null, status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled')),
  requested_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), completed_at timestamptz
);

create table public.chronology_snapshots (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade, version_number integer not null check (version_number > 0),
  processing_version text not null, event_count integer not null default 0, review_cutoff timestamptz, status text not null default 'draft' check (status in ('draft','active','superseded','stale','deleted')),
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), activated_at timestamptz,
  unique (matter_id, version_number)
);

alter table public.candidate_events add column chronology_snapshot_id uuid references public.chronology_snapshots(id) on delete cascade;
create index candidate_events_matter_date_idx on public.candidate_events(matter_id, date_start, event_status, status);
create index candidate_event_members_assertion_idx on public.candidate_event_members(event_assertion_id);
create index review_tasks_matter_priority_idx on public.review_tasks(matter_id, status, priority desc);
create index object_revisions_object_idx on public.object_revisions(object_type, object_id, created_at);
create index regeneration_requests_matter_idx on public.regeneration_requests(matter_id, status);

alter table public.candidate_events enable row level security;
alter table public.candidate_event_members enable row level security;
alter table public.candidate_event_reviews enable row level security;
alter table public.review_tasks enable row level security;
alter table public.object_revisions enable row level security;
alter table public.regeneration_requests enable row level security;
alter table public.chronology_snapshots enable row level security;
create policy candidate_events_select on public.candidate_events for select to authenticated using (private.has_matter_membership(matter_id));
create policy candidate_event_members_select on public.candidate_event_members for select to authenticated using (private.has_matter_membership(matter_id));
create policy candidate_event_reviews_select on public.candidate_event_reviews for select to authenticated using (private.has_matter_membership(matter_id));
create policy review_tasks_select on public.review_tasks for select to authenticated using (private.has_matter_membership(matter_id));
create policy object_revisions_select on public.object_revisions for select to authenticated using (private.has_matter_membership(matter_id));
create policy regeneration_requests_select on public.regeneration_requests for select to authenticated using (private.has_matter_membership(matter_id));
create policy chronology_snapshots_select on public.chronology_snapshots for select to authenticated using (private.has_matter_membership(matter_id));
revoke all on public.candidate_events, public.candidate_event_members, public.candidate_event_reviews, public.review_tasks, public.object_revisions, public.regeneration_requests, public.chronology_snapshots from anon;
revoke insert, update, delete on public.candidate_events, public.candidate_event_members, public.candidate_event_reviews, public.review_tasks, public.object_revisions, public.regeneration_requests, public.chronology_snapshots from authenticated;
grant select on public.candidate_events, public.candidate_event_members, public.candidate_event_reviews, public.review_tasks, public.object_revisions, public.regeneration_requests, public.chronology_snapshots to authenticated;
commit;
