-- =============================================================================
-- SPIORA_SUPABASE_PATCH_027_KNOWLEDGE_BASE_ATTACHMENTS.sql
-- PR #20 — Knowledge Base Attachments Phase 1 (PDF + images)
-- Idempotent. Non-destructive. No secrets. Do NOT auto-apply.
-- Requires migration 026 (knowledge_base_articles) already applied.
-- =============================================================================

-- =============================================================================
-- 1. Table
-- =============================================================================

create table if not exists public.knowledge_base_attachments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null
    references public.knowledge_base_articles (id) on delete restrict,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null,
  storage_bucket text not null default 'knowledge-base',
  storage_path text not null,
  caption text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  status text not null default 'active',
  -- session user id (UUID string in Supabase Auth; demo roster key locally)
  uploaded_by text not null default '',
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint knowledge_base_attachments_file_name_check
    check (length(trim(file_name)) > 0 and length(file_name) <= 255),
  constraint knowledge_base_attachments_mime_check
    check (mime_type in (
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp'
    )),
  constraint knowledge_base_attachments_size_check
    check (file_size > 0 and file_size <= 26214400),
  constraint knowledge_base_attachments_status_check
    check (status in ('active', 'archived')),
  constraint knowledge_base_attachments_path_check
    check (
      storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|png|jpe?g|webp)$'
    ),
  constraint knowledge_base_attachments_bucket_check
    check (storage_bucket = 'knowledge-base')
);

create unique index if not exists knowledge_base_attachments_storage_path_uidx
  on public.knowledge_base_attachments (storage_bucket, storage_path);

create index if not exists knowledge_base_attachments_article_idx
  on public.knowledge_base_attachments (article_id, sort_order, created_at)
  where status = 'active' and archived_at is null;

create index if not exists knowledge_base_attachments_article_status_idx
  on public.knowledge_base_attachments (article_id, status);

comment on table public.knowledge_base_attachments is
  'KB Phase 1 attachments (PDF/images). Binaries live in private Storage bucket knowledge-base.';

-- =============================================================================
-- 2. Hard delete guard
-- =============================================================================

drop trigger if exists knowledge_base_attachments_block_hard_delete
  on public.knowledge_base_attachments;
create trigger knowledge_base_attachments_block_hard_delete
  before delete on public.knowledge_base_attachments
  for each row
  execute function public.spiora_block_hard_delete();

-- =============================================================================
-- 3. Privileges
-- =============================================================================

revoke all on table public.knowledge_base_attachments from anon, public;
grant select, insert, update on table public.knowledge_base_attachments to authenticated;
revoke delete on table public.knowledge_base_attachments from authenticated;

-- =============================================================================
-- 4. RLS
-- =============================================================================

alter table public.knowledge_base_attachments enable row level security;

-- Owner sees all attachments (including draft parents / archived rows for manage UI)
drop policy if exists rls_kb_attachments_select_owner on public.knowledge_base_attachments;
create policy rls_kb_attachments_select_owner
  on public.knowledge_base_attachments
  for select
  to authenticated
  using (public.is_spiora_owner());

-- Readers: active attachment + parent article published & not archived
drop policy if exists rls_kb_attachments_select_published on public.knowledge_base_attachments;
create policy rls_kb_attachments_select_published
  on public.knowledge_base_attachments
  for select
  to authenticated
  using (
    status = 'active'
    and archived_at is null
    and exists (
      select 1
      from public.knowledge_base_articles a
      where a.id = knowledge_base_attachments.article_id
        and public.kb_article_visible_to_reader(a)
    )
  );

drop policy if exists rls_kb_attachments_insert_owner on public.knowledge_base_attachments;
create policy rls_kb_attachments_insert_owner
  on public.knowledge_base_attachments
  for insert
  to authenticated
  with check (public.is_spiora_owner());

drop policy if exists rls_kb_attachments_update_owner on public.knowledge_base_attachments;
create policy rls_kb_attachments_update_owner
  on public.knowledge_base_attachments
  for update
  to authenticated
  using (public.is_spiora_owner())
  with check (public.is_spiora_owner());

-- =============================================================================
-- 5. Private Storage bucket
-- Access pattern: Next.js API + service_role only (same as task-attachments).
-- Do NOT expose permanent public URLs.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'knowledge-base',
  'knowledge-base',
  false,
  26214400,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
