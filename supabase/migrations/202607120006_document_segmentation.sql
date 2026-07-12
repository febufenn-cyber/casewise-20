begin;
create table public.segmentation_versions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade, uploaded_file_id uuid not null references public.uploaded_files(id) on delete cascade,
  version_number integer not null check (version_number > 0), source_processing_version text not null,
  status text not null default 'draft' check (status in ('draft','active','superseded','stale','deleted')),
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), activated_at timestamptz,
  unique (uploaded_file_id, version_number)
);

alter table public.logical_documents
  add column segmentation_version_id uuid references public.segmentation_versions(id) on delete cascade,
  add column ordinal integer,
  add column document_family text not null default 'unknown',
  add column document_subtype text not null default 'unknown',
  add column annexure_label text,
  add column classification_basis text not null default 'unreviewed',
  add column review_status text not null default 'unreviewed',
  add column metadata jsonb not null default '{}'::jsonb,
  add column updated_at timestamptz not null default now(),
  add column superseded_by uuid references public.logical_documents(id) on delete set null;

create table public.segmentation_boundary_proposals (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade, uploaded_file_id uuid not null references public.uploaded_files(id) on delete cascade,
  segmentation_version_id uuid not null references public.segmentation_versions(id) on delete cascade,
  pdf_page_index integer not null check (pdf_page_index >= 0), score numeric not null, reasons jsonb not null default '[]'::jsonb,
  proposal_status text not null default 'probable' check (proposal_status in ('deterministic','strongly_indicated','probable','ambiguous','rejected','accepted')),
  created_at timestamptz not null default now(), unique (segmentation_version_id, pdf_page_index)
);

create table public.document_relationships (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  source_document_id uuid not null references public.logical_documents(id) on delete cascade,
  target_document_id uuid not null references public.logical_documents(id) on delete cascade,
  relationship_type text not null check (relationship_type in ('exact_duplicate','near_duplicate','annotated_copy','certified_copy','amended_version','supersedes','partial_copy','translation_of','attachment_to','annexure_of','unknown_relationship')),
  decision_status text not null default 'candidate' check (decision_status in ('candidate','confirmed','rejected','superseded')),
  rationale text, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
  check (source_document_id <> target_document_id), unique (source_document_id, target_document_id, relationship_type)
);

create table public.segmentation_reviews (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade, segmentation_version_id uuid not null references public.segmentation_versions(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null, decision text not null check (decision in ('accepted','edited','rejected','superseded')),
  rationale text, created_at timestamptz not null default now()
);

create index segmentation_versions_file_idx on public.segmentation_versions(uploaded_file_id, status);
create index logical_documents_segmentation_idx on public.logical_documents(segmentation_version_id, ordinal);
create index boundary_proposals_version_idx on public.segmentation_boundary_proposals(segmentation_version_id, pdf_page_index);
create index document_relationships_matter_idx on public.document_relationships(matter_id, relationship_type);

alter table public.segmentation_versions enable row level security;
alter table public.segmentation_boundary_proposals enable row level security;
alter table public.document_relationships enable row level security;
alter table public.segmentation_reviews enable row level security;
create policy segmentation_versions_select on public.segmentation_versions for select to authenticated using (private.has_matter_membership(matter_id));
create policy boundary_proposals_select on public.segmentation_boundary_proposals for select to authenticated using (private.has_matter_membership(matter_id));
create policy document_relationships_select on public.document_relationships for select to authenticated using (private.has_matter_membership(matter_id));
create policy segmentation_reviews_select on public.segmentation_reviews for select to authenticated using (private.has_matter_membership(matter_id));
revoke all on public.segmentation_versions, public.segmentation_boundary_proposals, public.document_relationships, public.segmentation_reviews from anon;
revoke insert, update, delete on public.segmentation_versions, public.segmentation_boundary_proposals, public.document_relationships, public.segmentation_reviews from authenticated;
grant select on public.segmentation_versions, public.segmentation_boundary_proposals, public.document_relationships, public.segmentation_reviews to authenticated;
commit;
