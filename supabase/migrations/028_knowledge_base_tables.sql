-- PR #21 — Knowledge Base Editable Tables Phase 1A
-- Structured tables as JSONB columns/rows (not file attachments).
-- Idempotent. Non-destructive. No secrets. Do NOT auto-apply.

-- =============================================================================
-- 1. Table
-- =============================================================================

create table if not exists public.knowledge_base_tables (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null
    references public.knowledge_base_articles (id) on delete restrict,
  title text not null,
  description text,
  schema_version integer not null default 1,
  columns jsonb not null default '[]'::jsonb,
  rows jsonb not null default '[]'::jsonb,
  row_count integer not null default 0,
  column_count integer not null default 0,
  sort_order integer not null default 0,
  status text not null default 'active',
  -- session user id (UUID string in Auth; demo roster key locally)
  created_by text not null default '',
  updated_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  revision integer not null default 1,
  constraint knowledge_base_tables_title_check
    check (length(trim(title)) > 0 and length(title) <= 200),
  constraint knowledge_base_tables_description_check
    check (description is null or length(description) <= 2000),
  constraint knowledge_base_tables_status_check
    check (status in ('active', 'archived')),
  constraint knowledge_base_tables_schema_version_check
    check (schema_version >= 1),
  constraint knowledge_base_tables_row_count_check
    check (row_count >= 0 and row_count <= 1000),
  constraint knowledge_base_tables_column_count_check
    check (column_count >= 0 and column_count <= 50),
  constraint knowledge_base_tables_cell_count_check
    check (row_count * column_count <= 50000),
  constraint knowledge_base_tables_revision_check
    check (revision >= 1),
  constraint knowledge_base_tables_columns_is_array
    check (jsonb_typeof(columns) = 'array'),
  constraint knowledge_base_tables_rows_is_array
    check (jsonb_typeof(rows) = 'array')
);

create index if not exists knowledge_base_tables_article_idx
  on public.knowledge_base_tables (article_id, sort_order, created_at)
  where status = 'active' and archived_at is null;

create index if not exists knowledge_base_tables_article_status_idx
  on public.knowledge_base_tables (article_id, status);

comment on table public.knowledge_base_tables is
  'KB Phase 1A editable tables. Document stored as columns+rows JSONB with stable IDs.';

-- =============================================================================
-- 2. updated_at trigger
-- =============================================================================

create or replace function public.knowledge_base_tables_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists knowledge_base_tables_touch_updated_at
  on public.knowledge_base_tables;
create trigger knowledge_base_tables_touch_updated_at
  before update on public.knowledge_base_tables
  for each row
  execute function public.knowledge_base_tables_touch_updated_at();

-- =============================================================================
-- 3. Hard delete guard
-- =============================================================================

drop trigger if exists knowledge_base_tables_block_hard_delete
  on public.knowledge_base_tables;
create trigger knowledge_base_tables_block_hard_delete
  before delete on public.knowledge_base_tables
  for each row
  execute function public.spiora_block_hard_delete();

-- =============================================================================
-- 4. Privileges
-- =============================================================================

revoke all on table public.knowledge_base_tables from anon, public;
grant select, insert, update on table public.knowledge_base_tables to authenticated;
revoke delete on table public.knowledge_base_tables from authenticated;

-- =============================================================================
-- 5. RLS (same posture as knowledge_base_attachments)
-- =============================================================================

alter table public.knowledge_base_tables enable row level security;

drop policy if exists rls_kb_tables_select_owner on public.knowledge_base_tables;
create policy rls_kb_tables_select_owner
  on public.knowledge_base_tables
  for select
  to authenticated
  using (public.is_spiora_owner());

drop policy if exists rls_kb_tables_select_published on public.knowledge_base_tables;
create policy rls_kb_tables_select_published
  on public.knowledge_base_tables
  for select
  to authenticated
  using (
    status = 'active'
    and archived_at is null
    and exists (
      select 1
      from public.knowledge_base_articles a
      where a.id = knowledge_base_tables.article_id
        and public.kb_article_visible_to_reader(a)
    )
  );

drop policy if exists rls_kb_tables_insert_owner on public.knowledge_base_tables;
create policy rls_kb_tables_insert_owner
  on public.knowledge_base_tables
  for insert
  to authenticated
  with check (public.is_spiora_owner());

drop policy if exists rls_kb_tables_update_owner on public.knowledge_base_tables;
create policy rls_kb_tables_update_owner
  on public.knowledge_base_tables
  for update
  to authenticated
  using (public.is_spiora_owner())
  with check (public.is_spiora_owner());
