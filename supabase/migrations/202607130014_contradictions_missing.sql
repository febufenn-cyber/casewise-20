begin;
create table public.contradiction_candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  object_a_type text not null,
  object_a_id uuid not null,
  object_b_type text not null,
  object_b_id uuid not null,
  contradiction_type text not null check (contradiction_type in ('date','amount','identity','position','occurrence','contractual_term','procedural','other')),
  explanation text,
  materiality text not null default 'unrated' check (materiality in ('critical','high','medium','low','unrated')),
  warnings text[] not null default '{}',
  decision_status text not null default 'candidate' check (decision_status in ('candidate','confirmed','explained','duplicate','false_positive','unresolved')),
  creation_method text not null default 'manual' check (creation_method in ('extracted','manual','inferred')),
  processing_version text not null,
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed','accepted','corrected','rejected','unresolved')),
  status text not null default 'active' check (status in ('active','stale','superseded','deleted')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not (object_a_type = object_b_type and object_a_id = object_b_id)),
  unique (matter_id, object_a_type, object_a_id, object_b_type, object_b_id, contradiction_type)
);

create table public.contradiction_candidate_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  contradiction_candidate_id uuid not null references public.contradiction_candidates(id) on delete cascade,
  side text not null check (side in ('a','b')),
  source_span_id uuid not null references public.source_spans(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (contradiction_candidate_id, side, source_span_id)
);

create table public.contradiction_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  contradiction_candidate_id uuid not null references public.contradiction_candidates(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  decision text not null check (decision in ('confirmed','explained','duplicate','false_positive','unresolved')),
  previous_value jsonb,
  new_value jsonb,
  rationale text,
  created_at timestamptz not null default now()
);

create table public.missing_information_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  category text not null check (category in ('referenced_document','unreadable_page','unsupported_allegation','unaddressed_allegation','inconsistent_date','inconsistent_amount','unresolved_identity','client_question','other')),
  title text not null,
  description text,
  scope_note text,
  materiality text not null default 'unrated' check (materiality in ('critical','high','medium','low','unrated')),
  related_type text,
  related_id uuid,
  resolution_status text not null default 'open' check (resolution_status in ('open','in_progress','resolved','dismissed','unresolved')),
  resolution text,
  created_by uuid references auth.users(id) on delete set null,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.missing_information_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  missing_information_item_id uuid not null references public.missing_information_items(id) on delete cascade,
  source_span_id uuid not null references public.source_spans(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (missing_information_item_id, source_span_id)
);

create table public.missing_information_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  missing_information_item_id uuid not null references public.missing_information_items(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  decision text not null check (decision in ('resolved','dismissed','unresolved','corrected')),
  previous_value jsonb,
  new_value jsonb,
  rationale text,
  created_at timestamptz not null default now()
);

create index contradiction_candidates_matter_idx on public.contradiction_candidates(matter_id, status, decision_status, materiality);
create index contradiction_sources_span_idx on public.contradiction_candidate_sources(source_span_id);
create index missing_information_matter_idx on public.missing_information_items(matter_id, resolution_status, materiality);

alter table public.contradiction_candidates enable row level security;
alter table public.contradiction_candidate_sources enable row level security;
alter table public.contradiction_reviews enable row level security;
alter table public.missing_information_items enable row level security;
alter table public.missing_information_sources enable row level security;
alter table public.missing_information_reviews enable row level security;
create policy contradiction_candidates_select on public.contradiction_candidates for select to authenticated using (private.has_matter_membership(matter_id));
create policy contradiction_candidate_sources_select on public.contradiction_candidate_sources for select to authenticated using (private.has_matter_membership(matter_id));
create policy contradiction_reviews_select on public.contradiction_reviews for select to authenticated using (private.has_matter_membership(matter_id));
create policy missing_information_items_select on public.missing_information_items for select to authenticated using (private.has_matter_membership(matter_id));
create policy missing_information_sources_select on public.missing_information_sources for select to authenticated using (private.has_matter_membership(matter_id));
create policy missing_information_reviews_select on public.missing_information_reviews for select to authenticated using (private.has_matter_membership(matter_id));
revoke all on public.contradiction_candidates, public.contradiction_candidate_sources, public.contradiction_reviews, public.missing_information_items, public.missing_information_sources, public.missing_information_reviews from anon;
revoke insert, update, delete on public.contradiction_candidates, public.contradiction_candidate_sources, public.contradiction_reviews, public.missing_information_items, public.missing_information_sources, public.missing_information_reviews from authenticated;
grant select on public.contradiction_candidates, public.contradiction_candidate_sources, public.contradiction_reviews, public.missing_information_items, public.missing_information_sources, public.missing_information_reviews to authenticated;
commit;
