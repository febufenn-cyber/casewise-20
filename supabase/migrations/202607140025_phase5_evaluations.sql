begin;

create table public.phase5_evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  overview_snapshot_id uuid not null references public.matter_overview_snapshots(id) on delete restrict,
  response_plan_snapshot_id uuid not null references public.response_plan_snapshots(id) on delete restrict,
  export_package_id uuid references public.phase5_internal_export_packages(id) on delete set null,
  pack_label text not null,
  baseline_minutes numeric not null check (baseline_minutes > 0),
  casewise_minutes numeric not null check (casewise_minutes >= 0),
  metrics jsonb not null,
  thresholds jsonb not null,
  gate_status text not null check (gate_status in ('passed','failed','incomplete')),
  gate_reasons text[] not null default '{}',
  notes text,
  evaluator_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.phase5_evaluation_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  evaluation_run_id uuid not null references public.phase5_evaluation_runs(id) on delete cascade,
  artifact_type text not null check (artifact_type in ('overview_sentence','response_plan_node','stale_propagation')),
  artifact_id uuid,
  outcome text not null check (outcome in ('supported','unsupported','citation_failure','material_omission','stale_propagation_pass','stale_propagation_failure','correction_none','correction_minor','correction_major','correction_material')),
  materiality text not null default 'unrated' check (materiality in ('critical','high','medium','low','unrated')),
  source_verified boolean not null default false,
  expected_support boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  check ((artifact_type = 'stale_propagation' and artifact_id is null) or (artifact_type <> 'stale_propagation' and artifact_id is not null))
);

create index phase5_evaluation_runs_matter_idx on public.phase5_evaluation_runs(matter_id, created_at desc, gate_status);
create index phase5_evaluation_items_run_idx on public.phase5_evaluation_items(evaluation_run_id, artifact_type, outcome);

alter table public.phase5_evaluation_runs enable row level security;
alter table public.phase5_evaluation_items enable row level security;

create policy phase5_evaluation_runs_select on public.phase5_evaluation_runs for select to authenticated using (private.has_matter_membership(matter_id));
create policy phase5_evaluation_items_select on public.phase5_evaluation_items for select to authenticated using (private.has_matter_membership(matter_id));

revoke all on public.phase5_evaluation_runs, public.phase5_evaluation_items from anon;
revoke insert, update, delete on public.phase5_evaluation_runs, public.phase5_evaluation_items from authenticated;
grant select on public.phase5_evaluation_runs, public.phase5_evaluation_items to authenticated;

commit;
