begin;

create table public.delta_evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  delta_snapshot_id uuid not null references public.delta_snapshots(id) on delete cascade,
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

create table public.delta_evaluation_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  evaluation_run_id uuid not null references public.delta_evaluation_runs(id) on delete cascade,
  delta_item_id uuid references public.delta_items(id) on delete set null,
  expected_change_type text,
  predicted_change_type text,
  outcome text not null check (outcome in ('true_positive','false_positive','false_negative','type_mismatch','material_omission')),
  materiality text not null check (materiality in ('critical','high','medium','low','unrated')),
  source_pair_verified boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create index delta_evaluation_runs_matter_idx on public.delta_evaluation_runs(matter_id, created_at desc, gate_status);
create index delta_evaluation_runs_snapshot_idx on public.delta_evaluation_runs(delta_snapshot_id, created_at desc);
create index delta_evaluation_items_run_idx on public.delta_evaluation_items(evaluation_run_id, outcome, materiality);

alter table public.delta_evaluation_runs enable row level security;
alter table public.delta_evaluation_items enable row level security;

create policy delta_evaluation_runs_select on public.delta_evaluation_runs for select to authenticated using (private.has_matter_membership(matter_id));
create policy delta_evaluation_items_select on public.delta_evaluation_items for select to authenticated using (private.has_matter_membership(matter_id));

revoke all on public.delta_evaluation_runs, public.delta_evaluation_items from anon;
revoke insert, update, delete on public.delta_evaluation_runs, public.delta_evaluation_items from authenticated;
grant select on public.delta_evaluation_runs, public.delta_evaluation_items to authenticated;

commit;
