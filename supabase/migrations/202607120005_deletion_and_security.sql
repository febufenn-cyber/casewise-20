begin;
create type public.deletion_status as enum ('deletion_requested','access_revoked','jobs_cancelled','artifacts_deleting','verification_pending','deleted','deletion_failed');
create table public.deletion_requests (
  id uuid primary key, organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade, requested_by uuid references auth.users(id) on delete set null,
  reason text, status public.deletion_status not null, verification_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), completed_at timestamptz
);
create table public.security_events (
  id bigint generated always as identity primary key, organization_id uuid references public.organizations(id) on delete set null,
  matter_id uuid references public.matters(id) on delete set null, actor_id uuid references auth.users(id) on delete set null,
  category text not null, severity text not null check (severity in ('info','warning','high','critical')),
  resource_type text, resource_id text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index deletion_requests_matter_idx on public.deletion_requests(matter_id, created_at desc);
create index security_events_created_idx on public.security_events(severity, created_at desc);
alter table public.deletion_requests enable row level security;
alter table public.security_events enable row level security;
create policy deletion_requests_select on public.deletion_requests for select to authenticated using (private.has_matter_membership(matter_id, array['matter_manager']::public.matter_role[]));
create policy security_events_select on public.security_events for select to authenticated using (matter_id is not null and private.has_matter_membership(matter_id, array['matter_manager']::public.matter_role[]));
revoke all on public.deletion_requests, public.security_events from anon;
revoke insert, update, delete on public.deletion_requests, public.security_events from authenticated;
grant select on public.deletion_requests, public.security_events to authenticated;
commit;
