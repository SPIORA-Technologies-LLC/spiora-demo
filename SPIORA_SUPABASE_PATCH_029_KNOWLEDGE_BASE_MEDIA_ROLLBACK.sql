-- =============================================================================
-- SPIORA_SUPABASE_PATCH_029_KNOWLEDGE_BASE_MEDIA_ROLLBACK.sql
-- Reverts MIME/size/path widen + bucket limits to patch 027 values.
-- FAILS if any active/archived row uses video/audio MIME or size > 25 MiB.
-- Do NOT auto-apply.
-- =============================================================================

alter table public.knowledge_base_attachments
  drop constraint if exists knowledge_base_attachments_mime_check;

alter table public.knowledge_base_attachments
  add constraint knowledge_base_attachments_mime_check
  check (mime_type in (
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp'
  ));

alter table public.knowledge_base_attachments
  drop constraint if exists knowledge_base_attachments_size_check;

alter table public.knowledge_base_attachments
  add constraint knowledge_base_attachments_size_check
  check (file_size > 0 and file_size <= 26214400);

alter table public.knowledge_base_attachments
  drop constraint if exists knowledge_base_attachments_path_check;

alter table public.knowledge_base_attachments
  add constraint knowledge_base_attachments_path_check
  check (
    storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|png|jpe?g|webp)$'
  );

update storage.buckets
set
  public = false,
  file_size_limit = 26214400,
  allowed_mime_types = array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]::text[]
where id = 'knowledge-base';

comment on table public.knowledge_base_attachments is
  'KB Phase 1 attachments (PDF/images). Binaries live in private Storage bucket knowledge-base.';
