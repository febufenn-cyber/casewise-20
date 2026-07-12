begin;
create table public.date_mentions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade, source_span_id uuid not null references public.source_spans(id) on delete cascade,
  logical_document_id uuid references public.logical_documents(id) on delete cascade, asserting_entity_id uuid references public.entities(id) on delete set null,
  raw_text text not null, normalized_start date, normalized_end date, precision text not null check (precision in ('day','month','year','range','relative','unknown')),
  certainty text not null check (certainty in ('stated','approximate','relative_or_range','ambiguous','inferred','unresolved')),
  date_type text not null default 'unknown', possible_interpretations jsonb not null default '[]'::jsonb,
  creation_method text not null default 'extracted', processing_version text not null, review_status text not null default 'unreviewed',
  status text not null default 'active' check (status in ('active','stale','superseded','deleted')), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.amount_mentions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade, source_span_id uuid not null references public.source_spans(id) on delete cascade,
  logical_document_id uuid references public.logical_documents(id) on delete cascade, asserting_entity_id uuid references public.entities(id) on delete set null,
  raw_text text not null, currency text, normalized_value numeric, scale text not null default 'unknown', amount_type text not null default 'unknown',
  related_entity_id uuid references public.entities(id) on delete set null, alternate_representation text, consistency_status text not null default 'not_checked',
  creation_method text not null default 'extracted', processing_version text not null, review_status text not null default 'unreviewed',
  status text not null default 'active' check (status in ('active','stale','superseded','deleted')), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.identifier_mentions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade, source_span_id uuid not null references public.source_spans(id) on delete cascade,
  logical_document_id uuid references public.logical_documents(id) on delete cascade, entity_id uuid references public.entities(id) on delete set null,
  identifier_type text not null, raw_text text not null, normalized_value text, creation_method text not null default 'extracted',
  processing_version text not null, review_status text not null default 'unreviewed', status text not null default 'active', created_at timestamptz not null default now()
);

create table public.document_references (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade, source_span_id uuid not null references public.source_spans(id) on delete cascade,
  referring_document_id uuid references public.logical_documents(id) on delete cascade, raw_reference text not null, reference_type text not null,
  expected_label text, expected_date_start date, expected_date_end date, expected_document_type text,
  resolved_document_id uuid references public.logical_documents(id) on delete set null, candidate_document_ids uuid[] not null default '{}',
  resolution_status text not null default 'not_reviewed' check (resolution_status in ('resolved','candidate_found','ambiguous','referenced_but_absent','label_conflict','date_conflict','duplicate_candidates','not_reviewed','rejected')),
  processing_version text not null, review_status text not null default 'unreviewed', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create index date_mentions_matter_idx on public.date_mentions(matter_id, normalized_start, date_type);
create index amount_mentions_matter_idx on public.amount_mentions(matter_id, amount_type, normalized_value);
create index identifier_mentions_entity_idx on public.identifier_mentions(entity_id, identifier_type);
create index document_references_matter_idx on public.document_references(matter_id, resolution_status);

alter table public.date_mentions enable row level security;
alter table public.amount_mentions enable row level security;
alter table public.identifier_mentions enable row level security;
alter table public.document_references enable row level security;
create policy date_mentions_select on public.date_mentions for select to authenticated using (private.has_matter_membership(matter_id));
create policy amount_mentions_select on public.amount_mentions for select to authenticated using (private.has_matter_membership(matter_id));
create policy identifier_mentions_select on public.identifier_mentions for select to authenticated using (private.has_matter_membership(matter_id));
create policy document_references_select on public.document_references for select to authenticated using (private.has_matter_membership(matter_id));
revoke all on public.date_mentions, public.amount_mentions, public.identifier_mentions, public.document_references from anon;
revoke insert, update, delete on public.date_mentions, public.amount_mentions, public.identifier_mentions, public.document_references from authenticated;
grant select on public.date_mentions, public.amount_mentions, public.identifier_mentions, public.document_references to authenticated;
commit;
