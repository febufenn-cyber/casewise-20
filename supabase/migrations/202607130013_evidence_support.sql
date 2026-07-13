begin;
create table public.evidence_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  logical_document_id uuid references public.logical_documents(id) on delete set null,
  offered_by_entity_id uuid references public.entities(id) on delete set null,
  title text not null,
  description text,
  evidence_type text not null check (evidence_type in ('document','testimony','financial_record','correspondence','contract','order','physical_or_digital_record','other')),
  creation_method text not null default 'manual' check (creation_method in ('extracted','manual','inferred')),
  processing_version text not null,
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed','accepted','corrected','rejected','unresolved')),
  status text not null default 'active' check (status in ('active','stale','superseded','deleted')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.evidence_item_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  evidence_item_id uuid not null references public.evidence_items(id) on delete cascade,
  source_span_id uuid not null references public.source_spans(id) on delete cascade,
  source_role text not null default 'primary' check (source_role in ('primary','supporting','context')),
  created_at timestamptz not null default now(),
  unique (evidence_item_id, source_span_id)
);

create table public.proposition_evidence_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  evidence_item_id uuid not null references public.evidence_items(id) on delete cascade,
  target_type text not null check (target_type in ('allegation','response','candidate_event')),
  target_id uuid not null,
  relationship text not null check (relationship in ('supports','contradicts','contextualizes','mentioned_by','relied_upon_for')),
  support_status text not null default 'unreviewed' check (support_status in ('unreviewed','source_verified','support_verified','partially_supported','unsupported','ambiguous')),
  rationale text,
  warnings text[] not null default '{}',
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed','accepted','corrected','rejected','unresolved')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (evidence_item_id, target_type, target_id, relationship)
);

create table public.evidence_support_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  proposition_evidence_link_id uuid not null references public.proposition_evidence_links(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  decision text not null check (decision in ('accepted','corrected','rejected','unresolved')),
  previous_value jsonb,
  new_value jsonb,
  rationale text,
  created_at timestamptz not null default now()
);

create index evidence_items_matter_idx on public.evidence_items(matter_id, status, review_status);
create index evidence_item_sources_span_idx on public.evidence_item_sources(source_span_id);
create index proposition_evidence_target_idx on public.proposition_evidence_links(matter_id, target_type, target_id, support_status);

alter table public.evidence_items enable row level security;
alter table public.evidence_item_sources enable row level security;
alter table public.proposition_evidence_links enable row level security;
alter table public.evidence_support_reviews enable row level security;
create policy evidence_items_select on public.evidence_items for select to authenticated using (private.has_matter_membership(matter_id));
create policy evidence_item_sources_select on public.evidence_item_sources for select to authenticated using (private.has_matter_membership(matter_id));
create policy proposition_evidence_links_select on public.proposition_evidence_links for select to authenticated using (private.has_matter_membership(matter_id));
create policy evidence_support_reviews_select on public.evidence_support_reviews for select to authenticated using (private.has_matter_membership(matter_id));
revoke all on public.evidence_items, public.evidence_item_sources, public.proposition_evidence_links, public.evidence_support_reviews from anon;
revoke insert, update, delete on public.evidence_items, public.evidence_item_sources, public.proposition_evidence_links, public.evidence_support_reviews from authenticated;
grant select on public.evidence_items, public.evidence_item_sources, public.proposition_evidence_links, public.evidence_support_reviews to authenticated;
commit;
