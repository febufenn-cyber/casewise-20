begin;
create table public.event_assertions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade, logical_document_id uuid references public.logical_documents(id) on delete cascade,
  asserting_entity_id uuid references public.entities(id) on delete set null, event_type text not null default 'unknown', proposition text not null,
  assertion_mode text not null check (assertion_mode in ('affirmed','denied','qualified','reported','quoted','inferred','uncertain')),
  actor_entity_ids uuid[] not null default '{}', object_entity_ids uuid[] not null default '{}', location_entity_ids uuid[] not null default '{}',
  date_mention_ids uuid[] not null default '{}', amount_mention_ids uuid[] not null default '{}', warnings jsonb not null default '[]'::jsonb,
  creation_method text not null default 'extracted' check (creation_method in ('extracted','inferred','manual','imported')),
  processing_version text not null, review_status text not null default 'unreviewed' check (review_status in ('unreviewed','accepted','corrected','rejected','unresolved')),
  status text not null default 'active' check (status in ('active','duplicate','stale','superseded','deleted')),
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.event_assertion_sources (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade, event_assertion_id uuid not null references public.event_assertions(id) on delete cascade,
  source_span_id uuid not null references public.source_spans(id) on delete cascade, source_role text not null default 'primary' check (source_role in ('primary','supporting','context','quoted_source')),
  created_at timestamptz not null default now(), unique (event_assertion_id, source_span_id, source_role)
);

create table public.event_assertion_relations (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade, source_assertion_id uuid not null references public.event_assertions(id) on delete cascade,
  target_assertion_id uuid not null references public.event_assertions(id) on delete cascade,
  relationship_type text not null check (relationship_type in ('duplicate_of','amends','quotes','denies','qualifies','supports','contradicts_candidate')),
  decision_status text not null default 'candidate' check (decision_status in ('candidate','confirmed','rejected','superseded')),
  rationale text, reviewer_id uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
  check (source_assertion_id <> target_assertion_id), unique (source_assertion_id, target_assertion_id, relationship_type)
);

create table public.event_assertion_reviews (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade, event_assertion_id uuid not null references public.event_assertions(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null, decision text not null check (decision in ('accepted','corrected','rejected','unresolved')),
  previous_value jsonb, new_value jsonb, rationale text, created_at timestamptz not null default now()
);

create index event_assertions_matter_idx on public.event_assertions(matter_id, event_type, review_status, status);
create index event_assertion_sources_span_idx on public.event_assertion_sources(source_span_id);
create index event_assertion_relations_target_idx on public.event_assertion_relations(target_assertion_id, relationship_type);

alter table public.event_assertions enable row level security;
alter table public.event_assertion_sources enable row level security;
alter table public.event_assertion_relations enable row level security;
alter table public.event_assertion_reviews enable row level security;
create policy event_assertions_select on public.event_assertions for select to authenticated using (private.has_matter_membership(matter_id));
create policy event_assertion_sources_select on public.event_assertion_sources for select to authenticated using (private.has_matter_membership(matter_id));
create policy event_assertion_relations_select on public.event_assertion_relations for select to authenticated using (private.has_matter_membership(matter_id));
create policy event_assertion_reviews_select on public.event_assertion_reviews for select to authenticated using (private.has_matter_membership(matter_id));
revoke all on public.event_assertions, public.event_assertion_sources, public.event_assertion_relations, public.event_assertion_reviews from anon;
revoke insert, update, delete on public.event_assertions, public.event_assertion_sources, public.event_assertion_relations, public.event_assertion_reviews from authenticated;
grant select on public.event_assertions, public.event_assertion_sources, public.event_assertion_relations, public.event_assertion_reviews to authenticated;
commit;
