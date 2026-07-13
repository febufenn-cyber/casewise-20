begin;
create table public.allegations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  logical_document_id uuid references public.logical_documents(id) on delete set null,
  alleging_entity_id uuid references public.entities(id) on delete set null,
  target_entity_ids uuid[] not null default '{}',
  proposition text not null check (char_length(proposition) between 3 and 4000),
  allegation_type text not null default 'factual' check (allegation_type in ('factual','contractual','procedural','monetary','conduct','entitlement','causation','damage','other')),
  procedural_context text,
  materiality text not null default 'unrated' check (materiality in ('critical','high','medium','low','unrated')),
  warnings text[] not null default '{}',
  creation_method text not null default 'manual' check (creation_method in ('extracted','manual','inferred')),
  processing_version text not null,
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed','accepted','corrected','rejected','unresolved')),
  status text not null default 'active' check (status in ('active','stale','superseded','deleted')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.allegation_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  allegation_id uuid not null references public.allegations(id) on delete cascade,
  source_span_id uuid not null references public.source_spans(id) on delete cascade,
  source_role text not null default 'primary' check (source_role in ('primary','supporting','quoted','context')),
  created_at timestamptz not null default now(),
  unique (allegation_id, source_span_id)
);

create table public.allegation_relations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  source_allegation_id uuid not null references public.allegations(id) on delete cascade,
  target_allegation_id uuid not null references public.allegations(id) on delete cascade,
  relationship_type text not null check (relationship_type in ('duplicate_of','restates','narrows','expands','amends','withdraws')),
  decision_status text not null default 'candidate' check (decision_status in ('candidate','confirmed','rejected','unresolved')),
  rationale text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (source_allegation_id, target_allegation_id, relationship_type),
  check (source_allegation_id <> target_allegation_id)
);

create table public.allegation_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  allegation_id uuid not null references public.allegations(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  decision text not null check (decision in ('accepted','corrected','rejected','unresolved')),
  previous_value jsonb,
  new_value jsonb,
  rationale text,
  created_at timestamptz not null default now()
);

create index allegations_matter_idx on public.allegations(matter_id, status, materiality, review_status);
create index allegation_sources_span_idx on public.allegation_sources(source_span_id);
create index allegation_relations_target_idx on public.allegation_relations(target_allegation_id, decision_status);

alter table public.allegations enable row level security;
alter table public.allegation_sources enable row level security;
alter table public.allegation_relations enable row level security;
alter table public.allegation_reviews enable row level security;
create policy allegations_select on public.allegations for select to authenticated using (private.has_matter_membership(matter_id));
create policy allegation_sources_select on public.allegation_sources for select to authenticated using (private.has_matter_membership(matter_id));
create policy allegation_relations_select on public.allegation_relations for select to authenticated using (private.has_matter_membership(matter_id));
create policy allegation_reviews_select on public.allegation_reviews for select to authenticated using (private.has_matter_membership(matter_id));
revoke all on public.allegations, public.allegation_sources, public.allegation_relations, public.allegation_reviews from anon;
revoke insert, update, delete on public.allegations, public.allegation_sources, public.allegation_relations, public.allegation_reviews from authenticated;
grant select on public.allegations, public.allegation_sources, public.allegation_relations, public.allegation_reviews to authenticated;
commit;
