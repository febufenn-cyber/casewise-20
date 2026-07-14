begin;

create table public.response_plan_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  matrix_snapshot_id uuid not null references public.matter_matrix_snapshots(id) on delete restrict,
  overview_snapshot_id uuid not null references public.matter_overview_snapshots(id) on delete restrict,
  title text not null,
  artifact_locks jsonb not null,
  readiness jsonb not null default '{}'::jsonb,
  node_count integer not null default 0,
  blocked_node_count integer not null default 0,
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

create table public.response_plan_nodes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  plan_snapshot_id uuid not null references public.response_plan_snapshots(id) on delete cascade,
  matrix_row_id uuid not null references public.matter_matrix_rows(id) on delete restrict,
  allegation_id uuid not null references public.allegations(id) on delete restrict,
  node_type text not null check (node_type in ('factual_answer','evidence_to_verify','client_question','contradiction_to_resolve','authority_research_task','internal_note')),
  title text not null,
  details text,
  materiality text not null default 'unrated' check (materiality in ('critical','high','medium','low','unrated')),
  node_status text not null default 'open' check (node_status in ('open','in_progress','blocked','resolved','dismissed')),
  assigned_to uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  position integer not null default 0 check (position >= 0),
  warnings text[] not null default '{}',
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed','accepted','corrected','rejected','unresolved')),
  status text not null default 'active' check (status in ('active','stale','superseded','deleted')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_snapshot_id, matrix_row_id, position)
);

create table public.response_plan_node_supports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  plan_node_id uuid not null references public.response_plan_nodes(id) on delete cascade,
  object_type text not null,
  object_id uuid not null,
  source_span_id uuid not null references public.source_spans(id) on delete restrict,
  support_role text not null default 'primary' check (support_role in ('primary','supporting','context','contradictory','question_basis')),
  created_at timestamptz not null default now(),
  unique (plan_node_id, object_type, object_id, source_span_id, support_role)
);

create table public.response_plan_dependencies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  plan_snapshot_id uuid not null references public.response_plan_snapshots(id) on delete cascade,
  node_id uuid not null references public.response_plan_nodes(id) on delete cascade,
  depends_on_node_id uuid not null references public.response_plan_nodes(id) on delete cascade,
  dependency_type text not null default 'blocks' check (dependency_type in ('blocks','informs','requires_resolution')),
  created_at timestamptz not null default now(),
  check (node_id <> depends_on_node_id),
  unique (node_id, depends_on_node_id, dependency_type)
);

create table public.response_plan_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  plan_snapshot_id uuid not null references public.response_plan_snapshots(id) on delete cascade,
  plan_node_id uuid references public.response_plan_nodes(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  decision text not null check (decision in ('accepted','corrected','rejected','unresolved','status_changed')),
  previous_value jsonb,
  new_value jsonb,
  rationale text,
  created_at timestamptz not null default now()
);

create index response_plan_snapshots_matter_idx on public.response_plan_snapshots(matter_id, version_number desc, status, approval_status);
create index response_plan_nodes_snapshot_idx on public.response_plan_nodes(plan_snapshot_id, matrix_row_id, position, status);
create index response_plan_node_supports_span_idx on public.response_plan_node_supports(source_span_id);
create index response_plan_dependencies_snapshot_idx on public.response_plan_dependencies(plan_snapshot_id, node_id);

alter table public.response_plan_snapshots enable row level security;
alter table public.response_plan_nodes enable row level security;
alter table public.response_plan_node_supports enable row level security;
alter table public.response_plan_dependencies enable row level security;
alter table public.response_plan_reviews enable row level security;

create policy response_plan_snapshots_select on public.response_plan_snapshots for select to authenticated using (private.has_matter_membership(matter_id));
create policy response_plan_nodes_select on public.response_plan_nodes for select to authenticated using (private.has_matter_membership(matter_id));
create policy response_plan_node_supports_select on public.response_plan_node_supports for select to authenticated using (private.has_matter_membership(matter_id));
create policy response_plan_dependencies_select on public.response_plan_dependencies for select to authenticated using (private.has_matter_membership(matter_id));
create policy response_plan_reviews_select on public.response_plan_reviews for select to authenticated using (private.has_matter_membership(matter_id));

revoke all on public.response_plan_snapshots, public.response_plan_nodes, public.response_plan_node_supports, public.response_plan_dependencies, public.response_plan_reviews from anon;
revoke insert, update, delete on public.response_plan_snapshots, public.response_plan_nodes, public.response_plan_node_supports, public.response_plan_dependencies, public.response_plan_reviews from authenticated;
grant select on public.response_plan_snapshots, public.response_plan_nodes, public.response_plan_node_supports, public.response_plan_dependencies, public.response_plan_reviews to authenticated;

commit;
