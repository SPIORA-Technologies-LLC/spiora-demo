-- =============================================================================
-- SPIORA_KB_ATTACHMENTS_PREFLIGHT_027.sql
-- PR #20.1 — Read-only preflight before Knowledge Base Attachments migration 027
--
-- SAFE: SELECT / EXISTS only.
-- FORBIDDEN: INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, GRANT.
--
-- Run in Supabase SQL Editor BEFORE apply.
-- Do NOT paste service-role keys. Do NOT run from the browser app.
-- Do NOT auto-apply migration / create bucket after this file.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A. Migration 026 / KB article prerequisites
-- -----------------------------------------------------------------------------
select
  'A1_kb_articles_table' as check_id,
  case
    when to_regclass('public.knowledge_base_articles') is null then 'FAIL'
    else 'PASS'
  end as status,
  case
    when to_regclass('public.knowledge_base_articles') is null
      then 'knowledge_base_articles missing — apply 026 first'
    else 'present (026 applied)'
  end as detail;

select
  'A2_kb_translations_table' as check_id,
  case
    when to_regclass('public.knowledge_base_article_translations') is null then 'FAIL'
    else 'PASS'
  end as status,
  case
    when to_regclass('public.knowledge_base_article_translations') is null
      then 'knowledge_base_article_translations missing — apply 026 first'
    else 'present'
  end as detail;

select
  'A3_kb_article_visible_to_reader' as check_id,
  case
    when exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'kb_article_visible_to_reader'
    ) then 'PASS'
    else 'FAIL'
  end as status,
  case
    when exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'kb_article_visible_to_reader'
    ) then 'present'
    else 'kb_article_visible_to_reader() missing — apply 026 first'
  end as detail;

select
  'A4_is_spiora_owner' as check_id,
  case
    when to_regprocedure('public.is_spiora_owner()') is null then 'FAIL'
    else 'PASS'
  end as status,
  case
    when to_regprocedure('public.is_spiora_owner()') is null
      then 'is_spiora_owner() missing'
    else 'present'
  end as detail;

select
  'A5_spiora_block_hard_delete' as check_id,
  case
    when to_regprocedure('public.spiora_block_hard_delete()') is null then 'FAIL'
    else 'PASS'
  end as status,
  case
    when to_regprocedure('public.spiora_block_hard_delete()') is null
      then 'spiora_block_hard_delete() missing — apply RLS Phase 1 (025) first'
    else 'present'
  end as detail;

-- -----------------------------------------------------------------------------
-- B. Active owner
-- -----------------------------------------------------------------------------
select
  'B1_active_owner_count' as check_id,
  case when count(*) = 1 then 'PASS' else 'FAIL' end as status,
  count(*)::text || ' (expected 1)' as detail
from public.user_profiles
where status = 'active'
  and archived_at is null
  and role = 'owner';

select
  'B2_active_profiles' as check_id,
  'INFO' as status,
  count(*)::text as detail
from public.user_profiles
where status = 'active'
  and archived_at is null;

-- -----------------------------------------------------------------------------
-- C. knowledge_base_attachments — absent OR expected shape (idempotent re-apply)
-- -----------------------------------------------------------------------------
select
  'C1_attachments_exists' as check_id,
  'INFO' as status,
  case
    when to_regclass('public.knowledge_base_attachments') is null
      then 'absent (ready to create)'
    else 'EXISTS (patch 027 may re-apply idempotently if shape matches)'
  end as detail;

select
  'C2_attachments_shape' as check_id,
  case
    when to_regclass('public.knowledge_base_attachments') is null then 'PASS'
    when (
      select count(*) = 14
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'knowledge_base_attachments'
        and column_name in (
          'id', 'article_id', 'file_name', 'mime_type', 'file_size',
          'storage_bucket', 'storage_path', 'caption', 'sort_order',
          'is_primary', 'status', 'uploaded_by', 'created_at', 'archived_at'
        )
    ) then 'PASS'
    else 'FAIL'
  end as status,
  case
    when to_regclass('public.knowledge_base_attachments') is null
      then 'n/a (table absent)'
    else coalesce(
      (
        select string_agg(column_name, ', ' order by ordinal_position)
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'knowledge_base_attachments'
      ),
      'no columns'
    )
  end as detail;

-- -----------------------------------------------------------------------------
-- D. Conflicting policies / triggers / indexes on attachments
-- -----------------------------------------------------------------------------
select
  'D1_existing_attachment_policies' as check_id,
  'INFO' as status,
  coalesce(string_agg(policyname, ', ' order by policyname), 'none') as detail
from pg_policies
where schemaname = 'public'
  and tablename = 'knowledge_base_attachments';

select
  'D2_unexpected_attachment_policies' as check_id,
  case
    when to_regclass('public.knowledge_base_attachments') is null then 'PASS'
    when count(*) = 0 then 'PASS'
    else 'FAIL'
  end as status,
  coalesce(string_agg(policyname, ', ' order by policyname), 'none') as detail
from pg_policies
where schemaname = 'public'
  and tablename = 'knowledge_base_attachments'
  and policyname not in (
    'rls_kb_attachments_select_owner',
    'rls_kb_attachments_select_published',
    'rls_kb_attachments_insert_owner',
    'rls_kb_attachments_update_owner'
  );

select
  'D3_existing_attachment_triggers' as check_id,
  'INFO' as status,
  coalesce(string_agg(tg.tgname, ', ' order by tg.tgname), 'none') as detail
from pg_trigger tg
join pg_class c on c.oid = tg.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and not tg.tgisinternal
  and c.relname = 'knowledge_base_attachments';

select
  'D4_unexpected_attachment_triggers' as check_id,
  case
    when to_regclass('public.knowledge_base_attachments') is null then 'PASS'
    when count(*) = 0 then 'PASS'
    else 'FAIL'
  end as status,
  coalesce(string_agg(tg.tgname, ', ' order by tg.tgname), 'none') as detail
from pg_trigger tg
join pg_class c on c.oid = tg.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and not tg.tgisinternal
  and c.relname = 'knowledge_base_attachments'
  and tg.tgname not in (
    'knowledge_base_attachments_block_hard_delete'
  );

select
  'D5_existing_attachment_indexes' as check_id,
  'INFO' as status,
  coalesce(string_agg(indexname, ', ' order by indexname), 'none') as detail
from pg_indexes
where schemaname = 'public'
  and tablename = 'knowledge_base_attachments';

select
  'D6_unexpected_attachment_indexes' as check_id,
  case
    when to_regclass('public.knowledge_base_attachments') is null then 'PASS'
    when count(*) = 0 then 'PASS'
    else 'FAIL'
  end as status,
  coalesce(string_agg(indexname, ', ' order by indexname), 'none') as detail
from pg_indexes
where schemaname = 'public'
  and tablename = 'knowledge_base_attachments'
  and indexname not in (
    'knowledge_base_attachments_pkey',
    'knowledge_base_attachments_storage_path_uidx',
    'knowledge_base_attachments_article_idx',
    'knowledge_base_attachments_article_status_idx'
  );

-- -----------------------------------------------------------------------------
-- E. Storage buckets (read-only inventory)
-- -----------------------------------------------------------------------------
select
  'E1_storage_buckets_inventory' as check_id,
  'INFO' as status,
  coalesce(
    string_agg(id || ' public=' || public::text, ', ' order by id),
    'none'
  ) as detail
from storage.buckets;

select
  'E2_knowledge_base_bucket' as check_id,
  case
    when not exists (select 1 from storage.buckets where id = 'knowledge-base')
      then 'PASS'
    when exists (
      select 1 from storage.buckets
      where id = 'knowledge-base' and public = false
    ) then 'PASS'
    else 'FAIL'
  end as status,
  case
    when not exists (select 1 from storage.buckets where id = 'knowledge-base')
      then 'absent (patch 027 will create via SQL)'
    when exists (
      select 1 from storage.buckets
      where id = 'knowledge-base' and public = false
    ) then 'exists private (idempotent upsert OK)'
    else 'EXISTS BUT PUBLIC=true — fix before apply (must be private)'
  end as detail;

select
  'E3_kb_storage_object_policies' as check_id,
  'INFO' as status,
  coalesce(string_agg(policyname, ', ' order by policyname), 'none') as detail
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and (
    qual::text ilike '%knowledge-base%'
    or with_check::text ilike '%knowledge-base%'
    or policyname ilike '%knowledge%base%'
    or policyname ilike '%kb_attach%'
  );

select
  'E4_unexpected_kb_storage_client_policies' as check_id,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status,
  coalesce(string_agg(policyname, ', ' order by policyname), 'none') as detail
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and (
    qual::text ilike '%knowledge-base%'
    or with_check::text ilike '%knowledge-base%'
    or policyname ilike '%knowledge%base%'
    or policyname ilike '%kb_attach%'
  )
  and (
    'anon' = any (roles)
    or 'authenticated' = any (roles)
  );

-- -----------------------------------------------------------------------------
-- F. FINAL VERDICT — READY_TO_APPLY / NOT_READY
-- -----------------------------------------------------------------------------
with checks as (
  select * from (
    values
      (
        'A1',
        (to_regclass('public.knowledge_base_articles') is not null)
      ),
      (
        'A2',
        (to_regclass('public.knowledge_base_article_translations') is not null)
      ),
      (
        'A3',
        (
          exists (
            select 1
            from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public'
              and p.proname = 'kb_article_visible_to_reader'
          )
        )
      ),
      (
        'A4',
        (to_regprocedure('public.is_spiora_owner()') is not null)
      ),
      (
        'A5',
        (to_regprocedure('public.spiora_block_hard_delete()') is not null)
      ),
      (
        'B1',
        (
          select count(*) = 1
          from public.user_profiles
          where status = 'active'
            and archived_at is null
            and role = 'owner'
        )
      ),
      (
        'C2',
        (
          to_regclass('public.knowledge_base_attachments') is null
          or (
            select count(*) = 14
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'knowledge_base_attachments'
              and column_name in (
                'id', 'article_id', 'file_name', 'mime_type', 'file_size',
                'storage_bucket', 'storage_path', 'caption', 'sort_order',
                'is_primary', 'status', 'uploaded_by', 'created_at', 'archived_at'
              )
          )
        )
      ),
      (
        'D2',
        (
          to_regclass('public.knowledge_base_attachments') is null
          or (
            select count(*) = 0
            from pg_policies
            where schemaname = 'public'
              and tablename = 'knowledge_base_attachments'
              and policyname not in (
                'rls_kb_attachments_select_owner',
                'rls_kb_attachments_select_published',
                'rls_kb_attachments_insert_owner',
                'rls_kb_attachments_update_owner'
              )
          )
        )
      ),
      (
        'D4',
        (
          to_regclass('public.knowledge_base_attachments') is null
          or (
            select count(*) = 0
            from pg_trigger tg
            join pg_class c on c.oid = tg.tgrelid
            join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public'
              and not tg.tgisinternal
              and c.relname = 'knowledge_base_attachments'
              and tg.tgname not in (
                'knowledge_base_attachments_block_hard_delete'
              )
          )
        )
      ),
      (
        'D6',
        (
          to_regclass('public.knowledge_base_attachments') is null
          or (
            select count(*) = 0
            from pg_indexes
            where schemaname = 'public'
              and tablename = 'knowledge_base_attachments'
              and indexname not in (
                'knowledge_base_attachments_pkey',
                'knowledge_base_attachments_storage_path_uidx',
                'knowledge_base_attachments_article_idx',
                'knowledge_base_attachments_article_status_idx'
              )
          )
        )
      ),
      (
        'E2',
        (
          not exists (select 1 from storage.buckets where id = 'knowledge-base')
          or exists (
            select 1 from storage.buckets
            where id = 'knowledge-base' and public = false
          )
        )
      ),
      (
        'E4',
        (
          select count(*) = 0
          from pg_policies
          where schemaname = 'storage'
            and tablename = 'objects'
            and (
              qual::text ilike '%knowledge-base%'
              or with_check::text ilike '%knowledge-base%'
              or policyname ilike '%knowledge%base%'
              or policyname ilike '%kb_attach%'
            )
            and (
              'anon' = any (roles)
              or 'authenticated' = any (roles)
            )
        )
      )
  ) as t(check_key, ok)
),
failed as (
  select string_agg(check_key, ', ' order by check_key) as failed_keys
  from checks
  where not ok
)
select
  'FINAL_VERDICT' as check_id,
  case
    when (select failed_keys from failed) is null then 'READY_TO_APPLY'
    else 'NOT_READY'
  end as status,
  case
    when (select failed_keys from failed) is null
      then 'All blocking checks PASS. Take backup, then apply SPIORA_SUPABASE_PATCH_027_KNOWLEDGE_BASE_ATTACHMENTS.sql manually. Bucket knowledge-base is created/updated by that SQL (private).'
    else 'Failed checks: ' || (select failed_keys from failed) || '. Do NOT apply migration 027.'
  end as detail;

-- =============================================================================
-- How to read:
--   Run all queries. Look at FINAL_VERDICT row.
--   READY_TO_APPLY → backup, then apply patch 027 manually.
--   NOT_READY → fix failed check_keys, re-run this file.
-- This script does NOT apply migration, create objects, or push/deploy.
-- =============================================================================
