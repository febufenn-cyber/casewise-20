begin;

create table public.narrative_support_sets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  matrix_snapshot_id uuid not null references public.matter_matrix_snapshots(id) on delete restrict,
  memory_snapshot_id uuid references public.matter_memory_snapshots(id) on delete set null,
  artifact_locks jsonb not null default '{}'::jsonb,
  coverage_summary jsonb not null default '{}'::jsonb,
  sentence_count integer not null default 0,
  blocked_sentence_count integer not null default 0,
  creation_method text not null default 'manual' check (creation_method in ('manual','rule_based','model_assisted')),
  processing_version text not null default 'phase5a-v1',
  production_use_allowed boolean not null default false,
  status text not null default 'draft' check (status in ('draft','active','stale','superseded','deleted')),
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed','accepted','corrected','rejected','unresolved')),
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (matter_id, version_number)
);

create table public.narrative_sentences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  support_set_id uuid not null references public.narrative_support_sets(id) on delete cascade,
  section_key text not null,
  position integer not null default 0 check (position >= 0),
  sentence_text text not null,
  claim_type text not null check (claim_type in ('factual_statement','party_position','procedural_context','uncertainty','omission','internal_note')),
  materiality text not null default 'unrated' check (materiality in ('critical','high','medium','low','unrated')),
  attribution_entity_id uuid references public.entities(id) on delete set null,
  dispute_status text not null default 'unresolved' check (dispute_status in ('uncontested','contested','ambiguous','not_applicable','unresolved')),
  uncertainty_status text not null default 'unresolved' check (uncertainty_status in ('certain','qualified','inferred','ambiguous','unresolved')),
  omission_status text not null default 'none' check (omission_status in ('none','not_located','processing_gap','scope_limited','unresolved')),
  support_status text not null default 'blocked' check (support_status in ('supported','review_required','blocked')),
  warnings text[] not null default '{}',
  creation_method text not null default 'manual' check (creation_method in ('manual','rule_based','model_assisted')),
  processing_version text not null,
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed','accepted','corrected','rejected','unresolved')),
  status text not null default 'active' check (status in ('active','stale','superseded','deleted')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (support_set_id, section_key, position)
);

create table public.narrative_sentence_supports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  sentence_id uuid not null references public.narrative_sentences(id) on delete cascade,
  object_type text not null,
  object_id uuid not null,
  source_span_id uuid not null references public.source_spans(id) on delete restrict,
  support_role text not null default 'primary' check (support_role in ('primary','supporting','context','contradictory','omission_basis')),
  created_at timestamptz not null default now(),
  unique (sentence_id, object_type, object_id, source_span_id, support_role)
);

create table public.narrative_sentence_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  sentence_id uuid not null references public.narrative_sentences(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  decision text not null check (decision in ('accepted','corrected','rejected','unresolved')),
  previous_value jsonb,
  new_value jsonb,
  rationale text,
  created_at timestamptz not null default now()
);

create index narrative_support_sets_matter_idx on public.narrative_support_sets(matter_id, version_number desc, status);
create index narrative_sentences_set_idx on public.narrative_sentences(support_set_id, section_key, position, status);
create index narrative_sentence_supports_span_idx on public.narrative_sentence_supports(source_span_id);
create index narrative_sentence_supports_object_idx on public.narrative_sentence_supports(matter_id, object_type, object_id);

alter table public.narrative_support_sets enable row level security;
alter table public.narrative_sentences enable row level security;
alter table public.narrative_sentence_supports enable row level security;
alter table public.narrative_sentence_reviews enable row level security;

create policy narrative_support_sets_select on public.narrative_support_sets for select to authenticated using (private.has_matter_membership(matter_id));
create policy narrative_sentences_select on public.narrative_sentences for select to authenticated using (private.has_matter_membership(matter_id));
create policy narrative_sentence_supports_select on public.narrative_sentence_supports for select to authenticated using (private.has_matter_membership(matter_id));
create policy narrative_sentence_reviews_select on public.narrative_sentence_reviews for select to authenticated using (private.has_matter_membership(matter_id));

revoke all on public.narrative_support_sets, public.narrative_sentences, public.narrative_sentence_supports, public.narrative_sentence_reviews from anon;
revoke insert, update, delete on public.narrative_support_sets, public.narrative_sentences, public.narrative_sentence_supports, public.narrative_sentence_reviews from authenticated;
grant select on public.narrative_support_sets, public.narrative_sentences, public.narrative_sentence_supports, public.narrative_sentence_reviews to authenticated;

commit;
