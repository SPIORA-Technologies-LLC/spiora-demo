-- =============================================================================
-- SPIORA_KB_TABLES_PREFLIGHT_028.sql
-- PR #21 — Read-only preflight before Knowledge Base Editable Tables migration 028
--
-- SAFE: SELECT / EXISTS / catalog inspection only.
-- FORBIDDEN: INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, GRANT, SET ROLE.
--
-- Run in Supabase SQL Editor BEFORE apply.
-- Do NOT paste service-role keys. Do NOT run from the browser app.
-- Do NOT auto-apply migration after this file.
--
-- FINAL_VERDICT (look at last result row):
--   READY_TO_APPLY   — prerequisites OK; patch 028 safe to apply (idempotent)
--   ALREADY_APPLIED  — knowledge_base_tables already matches expected 028 posture
--   NOT_READY        — fix blocking reasons before apply
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A. Parent KB prerequisites (026+)
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
    else 'present'
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
  'A3_kb_attachments_table' as check_id,
  case
    when to_regclass('public.knowledge_base_attachments') is null then 'FAIL'
    else 'PASS'
  end as status,
  case
    when to_regclass('public.knowledge_base_attachments') is null
      then 'BLOCKER: knowledge_base_attachments missing — apply/validate 027 before 028 (backup + cutover require it)'
    else 'present'
  end as detail;

select
  'A4_kb_article_visible_to_reader' as check_id,
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
  'A5_is_spiora_owner' as check_id,
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
  'A6_spiora_block_hard_delete' as check_id,
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
-- B. Migration 027 applied (attachments posture)
-- -----------------------------------------------------------------------------
select
  'B1_migration_027_attachments_shape' as check_id,
  case
    when to_regclass('public.knowledge_base_attachments') is null then 'FAIL'
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
      then '027 not applied — attachments table missing'
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
    ) then '027 shape OK (14 expected columns)'
    else 'attachments present but unexpected column set — validate 027 first'
  end as detail;

select
  'B2_migration_027_attachments_policies' as check_id,
  case
    when to_regclass('public.knowledge_base_attachments') is null then 'FAIL'
    when (
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
    ) then 'PASS'
    else 'FAIL'
  end as status,
  case
    when to_regclass('public.knowledge_base_attachments') is null
      then 'attachments missing'
    else coalesce(
      (
        select string_agg(policyname, ', ' order by policyname)
        from pg_policies
        where schemaname = 'public'
          and tablename = 'knowledge_base_attachments'
      ),
      'none'
    )
  end as detail;

select
  'B3_migration_027_hard_delete_trigger' as check_id,
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
    else 'FAIL'
  end as status,
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
    ) then 'present'
    else 'knowledge_base_attachments_block_hard_delete missing — finish 027 validate'
  end as detail;

-- -----------------------------------------------------------------------------
-- C. Active owner (at least one)
-- -----------------------------------------------------------------------------
select
  'C1_active_owner_count' as check_id,
  case when count(*) >= 1 then 'PASS' else 'FAIL' end as status,
  count(*)::text || ' (expected >= 1)' as detail
from public.user_profiles
where status = 'active'
  and archived_at is null
  and role = 'owner';

select
  'C2_active_profiles' as check_id,
  'INFO' as status,
  count(*)::text as detail
from public.user_profiles
where status = 'active'
  and archived_at is null;

-- -----------------------------------------------------------------------------
-- D. Parent RLS enabled
-- -----------------------------------------------------------------------------
select
  'D1_rls_kb_articles' as check_id,
  case
    when to_regclass('public.knowledge_base_articles') is null then 'FAIL'
    when (
      select c.relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'knowledge_base_articles'
    ) then 'PASS'
    else 'FAIL'
  end as status,
  case
    when to_regclass('public.knowledge_base_articles') is null then 'table missing'
    when (
      select c.relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'knowledge_base_articles'
    ) then 'RLS enabled'
    else 'RLS disabled on knowledge_base_articles'
  end as detail;

select
  'D2_rls_kb_translations' as check_id,
  case
    when to_regclass('public.knowledge_base_article_translations') is null then 'FAIL'
    when (
      select c.relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'knowledge_base_article_translations'
    ) then 'PASS'
    else 'FAIL'
  end as status,
  case
    when to_regclass('public.knowledge_base_article_translations') is null then 'table missing'
    when (
      select c.relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'knowledge_base_article_translations'
    ) then 'RLS enabled'
    else 'RLS disabled on knowledge_base_article_translations'
  end as detail;

select
  'D3_rls_kb_attachments' as check_id,
  case
    when to_regclass('public.knowledge_base_attachments') is null then 'FAIL'
    when (
      select c.relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'knowledge_base_attachments'
    ) then 'PASS'
    else 'FAIL'
  end as status,
  case
    when to_regclass('public.knowledge_base_attachments') is null then 'table missing'
    when (
      select c.relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'knowledge_base_attachments'
    ) then 'RLS enabled'
    else 'RLS disabled on knowledge_base_attachments'
  end as detail;

-- -----------------------------------------------------------------------------
-- E. knowledge_base_tables — absent OR expected shape (idempotent / already applied)
-- -----------------------------------------------------------------------------
select
  'E1_tables_exists' as check_id,
  'INFO' as status,
  case
    when to_regclass('public.knowledge_base_tables') is null
      then 'absent (ready to create via patch 028)'
    else 'EXISTS (evaluate shape + ALREADY_APPLIED)'
  end as detail;

select
  'E2_tables_shape' as check_id,
  case
    when to_regclass('public.knowledge_base_tables') is null then 'PASS'
    when (
      select count(*) = 17
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'knowledge_base_tables'
        and column_name in (
          'id', 'article_id', 'title', 'description', 'schema_version',
          'columns', 'rows', 'row_count', 'column_count', 'sort_order',
          'status', 'created_by', 'updated_by', 'created_at', 'updated_at',
          'archived_at', 'revision'
        )
    ) then 'PASS'
    else 'FAIL'
  end as status,
  case
    when to_regclass('public.knowledge_base_tables') is null
      then 'n/a (table absent)'
    else coalesce(
      (
        select string_agg(column_name, ', ' order by ordinal_position)
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'knowledge_base_tables'
      ),
      'no columns'
    )
  end as detail;

select
  'E3_tables_column_inventory' as check_id,
  'INFO' as status,
  case
    when to_regclass('public.knowledge_base_tables') is null then 'n/a'
    else coalesce(
      (
        select string_agg(
          column_name || ':' || data_type
            || case when is_nullable = 'YES' then '?' else '' end,
          ', '
          order by ordinal_position
        )
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'knowledge_base_tables'
      ),
      'none'
    )
  end as detail;

-- -----------------------------------------------------------------------------
-- F. Conflicting policies / triggers / indexes / functions on tables
-- -----------------------------------------------------------------------------
select
  'F1_existing_table_policies' as check_id,
  'INFO' as status,
  coalesce(string_agg(policyname, ', ' order by policyname), 'none') as detail
from pg_policies
where schemaname = 'public'
  and tablename = 'knowledge_base_tables';

select
  'F2_unexpected_table_policies' as check_id,
  case
    when to_regclass('public.knowledge_base_tables') is null then 'PASS'
    when count(*) = 0 then 'PASS'
    else 'FAIL'
  end as status,
  coalesce(string_agg(policyname, ', ' order by policyname), 'none') as detail
from pg_policies
where schemaname = 'public'
  and tablename = 'knowledge_base_tables'
  and policyname not in (
    'rls_kb_tables_select_owner',
    'rls_kb_tables_select_published',
    'rls_kb_tables_insert_owner',
    'rls_kb_tables_update_owner'
  );

select
  'F3_existing_table_triggers' as check_id,
  'INFO' as status,
  coalesce(string_agg(tg.tgname, ', ' order by tg.tgname), 'none') as detail
from pg_trigger tg
join pg_class c on c.oid = tg.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and not tg.tgisinternal
  and c.relname = 'knowledge_base_tables';

select
  'F4_unexpected_table_triggers' as check_id,
  case
    when to_regclass('public.knowledge_base_tables') is null then 'PASS'
    when count(*) = 0 then 'PASS'
    else 'FAIL'
  end as status,
  coalesce(string_agg(tg.tgname, ', ' order by tg.tgname), 'none') as detail
from pg_trigger tg
join pg_class c on c.oid = tg.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and not tg.tgisinternal
  and c.relname = 'knowledge_base_tables'
  and tg.tgname not in (
    'knowledge_base_tables_touch_updated_at',
    'knowledge_base_tables_block_hard_delete'
  );

select
  'F5_existing_table_indexes' as check_id,
  'INFO' as status,
  coalesce(string_agg(indexname, ', ' order by indexname), 'none') as detail
from pg_indexes
where schemaname = 'public'
  and tablename = 'knowledge_base_tables';

select
  'F6_unexpected_table_indexes' as check_id,
  case
    when to_regclass('public.knowledge_base_tables') is null then 'PASS'
    when count(*) = 0 then 'PASS'
    else 'FAIL'
  end as status,
  coalesce(string_agg(indexname, ', ' order by indexname), 'none') as detail
from pg_indexes
where schemaname = 'public'
  and tablename = 'knowledge_base_tables'
  and indexname not in (
    'knowledge_base_tables_pkey',
    'knowledge_base_tables_article_idx',
    'knowledge_base_tables_article_status_idx'
  );

select
  'F7_touch_updated_at_function' as check_id,
  'INFO' as status,
  case
    when to_regprocedure('public.knowledge_base_tables_touch_updated_at()') is null
      then 'absent (patch 028 will create)'
    else 'present'
  end as detail;

select
  'F8_conflicting_foreign_tables_named_like' as check_id,
  case
    when count(*) = 0 then 'PASS'
    else 'FAIL'
  end as status,
  coalesce(string_agg(n.nspname || '.' || c.relname, ', ' order by 1), 'none') as detail
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r'
  and n.nspname = 'public'
  and c.relname in (
    'kb_tables',
    'knowledge_base_table',
    'knowledge_base_editable_tables'
  );

-- -----------------------------------------------------------------------------
-- G. Rollback safety (no dependent objects that 028 rollback would break wrongly)
-- -----------------------------------------------------------------------------
select
  'G1_dependents_on_kb_tables' as check_id,
  case
    when to_regclass('public.knowledge_base_tables') is null then 'PASS'
    when coalesce(
      (
        select count(distinct dependent_ns.nspname || '.' || dependent_obj.relname)
        from pg_depend d
        join pg_rewrite r on r.oid = d.objid
        join pg_class dependent_obj on dependent_obj.oid = r.ev_class
        join pg_namespace dependent_ns on dependent_ns.oid = dependent_obj.relnamespace
        join pg_class source_obj on source_obj.oid = d.refobjid
        join pg_namespace source_ns on source_ns.oid = source_obj.relnamespace
        where source_ns.nspname = 'public'
          and source_obj.relname = 'knowledge_base_tables'
          and dependent_obj.relname <> 'knowledge_base_tables'
          and dependent_ns.nspname = 'public'
      ),
      0
    ) = 0 then 'PASS'
    else 'FAIL'
  end as status,
  case
    when to_regclass('public.knowledge_base_tables') is null
      then 'n/a (table absent) — rollback drops only knowledge_base_tables + touch function'
    when coalesce(
      (
        select count(distinct dependent_ns.nspname || '.' || dependent_obj.relname)
        from pg_depend d
        join pg_rewrite r on r.oid = d.objid
        join pg_class dependent_obj on dependent_obj.oid = r.ev_class
        join pg_namespace dependent_ns on dependent_ns.oid = dependent_obj.relnamespace
        join pg_class source_obj on source_obj.oid = d.refobjid
        join pg_namespace source_ns on source_ns.oid = source_obj.relnamespace
        where source_ns.nspname = 'public'
          and source_obj.relname = 'knowledge_base_tables'
          and dependent_obj.relname <> 'knowledge_base_tables'
          and dependent_ns.nspname = 'public'
      ),
      0
    ) = 0
      then 'no external dependents — rollback scoped to tables metadata only'
    else 'external dependents found — inspect views/rules before rollback'
  end as detail;

select
  'G2_rollback_scope_note' as check_id,
  'INFO' as status,
  'ROLLBACK drops triggers/policies/table knowledge_base_tables + touch_updated_at(); does NOT drop articles/translations/attachments' as detail;

-- -----------------------------------------------------------------------------
-- H. ALREADY_APPLIED posture (informational + used by FINAL_VERDICT)
-- -----------------------------------------------------------------------------
select
  'H1_already_applied_signal' as check_id,
  case
    when to_regclass('public.knowledge_base_tables') is null then 'INFO'
    when (
      -- columns
      (
        select count(*) = 17
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'knowledge_base_tables'
          and column_name in (
            'id', 'article_id', 'title', 'description', 'schema_version',
            'columns', 'rows', 'row_count', 'column_count', 'sort_order',
            'status', 'created_by', 'updated_by', 'created_at', 'updated_at',
            'archived_at', 'revision'
          )
      )
      -- RLS
      and (
        select c.relrowsecurity
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = 'knowledge_base_tables'
      )
      -- 4 policies
      and (
        select count(*) = 4
        from pg_policies
        where schemaname = 'public'
          and tablename = 'knowledge_base_tables'
          and policyname in (
            'rls_kb_tables_select_owner',
            'rls_kb_tables_select_published',
            'rls_kb_tables_insert_owner',
            'rls_kb_tables_update_owner'
          )
      )
      -- both triggers
      and (
        select count(*) = 2
        from pg_trigger tg
        join pg_class c on c.oid = tg.tgrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and not tg.tgisinternal
          and c.relname = 'knowledge_base_tables'
          and tg.tgname in (
            'knowledge_base_tables_touch_updated_at',
            'knowledge_base_tables_block_hard_delete'
          )
      )
      -- expected indexes
      and (
        select count(*) = 3
        from pg_indexes
        where schemaname = 'public'
          and tablename = 'knowledge_base_tables'
          and indexname in (
            'knowledge_base_tables_pkey',
            'knowledge_base_tables_article_idx',
            'knowledge_base_tables_article_status_idx'
          )
      )
      -- touch function
      and to_regprocedure('public.knowledge_base_tables_touch_updated_at()') is not null
      -- no DELETE for authenticated
      and not exists (
        select 1
        from information_schema.role_table_grants
        where grantee = 'authenticated'
          and table_schema = 'public'
          and table_name = 'knowledge_base_tables'
          and privilege_type = 'DELETE'
      )
      -- anon none
      and not exists (
        select 1
        from information_schema.role_table_grants
        where grantee = 'anon'
          and table_schema = 'public'
          and table_name = 'knowledge_base_tables'
      )
    ) then 'PASS'
    else 'INFO'
  end as status,
  case
    when to_regclass('public.knowledge_base_tables') is null
      then 'not applied yet'
    when (
      (
        select count(*) = 17
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'knowledge_base_tables'
          and column_name in (
            'id', 'article_id', 'title', 'description', 'schema_version',
            'columns', 'rows', 'row_count', 'column_count', 'sort_order',
            'status', 'created_by', 'updated_by', 'created_at', 'updated_at',
            'archived_at', 'revision'
          )
      )
      and (
        select c.relrowsecurity
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = 'knowledge_base_tables'
      )
      and (
        select count(*) = 4
        from pg_policies
        where schemaname = 'public'
          and tablename = 'knowledge_base_tables'
          and policyname in (
            'rls_kb_tables_select_owner',
            'rls_kb_tables_select_published',
            'rls_kb_tables_insert_owner',
            'rls_kb_tables_update_owner'
          )
      )
      and (
        select count(*) = 2
        from pg_trigger tg
        join pg_class c on c.oid = tg.tgrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and not tg.tgisinternal
          and c.relname = 'knowledge_base_tables'
          and tg.tgname in (
            'knowledge_base_tables_touch_updated_at',
            'knowledge_base_tables_block_hard_delete'
          )
      )
      and (
        select count(*) = 3
        from pg_indexes
        where schemaname = 'public'
          and tablename = 'knowledge_base_tables'
          and indexname in (
            'knowledge_base_tables_pkey',
            'knowledge_base_tables_article_idx',
            'knowledge_base_tables_article_status_idx'
          )
      )
      and to_regprocedure('public.knowledge_base_tables_touch_updated_at()') is not null
      and not exists (
        select 1
        from information_schema.role_table_grants
        where grantee = 'authenticated'
          and table_schema = 'public'
          and table_name = 'knowledge_base_tables'
          and privilege_type = 'DELETE'
      )
      and not exists (
        select 1
        from information_schema.role_table_grants
        where grantee = 'anon'
          and table_schema = 'public'
          and table_name = 'knowledge_base_tables'
      )
    ) then 'full 028 posture detected — ALREADY_APPLIED candidate'
    else 'partial/absent posture — patch 028 can still apply if shape conflicts are PASS'
  end as detail;

-- -----------------------------------------------------------------------------
-- I. FINAL VERDICT — READY_TO_APPLY / ALREADY_APPLIED / NOT_READY
-- -----------------------------------------------------------------------------
with blocking as (
  select * from (
    values
      (
        'A1_kb_articles',
        (to_regclass('public.knowledge_base_articles') is not null)
      ),
      (
        'A2_kb_translations',
        (to_regclass('public.knowledge_base_article_translations') is not null)
      ),
      (
        'A3_kb_attachments',
        (to_regclass('public.knowledge_base_attachments') is not null)
      ),
      (
        'A4_kb_article_visible_to_reader',
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
        'A5_is_spiora_owner',
        (to_regprocedure('public.is_spiora_owner()') is not null)
      ),
      (
        'A6_spiora_block_hard_delete',
        (to_regprocedure('public.spiora_block_hard_delete()') is not null)
      ),
      (
        'B1_027_attachments_shape',
        (
          to_regclass('public.knowledge_base_attachments') is not null
          and (
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
        'B2_027_attachments_policies',
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
        'B3_027_hard_delete_trigger',
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
        'C1_active_owner',
        (
          select count(*) >= 1
          from public.user_profiles
          where status = 'active'
            and archived_at is null
            and role = 'owner'
        )
      ),
      (
        'D1_rls_articles',
        coalesce(
          (
            select c.relrowsecurity
            from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relname = 'knowledge_base_articles'
          ),
          false
        )
      ),
      (
        'D2_rls_translations',
        coalesce(
          (
            select c.relrowsecurity
            from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relname = 'knowledge_base_article_translations'
          ),
          false
        )
      ),
      (
        'D3_rls_attachments',
        coalesce(
          (
            select c.relrowsecurity
            from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relname = 'knowledge_base_attachments'
          ),
          false
        )
      ),
      (
        'E2_tables_shape',
        (
          to_regclass('public.knowledge_base_tables') is null
          or (
            select count(*) = 17
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'knowledge_base_tables'
              and column_name in (
                'id', 'article_id', 'title', 'description', 'schema_version',
                'columns', 'rows', 'row_count', 'column_count', 'sort_order',
                'status', 'created_by', 'updated_by', 'created_at', 'updated_at',
                'archived_at', 'revision'
              )
          )
        )
      ),
      (
        'F2_unexpected_policies',
        (
          to_regclass('public.knowledge_base_tables') is null
          or (
            select count(*) = 0
            from pg_policies
            where schemaname = 'public'
              and tablename = 'knowledge_base_tables'
              and policyname not in (
                'rls_kb_tables_select_owner',
                'rls_kb_tables_select_published',
                'rls_kb_tables_insert_owner',
                'rls_kb_tables_update_owner'
              )
          )
        )
      ),
      (
        'F4_unexpected_triggers',
        (
          to_regclass('public.knowledge_base_tables') is null
          or (
            select count(*) = 0
            from pg_trigger tg
            join pg_class c on c.oid = tg.tgrelid
            join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public'
              and not tg.tgisinternal
              and c.relname = 'knowledge_base_tables'
              and tg.tgname not in (
                'knowledge_base_tables_touch_updated_at',
                'knowledge_base_tables_block_hard_delete'
              )
          )
        )
      ),
      (
        'F6_unexpected_indexes',
        (
          to_regclass('public.knowledge_base_tables') is null
          or (
            select count(*) = 0
            from pg_indexes
            where schemaname = 'public'
              and tablename = 'knowledge_base_tables'
              and indexname not in (
                'knowledge_base_tables_pkey',
                'knowledge_base_tables_article_idx',
                'knowledge_base_tables_article_status_idx'
              )
          )
        )
      ),
      (
        'F8_name_conflicts',
        (
          select count(*) = 0
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where c.relkind = 'r'
            and n.nspname = 'public'
            and c.relname in (
              'kb_tables',
              'knowledge_base_table',
              'knowledge_base_editable_tables'
            )
        )
      ),
      (
        'G1_dependents',
        (
          to_regclass('public.knowledge_base_tables') is null
          or not exists (
            select 1
            from pg_depend d
            join pg_rewrite r on r.oid = d.objid
            join pg_class dependent_obj on dependent_obj.oid = r.ev_class
            join pg_namespace dependent_ns on dependent_ns.oid = dependent_obj.relnamespace
            join pg_class source_obj on source_obj.oid = d.refobjid
            join pg_namespace source_ns on source_ns.oid = source_obj.relnamespace
            where source_ns.nspname = 'public'
              and source_obj.relname = 'knowledge_base_tables'
              and dependent_obj.relname <> 'knowledge_base_tables'
              and dependent_ns.nspname = 'public'
          )
        )
      )
  ) as t(check_key, ok)
),
failed as (
  select string_agg(check_key, ', ' order by check_key) as failed_keys
  from blocking
  where not ok
),
already as (
  select
    to_regclass('public.knowledge_base_tables') is not null
    and (
      select count(*) = 17
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'knowledge_base_tables'
        and column_name in (
          'id', 'article_id', 'title', 'description', 'schema_version',
          'columns', 'rows', 'row_count', 'column_count', 'sort_order',
          'status', 'created_by', 'updated_by', 'created_at', 'updated_at',
          'archived_at', 'revision'
        )
    )
    and (
      select c.relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'knowledge_base_tables'
    )
    and (
      select count(*) = 4
      from pg_policies
      where schemaname = 'public'
        and tablename = 'knowledge_base_tables'
        and policyname in (
          'rls_kb_tables_select_owner',
          'rls_kb_tables_select_published',
          'rls_kb_tables_insert_owner',
          'rls_kb_tables_update_owner'
        )
    )
    and (
      select count(*) = 2
      from pg_trigger tg
      join pg_class c on c.oid = tg.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and not tg.tgisinternal
        and c.relname = 'knowledge_base_tables'
        and tg.tgname in (
          'knowledge_base_tables_touch_updated_at',
          'knowledge_base_tables_block_hard_delete'
        )
    )
    and (
      select count(*) = 3
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'knowledge_base_tables'
        and indexname in (
          'knowledge_base_tables_pkey',
          'knowledge_base_tables_article_idx',
          'knowledge_base_tables_article_status_idx'
        )
    )
    and to_regprocedure('public.knowledge_base_tables_touch_updated_at()') is not null
    and not exists (
      select 1
      from information_schema.role_table_grants
      where grantee = 'authenticated'
        and table_schema = 'public'
        and table_name = 'knowledge_base_tables'
        and privilege_type = 'DELETE'
    )
    and not exists (
      select 1
      from information_schema.role_table_grants
      where grantee = 'anon'
        and table_schema = 'public'
        and table_name = 'knowledge_base_tables'
    ) as is_already
)
select
  'FINAL_VERDICT' as check_id,
  case
    when (select failed_keys from failed) is not null then 'NOT_READY'
    when (select is_already from already) then 'ALREADY_APPLIED'
    else 'READY_TO_APPLY'
  end as status,
  case
    when (select failed_keys from failed) is not null
      then 'Blocking reasons: ' || (select failed_keys from failed)
        || '. Do NOT apply migration 028 until fixed. If A3/B* failed, finish attachments 027 first.'
    when (select is_already from already)
      then 'knowledge_base_tables already matches expected 028 posture. Skip apply or re-run patch only if you intentionally want idempotent refresh. Proceed to VALIDATE_028 + runtime smoke.'
    else 'All blocking checks PASS. Take backup of articles/translations/attachments, then apply SPIORA_SUPABASE_PATCH_028_KNOWLEDGE_BASE_TABLES.sql manually. Patch is idempotent (create if not exists + drop/create policies/triggers).'
  end as detail;

-- =============================================================================
-- How to read:
--   Run all queries. Look at FINAL_VERDICT row.
--   READY_TO_APPLY  → backup, then apply patch 028 manually.
--   ALREADY_APPLIED → skip apply (or optional idempotent refresh), run VALIDATE_028.
--   NOT_READY       → fix listed blocking reasons, re-run this file.
-- This script does NOT apply migration, mutate data, or push/deploy.
-- =============================================================================
