begin;

create table public.phase5_artifact_dependencies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  upstream_type text not null,
  upstream_id uuid not null,
  downstream_type text not null check (downstream_type in ('matter_overview_snapshot','response_plan_snapshot')),
  downstream_id uuid not null,
  dependency_reason text not null,
  status text not null default 'active' check (status in ('active','stale','deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (matter_id, upstream_type, upstream_id, downstream_type, downstream_id, dependency_reason)
);

create table public.phase5_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  artifact_type text not null check (artifact_type in ('matter_overview_snapshot','response_plan_snapshot')),
  artifact_id uuid not null,
  artifact_version integer not null check (artifact_version > 0),
  decision text not null check (decision in ('attorney_approved','rejected','revoked')),
  readiness jsonb not null,
  reviewer_id uuid references auth.users(id) on delete set null,
  rationale text,
  created_at timestamptz not null default now()
);

create table public.phase5_invalidation_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  upstream_type text not null,
  upstream_id uuid not null,
  reason text not null,
  invalidated_targets jsonb not null default '[]'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.phase5_internal_export_packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  overview_snapshot_id uuid not null references public.matter_overview_snapshots(id) on delete restrict,
  response_plan_snapshot_id uuid not null references public.response_plan_snapshots(id) on delete restrict,
  manifest jsonb not null,
  manifest_fingerprint text not null,
  classification text not null default 'internal_only' check (classification = 'internal_only'),
  filing_ready boolean not null default false check (filing_ready = false),
  production_use_allowed boolean not null default false check (production_use_allowed = false),
  watermark text not null default 'INTERNAL ATTORNEY WORK PRODUCT — NOT FILING READY',
  export_status text not null default 'active' check (export_status in ('active','invalidated','deleted')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  invalidated_at timestamptz,
  unique (matter_id, version_number),
  unique (matter_id, manifest_fingerprint)
);

create table public.phase5_internal_export_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  export_package_id uuid not null references public.phase5_internal_export_packages(id) on delete cascade,
  item_type text not null check (item_type in ('overview_sentence','response_plan_node','source_span','artifact_lock','disclaimer')),
  item_id text not null,
  manifest_fragment jsonb not null,
  created_at timestamptz not null default now(),
  unique (export_package_id, item_type, item_id)
);

create index phase5_dependencies_upstream_idx on public.phase5_artifact_dependencies(matter_id, upstream_type, upstream_id, status);
create index phase5_dependencies_downstream_idx on public.phase5_artifact_dependencies(matter_id, downstream_type, downstream_id, status);
create index phase5_approvals_artifact_idx on public.phase5_approvals(matter_id, artifact_type, artifact_id, created_at desc);
create index phase5_exports_matter_idx on public.phase5_internal_export_packages(matter_id, version_number desc, export_status);
create index phase5_export_items_package_idx on public.phase5_internal_export_items(export_package_id, item_type);

alter table public.phase5_artifact_dependencies enable row level security;
alter table public.phase5_approvals enable row level security;
alter table public.phase5_invalidation_events enable row level security;
alter table public.phase5_internal_export_packages enable row level security;
alter table public.phase5_internal_export_items enable row level security;

create policy phase5_artifact_dependencies_select on public.phase5_artifact_dependencies for select to authenticated using (private.has_matter_membership(matter_id));
create policy phase5_approvals_select on public.phase5_approvals for select to authenticated using (private.has_matter_membership(matter_id));
create policy phase5_invalidation_events_select on public.phase5_invalidation_events for select to authenticated using (private.has_matter_membership(matter_id));
create policy phase5_internal_export_packages_select on public.phase5_internal_export_packages for select to authenticated using (private.has_matter_membership(matter_id));
create policy phase5_internal_export_items_select on public.phase5_internal_export_items for select to authenticated using (private.has_matter_membership(matter_id));

revoke all on public.phase5_artifact_dependencies, public.phase5_approvals, public.phase5_invalidation_events, public.phase5_internal_export_packages, public.phase5_internal_export_items from anon;
revoke insert, update, delete on public.phase5_artifact_dependencies, public.phase5_approvals, public.phase5_invalidation_events, public.phase5_internal_export_packages, public.phase5_internal_export_items from authenticated;
grant select on public.phase5_artifact_dependencies, public.phase5_approvals, public.phase5_invalidation_events, public.phase5_internal_export_packages, public.phase5_internal_export_items to authenticated;

commit;
