-- =============================================================================
-- SPIORA_SUPABASE_PATCH_029_KNOWLEDGE_BASE_MEDIA.sql
-- Knowledge Base media attachments Phase 1 (video + audio)
-- Widens knowledge_base_attachments + knowledge-base bucket.
-- Idempotent. Non-destructive. No secrets. Do NOT auto-apply.
-- Requires migration 027 (attachments) already applied.
-- =============================================================================

-- =============================================================================
-- 1. Widen table checks (MIME, size, storage path)
-- =============================================================================

alter table public.knowledge_base_attachments
  drop constraint if exists knowledge_base_attachments_mime_check;

alter table public.knowledge_base_attachments
  add constraint knowledge_base_attachments_mime_check
  check (mime_type in (
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'video/mp4',
    'video/webm',
    'audio/webm',
    'audio/ogg',
    'audio/mp4',
    'audio/mpeg',
    'audio/x-m4a'
  ));

alter table public.knowledge_base_attachments
  drop constraint if exists knowledge_base_attachments_size_check;

alter table public.knowledge_base_attachments
  add constraint knowledge_base_attachments_size_check
  check (file_size > 0 and file_size <= 104857600);

alter table public.knowledge_base_attachments
  drop constraint if exists knowledge_base_attachments_path_check;

alter table public.knowledge_base_attachments
  add constraint knowledge_base_attachments_path_check
  check (
    storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|png|jpe?g|webp|mp4|webm|ogg|mp3|m4a)$'
  );

comment on table public.knowledge_base_attachments is
  'KB attachments (PDF/images/video/audio). Binaries in private Storage bucket knowledge-base.';

-- =============================================================================
-- 2. Widen private Storage bucket
-- =============================================================================

update storage.buckets
set
  public = false,
  file_size_limit = 104857600,
  allowed_mime_types = array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'video/mp4',
    'video/webm',
    'audio/webm',
    'audio/ogg',
    'audio/mp4',
    'audio/mpeg',
    'audio/x-m4a'
  ]::text[]
where id = 'knowledge-base';

-- If bucket was missing (027 never applied), create it with media allowlist.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'knowledge-base',
  'knowledge-base',
  false,
  104857600,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'video/mp4',
    'video/webm',
    'audio/webm',
    'audio/ogg',
    'audio/mp4',
    'audio/mpeg',
    'audio/x-m4a'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
