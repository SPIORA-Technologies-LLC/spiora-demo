-- =============================================================================
-- SPIORA — Supabase Patch 023 (SQL Editor)
-- =============================================================================
-- PR #15.1 — применять ТОЛЬКО на проекте Spiora Demo после bootstrap 001–022.
--
-- Содержит:
--   1) PRE-FLIGHT read-only snapshot (backup counts)
--   2) Migration 023 — client_notes normalization + client_documents
--   3) POST-MIGRATION read-only verification
--
-- НЕ содержит: migration 001–022, DROP TABLE, DROP COLUMN, hard DELETE,
--               secrets, project ref, URL, service-role keys.
--
-- Порядок:
--   1) Выполнить этот файл целиком в SQL Editor → Run
--   2) Проверить POST-MIGRATION verification
--   3) Выполнить SPIORA_DEMO_SEED_PATCH_023.sql (отдельный query)
-- =============================================================================

-- =============================================================================
-- SECTION A — PRE-FLIGHT SNAPSHOT (read-only, сохраните результаты в отчёт)
-- =============================================================================

SELECT 'PRE-FLIGHT' AS phase, now() AT TIME ZONE 'UTC' AS captured_at_utc;

-- A1. Активные клиенты (ожидается 25 на demo-базе после bootstrap + seed)
SELECT COUNT(*) AS active_clients_count
FROM clients
WHERE archived_at IS NULL;

-- A2. Demo-клиенты
SELECT COUNT(*) AS demo_clients_count
FROM clients
WHERE is_demo = true
  AND archived_at IS NULL;

-- A3. Существующие заметки (до migration — обычно >= 3)
-- Важно: до 023 у client_notes НЕТ колонки archived_at — не фильтровать по ней здесь.
SELECT COUNT(*) AS client_notes_total
FROM client_notes;

-- A4. Snapshot существующих demo-заметок (fictional — без PII)
SELECT
  n.id,
  n.client_id,
  n.author,
  left(coalesce(n.text, ''), 80) AS text_preview,
  n.created_at
FROM client_notes n
WHERE n.id LIKE 'NT-DEMO-%'
ORDER BY n.id;

-- A5. Orphan notes ДО migration (client_id без matching clients.external_id)
SELECT COUNT(*) AS orphan_notes_by_external_id
FROM client_notes n
LEFT JOIN clients c ON c.external_id = n.client_id
WHERE n.client_id IS NOT NULL
  AND c.id IS NULL;

-- A6. Проверка: таблица client_documents ещё не существует (ожидается до patch)
SELECT EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = 'client_documents'
) AS client_documents_table_exists_before;

-- A7. Колонка client_uuid ещё не существует (ожидается false до patch)
SELECT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'client_notes'
    AND column_name = 'client_uuid'
) AS client_uuid_column_exists_before;

-- =============================================================================
-- SECTION B — MIGRATION 023
-- (идентично supabase/migrations/023_client_notes_documents.sql)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- client_notes — extend existing table (001_platform.sql)
-- -----------------------------------------------------------------------------

alter table client_notes
  add column if not exists client_uuid uuid,
  add column if not exists author_user_id text,
  add column if not exists author_name text,
  add column if not exists content text,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists archived_at timestamptz,
  add column if not exists is_demo boolean not null default true;

comment on column client_notes.client_id is
  'Legacy public client key (clients.external_id). Deprecated — prefer client_uuid.';

comment on column client_notes.text is
  'Legacy note body. Deprecated — prefer content. Kept for backward compatibility.';

comment on column client_notes.author is
  'Legacy author display name. Deprecated — prefer author_name.';

-- Backfill from legacy columns where new columns are empty
update client_notes
set
  content = coalesce(nullif(trim(content), ''), text),
  author_name = coalesce(nullif(trim(author_name), ''), author),
  updated_at = coalesce(updated_at, created_at)
where content is null or trim(content) = '';

update client_notes cn
set client_uuid = c.id
from clients c
where cn.client_uuid is null
  and cn.client_id = c.external_id;

create index if not exists client_notes_client_uuid_created_idx
  on client_notes (client_uuid, created_at desc)
  where archived_at is null;

create index if not exists client_notes_client_uuid_archived_idx
  on client_notes (client_uuid, archived_at);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'client_notes_client_uuid_fkey'
  ) then
    alter table client_notes
      add constraint client_notes_client_uuid_fkey
      foreign key (client_uuid) references clients (id)
      on delete restrict;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- client_documents — metadata only (no binary, no signed URLs)
-- -----------------------------------------------------------------------------

create table if not exists client_documents (
  id uuid primary key default gen_random_uuid(),
  client_uuid uuid not null references clients (id) on delete restrict,
  external_id text not null,
  file_name text not null,
  original_file_name text not null default '',
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  document_type text not null default 'other',
  status text not null default 'uploaded',
  storage_provider text not null default 'demo',
  storage_bucket text not null default '',
  storage_path text not null default '',
  uploaded_by_user_id text,
  uploaded_by_name text not null default '',
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  is_demo boolean not null default true,
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists client_documents_external_id_uidx
  on client_documents (external_id);

create index if not exists client_documents_client_uuid_idx
  on client_documents (client_uuid)
  where archived_at is null;

create index if not exists client_documents_document_type_idx
  on client_documents (document_type)
  where archived_at is null;

create index if not exists client_documents_status_idx
  on client_documents (status)
  where archived_at is null;

create index if not exists client_documents_uploaded_at_idx
  on client_documents (uploaded_at desc)
  where archived_at is null;

create index if not exists client_documents_archived_at_idx
  on client_documents (archived_at);

comment on table client_documents is
  'CRM client document metadata only. Binary files live in Storage (future PR).';

comment on column client_documents.storage_path is
  'Internal fictional/demo path — never expose signed URLs in API responses.';

-- =============================================================================
-- SECTION C — POST-MIGRATION VERIFICATION (read-only)
-- =============================================================================

SELECT 'POST-MIGRATION' AS phase, now() AT TIME ZONE 'UTC' AS captured_at_utc;

-- C1. Клиенты не изменились
SELECT COUNT(*) AS active_clients_count
FROM clients
WHERE archived_at IS NULL;
-- Ожидаемо: 25

-- C2. Заметки сохранены (migration не удаляет строки)
SELECT COUNT(*) AS client_notes_active
FROM client_notes
WHERE archived_at IS NULL;
-- Ожидаемо: >= 3 (до seed patch); >= 10 после seed patch

-- C3. client_documents создана, пока 0 строк (до seed patch)
SELECT COUNT(*) AS client_documents_active
FROM client_documents
WHERE archived_at IS NULL;
-- Ожидаемо: 0 сейчас; 16 после SPIORA_DEMO_SEED_PATCH_023.sql

-- C4. Backfill client_uuid — orphan notes
SELECT COUNT(*) AS notes_without_client_uuid
FROM client_notes
WHERE client_uuid IS NULL
  AND client_id IS NOT NULL;
-- Ожидаемо: 0 (если все client_id ссылаются на DEMO-* clients)

-- C5. Orphan notes после backfill
SELECT COUNT(*) AS orphan_notes_after_backfill
FROM client_notes n
LEFT JOIN clients c ON c.id = n.client_uuid
WHERE n.client_uuid IS NOT NULL
  AND c.id IS NULL;
-- Ожидаемо: 0

-- C6. Legacy notes → client join (NT-DEMO-*)
SELECT
  n.id AS note_id,
  n.client_id,
  n.client_uuid IS NOT NULL AS has_client_uuid,
  c.external_id AS linked_client
FROM client_notes n
LEFT JOIN clients c ON c.id = n.client_uuid
WHERE n.id LIKE 'NT-DEMO-%'
ORDER BY n.id;

-- C7. Schema check — новые колонки
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'client_notes'
  AND column_name IN ('client_uuid', 'content', 'author_name', 'archived_at', 'is_demo')
ORDER BY column_name;

-- C8. client_documents orphan check (после seed patch повторить)
SELECT COUNT(*) AS orphan_documents
FROM client_documents d
LEFT JOIN clients c ON c.id = d.client_uuid
WHERE c.id IS NULL;
-- Ожидаемо: 0
