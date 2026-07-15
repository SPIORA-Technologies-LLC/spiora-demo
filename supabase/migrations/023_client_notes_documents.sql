-- PR #15 — Client Notes normalization + Client Documents metadata
-- Idempotent, non-destructive. Preserves legacy client_notes.id (text) and client_id (external_id).

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
