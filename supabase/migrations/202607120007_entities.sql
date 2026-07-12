begin;
create table public.entities (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade, entity_type text not null check (entity_type in ('person','organization','court_or_tribunal','account','property','contract','invoice','asset','location','unknown')),
  display_name text not null, normalized_name text not null, identifiers jsonb not null default '{}'::jsonb,
  creation_method text not null default 'extracted' check (creation_method in ('extracted','inferred','manual','imported')),
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed','confirmed','corrected','rejected','unresolved')),
  status text not null default 'active' check (status in ('active','superseded','stale','deleted')),
  superseded_by uuid references public.entities(id) on delete set null, processing_version text not null default 'phase2-entity-v1',
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.entity_mentions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade, entity_id uuid references public.entities(id) on delete set null,
  logical_document_id uuid references public.logical_documents(id) on delete cascade, source_span_id uuid not null references public.source_spans(id) on delete cascade,
  raw_text text not null, normalized_text text not null, mention_type text not null, role_text text, identifiers jsonb not null default '{}'::jsonb,
  extraction_method text not null default 'manual', processing_version text not null, review_status text not null default 'unreviewed',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (source_span_id, raw_text, mention_type, processing_version)
);

create table public.entity_aliases (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade, entity_id uuid not null references public.entities(id) on delete cascade,
  observed_name text not null, normalized_name text not null, relationship text not null check (relationship in ('exact_name','spelling_variant','abbreviation','former_name','trading_name','transliteration','reviewer_alias','unknown')),
  source_span_id uuid references public.source_spans(id) on delete set null, decision_status text not null default 'candidate' check (decision_status in ('candidate','confirmed','rejected')),
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);

create table public.entity_roles (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade, entity_id uuid not null references public.entities(id) on delete cascade,
  role_type text not null, proceeding_context text, valid_from date, valid_to date, source_span_id uuid references public.source_spans(id) on delete set null,
  review_status text not null default 'unreviewed', created_at timestamptz not null default now()
);

create table public.entity_resolution_edges (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade, left_entity_id uuid not null references public.entities(id) on delete cascade,
  right_entity_id uuid not null references public.entities(id) on delete cascade, score numeric not null check (score >= 0 and score <= 1), reasons jsonb not null default '[]'::jsonb,
  proposal_status text not null check (proposal_status in ('strong_candidate','review_candidate','blocked','rejected','confirmed')),
  processing_version text not null, created_at timestamptz not null default now(), check (left_entity_id <> right_entity_id)
);

create table public.entity_resolution_decisions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade, target_entity_id uuid not null references public.entities(id) on delete cascade,
  source_entity_ids uuid[] not null, decision text not null check (decision in ('merged','kept_separate','undone')),
  rationale text, reversible_snapshot jsonb not null default '{}'::jsonb, reviewer_id uuid references auth.users(id) on delete set null,
  reversed_decision_id uuid references public.entity_resolution_decisions(id) on delete set null, created_at timestamptz not null default now()
);

alter table public.logical_documents add column authored_by_entity_id uuid references public.entities(id) on delete set null;
create index entities_matter_name_idx on public.entities(matter_id, normalized_name, status);
create index entity_mentions_entity_idx on public.entity_mentions(entity_id, review_status);
create index entity_mentions_source_idx on public.entity_mentions(source_span_id);
create index entity_roles_entity_idx on public.entity_roles(entity_id, role_type);
create index entity_edges_matter_idx on public.entity_resolution_edges(matter_id, proposal_status);

alter table public.entities enable row level security;
alter table public.entity_mentions enable row level security;
alter table public.entity_aliases enable row level security;
alter table public.entity_roles enable row level security;
alter table public.entity_resolution_edges enable row level security;
alter table public.entity_resolution_decisions enable row level security;
create policy entities_select on public.entities for select to authenticated using (private.has_matter_membership(matter_id));
create policy entity_mentions_select on public.entity_mentions for select to authenticated using (private.has_matter_membership(matter_id));
create policy entity_aliases_select on public.entity_aliases for select to authenticated using (private.has_matter_membership(matter_id));
create policy entity_roles_select on public.entity_roles for select to authenticated using (private.has_matter_membership(matter_id));
create policy entity_edges_select on public.entity_resolution_edges for select to authenticated using (private.has_matter_membership(matter_id));
create policy entity_decisions_select on public.entity_resolution_decisions for select to authenticated using (private.has_matter_membership(matter_id));
revoke all on public.entities, public.entity_mentions, public.entity_aliases, public.entity_roles, public.entity_resolution_edges, public.entity_resolution_decisions from anon;
revoke insert, update, delete on public.entities, public.entity_mentions, public.entity_aliases, public.entity_roles, public.entity_resolution_edges, public.entity_resolution_decisions from authenticated;
grant select on public.entities, public.entity_mentions, public.entity_aliases, public.entity_roles, public.entity_resolution_edges, public.entity_resolution_decisions to authenticated;
commit;
