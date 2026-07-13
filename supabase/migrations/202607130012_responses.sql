begin;
create table public.responses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  logical_document_id uuid references public.logical_documents(id) on delete set null,
  responding_entity_id uuid references public.entities(id) on delete set null,
  proposition text not null check (char_length(proposition) between 2 and 4000),
  response_mode text not null default 'direct' check (response_mode in ('direct','quoted','reported','inferred')),
  warnings text[] not null default '{}',
  creation_method text not null default 'manual' check (creation_method in ('extracted','manual','inferred')),
  processing_version text not null,
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed','accepted','corrected','rejected','unresolved')),
  status text not null default 'active' check (status in ('active','stale','superseded','deleted')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.response_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  response_id uuid not null references public.responses(id) on delete cascade,
  source_span_id uuid not null references public.source_spans(id) on delete cascade,
  source_role text not null default 'primary' check (source_role in ('primary','supporting','quoted','context')),
  created_at timestamptz not null default now(),
  unique (response_id, source_span_id)
);

create table public.allegation_response_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  allegation_id uuid not null references public.allegations(id) on delete cascade,
  response_id uuid not null references public.responses(id) on delete cascade,
  response_class text not null check (response_class in ('admitted','denied','partially_admitted','not_specifically_answered','ambiguous','contradicted_elsewhere')),
  addressed_scope text not null default 'unclear' check (addressed_scope in ('full','partial','unclear')),
  rationale text,
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed','accepted','corrected','rejected','unresolved')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (allegation_id, response_id)
);

create table public.allegation_response_searches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  allegation_id uuid not null references public.allegations(id) on delete cascade,
  expected_responding_entity_id uuid references public.entities(id) on delete set null,
  searched_document_ids uuid[] not null default '{}',
  coverage_status text not null default 'not_reviewed' check (coverage_status in ('not_reviewed','located','not_located','incomplete')),
  scope_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.response_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  response_id uuid not null references public.responses(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  decision text not null check (decision in ('accepted','corrected','rejected','unresolved')),
  previous_value jsonb,
  new_value jsonb,
  rationale text,
  created_at timestamptz not null default now()
);

create index responses_matter_idx on public.responses(matter_id, status, review_status);
create index response_sources_span_idx on public.response_sources(source_span_id);
create index allegation_response_links_allegation_idx on public.allegation_response_links(allegation_id, response_class, review_status);
create index allegation_response_searches_allegation_idx on public.allegation_response_searches(allegation_id, coverage_status);

alter table public.responses enable row level security;
alter table public.response_sources enable row level security;
alter table public.allegation_response_links enable row level security;
alter table public.allegation_response_searches enable row level security;
alter table public.response_reviews enable row level security;
create policy responses_select on public.responses for select to authenticated using (private.has_matter_membership(matter_id));
create policy response_sources_select on public.response_sources for select to authenticated using (private.has_matter_membership(matter_id));
create policy allegation_response_links_select on public.allegation_response_links for select to authenticated using (private.has_matter_membership(matter_id));
create policy allegation_response_searches_select on public.allegation_response_searches for select to authenticated using (private.has_matter_membership(matter_id));
create policy response_reviews_select on public.response_reviews for select to authenticated using (private.has_matter_membership(matter_id));
revoke all on public.responses, public.response_sources, public.allegation_response_links, public.allegation_response_searches, public.response_reviews from anon;
revoke insert, update, delete on public.responses, public.response_sources, public.allegation_response_links, public.allegation_response_searches, public.response_reviews from authenticated;
grant select on public.responses, public.response_sources, public.allegation_response_links, public.allegation_response_searches, public.response_reviews to authenticated;
commit;
