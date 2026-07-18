-- =============================================================================
-- SPIORA_KB_ATTACHMENTS_VALIDATE_027.sql
-- PR #20.1 — Post-apply validation for Knowledge Base Attachments migration 027
--
-- Run AFTER:
--   SPIORA_SUPABASE_PATCH_027_KNOWLEDGE_BASE_ATTACHMENTS.sql
--   (or supabase/migrations/027_knowledge_base_attachments.sql)
--
-- Mostly read-only. No DROP / DELETE of data.
-- Do NOT paste service-role keys into browser or logs.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Table exists + shape
-- -----------------------------------------------------------------------------
select
  'table_exists' as check_id,
  case
    when to_regclass('public.knowledge_base_attachments') is null
      then 'FAIL: missing'
    else 'PASS'
  end as result;

select
  'table_columns' as check_id,
  case
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
  end as result;

-- -----------------------------------------------------------------------------
-- 2. RLS enabled
-- -----------------------------------------------------------------------------
select
  'rls_attachments' as check_id,
  case when c.relrowsecurity then 'PASS: enabled' else 'FAIL: disabled' end as result
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'knowledge_base_attachments';

-- -----------------------------------------------------------------------------
-- 3. Database policies present (expected 4)
-- -----------------------------------------------------------------------------
select
  'db_policies_present' as check_id,
  coalesce(string_agg(policyname, ', ' order by policyname), 'FAIL: missing') as result
from pg_policies
where schemaname = 'public'
  and tablename = 'knowledge_base_attachments'
  and policyname in (
    'rls_kb_attachments_select_owner',
    'rls_kb_attachments_select_published',
    'rls_kb_attachments_insert_owner',
    'rls_kb_attachments_update_owner'
  );
-- EXPECT: all 4 names

select
  'db_policies_count' as check_id,
  case when count(*) = 4 then 'PASS: 4' else 'FAIL: ' || count(*)::text end as result
from pg_policies
where schemaname = 'public'
  and tablename = 'knowledge_base_attachments'
  and policyname in (
    'rls_kb_attachments_select_owner',
    'rls_kb_attachments_select_published',
    'rls_kb_attachments_insert_owner',
    'rls_kb_attachments_update_owner'
  );

select
  'owner_write_policies' as check_id,
  case when count(*) = 2 then 'PASS: insert+update owner' else 'FAIL' end as result
from pg_policies
where schemaname = 'public'
  and policyname in (
    'rls_kb_attachments_insert_owner',
    'rls_kb_attachments_update_owner'
  );

select
  'readers_published_active_policy' as check_id,
  case
    when exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and policyname = 'rls_kb_attachments_select_published'
    ) then 'PASS — readers need active attachment + published parent'
    else 'FAIL'
  end as result;

-- -----------------------------------------------------------------------------
-- 4. Hard-delete trigger
-- -----------------------------------------------------------------------------
select
  'hard_delete_trigger' as check_id,
  case
    when exists (
      select 1
      from pg_trigger tg
      join pg_class c on c.oid = tg.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and not tg.tgisinternal
        and c.relname = 'knowledge_base_attachments'
        and tg.tgname = 'knowledge_base_attachments_block_hard_delete'
    ) then 'PASS'
    else 'FAIL: missing'
  end as result;

-- -----------------------------------------------------------------------------
-- 5. Privileges: anon denied; authenticated no DELETE
-- -----------------------------------------------------------------------------
select
  'anon_table_privileges' as check_id,
  case
    when coalesce(
      (
        select string_agg(privilege_type, ',' order by privilege_type)
        from information_schema.role_table_grants
        where grantee = 'anon'
          and table_schema = 'public'
          and table_name = 'knowledge_base_attachments'
      ),
      'none'
    ) = 'none' then 'PASS: none'
    else 'FAIL: ' || (
      select string_agg(privilege_type, ',' order by privilege_type)
      from information_schema.role_table_grants
      where grantee = 'anon'
        and table_schema = 'public'
        and table_name = 'knowledge_base_attachments'
    )
  end as result;

select
  'authenticated_has_delete' as check_id,
  case
    when not exists (
      select 1
      from information_schema.role_table_grants
      where grantee = 'authenticated'
        and table_schema = 'public'
        and table_name = 'knowledge_base_attachments'
        and privilege_type = 'DELETE'
    ) then 'PASS: no DELETE'
    else 'FAIL: DELETE granted'
  end as result;

-- -----------------------------------------------------------------------------
-- 6. Private Storage bucket knowledge-base
-- Patch 027 creates/updates this bucket via SQL (no Dashboard create required
-- if insert into storage.buckets succeeds).
-- -----------------------------------------------------------------------------
select
  'bucket_exists' as check_id,
  case
    when exists (select 1 from storage.buckets where id = 'knowledge-base')
      then 'PASS'
    else 'FAIL: missing — re-run patch 027 or create private bucket knowledge-base'
  end as result;

select
  'bucket_private' as check_id,
  case
    when exists (
      select 1 from storage.buckets where id = 'knowledge-base' and public = false
    ) then 'PASS: public=false'
    when exists (select 1 from storage.buckets where id = 'knowledge-base')
      then 'FAIL: bucket is PUBLIC'
    else 'FAIL: bucket missing'
  end as result;

select
  'bucket_mime_allowlist' as check_id,
  case
    when exists (
      select 1 from storage.buckets b
      where b.id = 'knowledge-base'
        and b.allowed_mime_types @> array[
          'application/pdf',
          'image/png',
          'image/jpeg',
          'image/webp'
        ]::text[]
        and cardinality(b.allowed_mime_types) = 4
    ) then 'PASS: pdf/png/jpeg/webp only'
    when exists (select 1 from storage.buckets where id = 'knowledge-base')
      then 'FAIL: unexpected allowed_mime_types — ' || coalesce(
        (
          select array_to_string(allowed_mime_types, ',')
          from storage.buckets where id = 'knowledge-base'
        ),
        'null'
      )
    else 'FAIL: bucket missing'
  end as result;

select
  'bucket_file_size_limit' as check_id,
  case
    when exists (
      select 1 from storage.buckets
      where id = 'knowledge-base'
        and file_size_limit = 26214400
    ) then 'PASS: 26214400 (25 MiB)'
    when exists (select 1 from storage.buckets where id = 'knowledge-base')
      then 'FAIL: file_size_limit=' || coalesce(
        (
          select file_size_limit::text from storage.buckets where id = 'knowledge-base'
        ),
        'null'
      )
    else 'FAIL: bucket missing'
  end as result;

-- -----------------------------------------------------------------------------
-- 7. Storage policies posture (Phase 1)
-- Patch 027 does NOT create storage.objects policies (same as task-attachments).
-- Access = Next.js API + service_role only. Client JWT must NOT have object policies.
-- -----------------------------------------------------------------------------
select
  'storage_policies_inventory' as check_id,
  coalesce(
    (
      select string_agg(policyname, ', ' order by policyname)
      from pg_policies
      where schemaname = 'storage'
        and tablename = 'objects'
        and (
          qual::text ilike '%knowledge-base%'
          or with_check::text ilike '%knowledge-base%'
          or policyname ilike '%knowledge%base%'
          or policyname ilike '%kb_attach%'
        )
    ),
    'none (expected Phase 1 — service_role path)'
  ) as result;

select
  'storage_anon_authenticated_access' as check_id,
  case
    when not exists (
      select 1
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
    ) then 'PASS: no anon/authenticated Storage object policies for knowledge-base'
    else 'FAIL: client-facing Storage policy found'
  end as result;

select
  'storage_policies_phase1_note' as check_id,
  'INFO: Phase 1 expects zero client Storage policies; binaries served via app proxy + service_role' as result;

-- -----------------------------------------------------------------------------
-- 8. FINAL VERDICT
-- -----------------------------------------------------------------------------
with checks as (
  select * from (
    values
      (
        'table',
        (to_regclass('public.knowledge_base_attachments') is not null)
      ),
      (
        'columns',
        (
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
      ),
      (
        'rls',
        (
          select c.relrowsecurity
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relname = 'knowledge_base_attachments'
        )
      ),
      (
        'policies',
        (
          select count(*) = 4
          from pg_policies
          where schemaname = 'public'
            and tablename = 'knowledge_base_attachments'
            and policyname in (
              'rls_kb_attachments_select_owner',
              'rls_kb_attachments_select_published',
              'rls_kb_attachments_insert_owner',
              'rls_kb_attachments_update_owner'
            )
        )
      ),
      (
        'hard_delete_trigger',
        (
          exists (
            select 1
            from pg_trigger tg
            join pg_class c on c.oid = tg.tgrelid
            join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public'
              and not tg.tgisinternal
              and c.relname = 'knowledge_base_attachments'
              and tg.tgname = 'knowledge_base_attachments_block_hard_delete'
          )
        )
      ),
      (
        'anon_priv',
        (
          not exists (
            select 1
            from information_schema.role_table_grants
            where grantee = 'anon'
              and table_schema = 'public'
              and table_name = 'knowledge_base_attachments'
          )
        )
      ),
      (
        'no_delete_grant',
        (
          not exists (
            select 1
            from information_schema.role_table_grants
            where grantee = 'authenticated'
              and table_schema = 'public'
              and table_name = 'knowledge_base_attachments'
              and privilege_type = 'DELETE'
          )
        )
      ),
      (
        'bucket',
        (
          exists (
            select 1 from storage.buckets
            where id = 'knowledge-base' and public = false
          )
        )
      ),
      (
        'bucket_mime',
        (
          exists (
            select 1 from storage.buckets b
            where b.id = 'knowledge-base'
              and b.allowed_mime_types @> array[
                'application/pdf',
                'image/png',
                'image/jpeg',
                'image/webp'
              ]::text[]
              and cardinality(b.allowed_mime_types) = 4
          )
        )
      ),
      (
        'bucket_size',
        (
          exists (
            select 1 from storage.buckets
            where id = 'knowledge-base' and file_size_limit = 26214400
          )
        )
      ),
      (
        'storage_client_denied',
        (
          not exists (
            select 1
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
    when (select failed_keys from failed) is null then 'VALIDATED_OK'
    else 'VALIDATION_FAILED'
  end as result,
  case
    when (select failed_keys from failed) is null
      then 'Schema + bucket + RLS posture OK. Proceed to local runtime: owner PDF/image upload, Daniel read-only, archive.'
    else 'Failed: ' || (select failed_keys from failed)
  end as detail;

-- Note: live impersonation of anon / manager / Daniel must be done from the app
-- or Dashboard Auth — service_role bypasses RLS in SQL Editor.

-- =============================================================================
-- PASS when FINAL_VERDICT = VALIDATED_OK, then runtime checklist.
-- =============================================================================
