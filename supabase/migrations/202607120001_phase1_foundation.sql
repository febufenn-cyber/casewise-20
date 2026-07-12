begin;

create extension if not exists pgcrypto;
create schema if not exists private;

create type public.organization_role as enum ('owner', 'admin', 'member');
create type public.matter_role as enum ('matter_manager', 'editor', 'reviewer', 'viewer');
create type public.membership_status as enum ('active', 'invited', 'suspended', 'revoked');
create type public.matter_status as enum ('active', 'locked', 'deletion_pending', 'deleted');
create type public.audit_outcome as enum ('success', 'denied', 'failed');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 200),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null,
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create table public.matters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 300),
  status public.matter_status not null default 'active',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deletion_requested_at timestamptz, deleted_at timestamptz
);
create table public.matter_memberships (
  matter_id uuid not null references public.matters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.matter_role not null,
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (matter_id, user_id)
);
create table public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid references public.matters(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null, resource_type text not null, resource_id text,
  outcome public.audit_outcome not null default 'success', request_id text,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create index organization_memberships_user_idx on public.organization_memberships(user_id, organization_id) where status = 'active';
create index matter_memberships_user_idx on public.matter_memberships(user_id, matter_id) where status = 'active';
create index matters_org_idx on public.matters(organization_id, created_at desc);
create index audit_events_matter_idx on public.audit_events(matter_id, created_at desc);

create or replace function private.has_org_membership(target_org uuid, allowed_roles public.organization_role[] default null)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.organization_memberships om where om.organization_id = target_org and om.user_id = auth.uid() and om.status = 'active' and (allowed_roles is null or om.role = any(allowed_roles)));
$$;
create or replace function private.has_matter_membership(target_matter uuid, allowed_roles public.matter_role[] default null)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.matter_memberships mm where mm.matter_id = target_matter and mm.user_id = auth.uid() and mm.status = 'active' and (allowed_roles is null or mm.role = any(allowed_roles)));
$$;
revoke all on function private.has_org_membership(uuid, public.organization_role[]) from public;
revoke all on function private.has_matter_membership(uuid, public.matter_role[]) from public;
grant execute on function private.has_org_membership(uuid, public.organization_role[]) to authenticated;
grant execute on function private.has_matter_membership(uuid, public.matter_role[]) to authenticated;

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.matters enable row level security;
alter table public.matter_memberships enable row level security;
alter table public.audit_events enable row level security;
create policy organizations_select on public.organizations for select to authenticated using (private.has_org_membership(id));
create policy organization_memberships_select on public.organization_memberships for select to authenticated using (user_id = auth.uid() or private.has_org_membership(organization_id, array['owner','admin']::public.organization_role[]));
create policy matters_select on public.matters for select to authenticated using (private.has_matter_membership(id));
create policy matter_memberships_select on public.matter_memberships for select to authenticated using (user_id = auth.uid() or private.has_matter_membership(matter_id, array['matter_manager']::public.matter_role[]));
create policy audit_events_select on public.audit_events for select to authenticated using (matter_id is not null and private.has_matter_membership(matter_id, array['matter_manager','reviewer']::public.matter_role[]));

revoke all on public.organizations, public.organization_memberships, public.matters, public.matter_memberships, public.audit_events from anon;
revoke insert, update, delete on public.organizations, public.organization_memberships, public.matters, public.matter_memberships, public.audit_events from authenticated;
grant select on public.organizations, public.organization_memberships, public.matters, public.matter_memberships, public.audit_events to authenticated;

commit;
