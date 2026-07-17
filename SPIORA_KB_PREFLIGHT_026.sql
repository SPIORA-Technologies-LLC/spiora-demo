-- =============================================================================
-- SPIORA_KB_PREFLIGHT_026.sql
-- PR #19.3 — Read-only preflight before Knowledge Base migration 026
--
-- SAFE: SELECT / EXISTS only.
-- FORBIDDEN: INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, GRANT.
--
-- Run in Supabase SQL Editor BEFORE apply.
-- Do NOT paste service-role keys. Do NOT run from the browser app.
-- Do NOT auto-apply migration after this file.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A. Prerequisites: migration 025 / RLS Phase 1
-- -----------------------------------------------------------------------------
select
  'A1_rls_phase1_function' as check_id,
  case
    when to_regprocedure('public.spiora_rls_phase1_status()') is null
      then 'FAIL'
    else 'PASS'
  end as status,
  case
    when to_regprocedure('public.spiora_rls_phase1_status()') is null
      then 'spiora_rls_phase1_status() missing — apply RLS Phase 1 (025) first'
    else public.spiora_rls_phase1_status()::text
  end as detail;

select
  'A2_is_spiora_owner' as check_id,
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
  'A3_spiora_block_hard_delete' as check_id,
  case
    when to_regprocedure('public.spiora_block_hard_delete()') is null then 'FAIL'
    else 'PASS'
  end as status,
  case
    when to_regprocedure('public.spiora_block_hard_delete()') is null
      then 'spiora_block_hard_delete() missing'
    else 'present'
  end as detail;

select
  'A4_rls_phase1_enabled' as check_id,
  case
    when to_regprocedure('public.spiora_rls_phase1_status()') is null then 'FAIL'
    when public.spiora_rls_phase1_status()::text = 'enabled' then 'PASS'
    else 'FAIL'
  end as status,
  case
    when to_regprocedure('public.spiora_rls_phase1_status()') is null
      then 'cannot evaluate'
    else public.spiora_rls_phase1_status()::text
  end as detail;

-- -----------------------------------------------------------------------------
-- B. Active owner in user_profiles
-- -----------------------------------------------------------------------------
select
  'B1_active_profiles' as check_id,
  'INFO' as status,
  count(*)::text as detail
from public.user_profiles
where status = 'active'
  and archived_at is null;

select
  'B2_active_owner_count' as check_id,
  case when count(*) = 1 then 'PASS' else 'FAIL' end as status,
  count(*)::text || ' (expected 1)' as detail
from public.user_profiles
where status = 'active'
  and archived_at is null
  and role = 'owner';

select
  'B3_profiles_without_auth_user' as check_id,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status,
  count(*)::text || ' (expected 0)' as detail
from public.user_profiles
where auth_user_id is null
  and archived_at is null;

select
  'B4_invalid_roles' as check_id,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status,
  coalesce(string_agg(distinct role, ', '), 'none') as detail
from public.user_profiles
where role not in ('owner', 'manager', 'consultant', 'viewer');

select
  'B5_invalid_statuses' as check_id,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status,
  coalesce(string_agg(distinct status, ', '), 'none') as detail
from public.user_profiles
where status not in ('active', 'invited', 'suspended');

-- -----------------------------------------------------------------------------
-- C. Knowledge Base tables — absent OR expected shape
-- -----------------------------------------------------------------------------
select
  'C1_kb_articles_exists' as check_id,
  'INFO' as status,
  case
    when to_regclass('public.knowledge_base_articles') is null
      then 'absent (ready to create)'
    else 'EXISTS'
  end as detail;

select
  'C2_kb_translations_exists' as check_id,
  'INFO' as status,
  case
    when to_regclass('public.knowledge_base_article_translations') is null
      then 'absent (ready to create)'
    else 'EXISTS'
  end as detail;

select
  'C3_kb_articles_shape' as check_id,
  case
    when to_regclass('public.knowledge_base_articles') is null then 'PASS'
    when (
      select count(*) = 11
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'knowledge_base_articles'
        and column_name in (
          'id', 'slug', 'category_id', 'tag_keys', 'author_key', 'status',
          'is_demo', 'created_at', 'updated_at', 'published_at', 'archived_at'
        )
    ) then 'PASS'
    else 'FAIL'
  end as status,
  case
    when to_regclass('public.knowledge_base_articles') is null
      then 'n/a (table absent)'
    else coalesce(
      (
        select string_agg(column_name, ', ' order by ordinal_position)
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'knowledge_base_articles'
      ),
      'no columns'
    )
  end as detail;

select
  'C4_kb_translations_shape' as check_id,
  case
    when to_regclass('public.knowledge_base_article_translations') is null then 'PASS'
    when (
      select count(*) = 9
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'knowledge_base_article_translations'
        and column_name in (
          'id', 'article_id', 'locale', 'title', 'summary', 'content',
          'search_vector', 'created_at', 'updated_at'
        )
    ) then 'PASS'
    else 'FAIL'
  end as status,
  case
    when to_regclass('public.knowledge_base_article_translations') is null
      then 'n/a (table absent)'
    else coalesce(
      (
        select string_agg(column_name, ', ' order by ordinal_position)
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'knowledge_base_article_translations'
      ),
      'no columns'
    )
  end as detail;

select
  'C5_name_collision_tables' as check_id,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status,
  coalesce(string_agg(tablename, ', '), 'none') as detail
from pg_tables
where schemaname = 'public'
  and tablename in ('knowledge_base', 'kb_articles', 'knowledge_articles');

-- -----------------------------------------------------------------------------
-- D. Conflicting policies / functions / triggers
-- -----------------------------------------------------------------------------
-- Before first apply: expect none.
-- Re-run after partial apply: listing is INFO; FAIL only on unexpected foreign names.

select
  'D1_existing_kb_policies' as check_id,
  'INFO' as status,
  coalesce(string_agg(policyname, ', ' order by policyname), 'none') as detail
from pg_policies
where schemaname = 'public'
  and tablename in (
    'knowledge_base_articles',
    'knowledge_base_article_translations'
  );

select
  'D2_unexpected_kb_policies' as check_id,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status,
  coalesce(string_agg(policyname, ', ' order by policyname), 'none') as detail
from pg_policies
where schemaname = 'public'
  and tablename in (
    'knowledge_base_articles',
    'knowledge_base_article_translations'
  )
  and policyname not in (
    'rls_kb_articles_select_owner',
    'rls_kb_articles_select_published',
    'rls_kb_articles_insert_owner',
    'rls_kb_articles_update_owner',
    'rls_kb_translations_select',
    'rls_kb_translations_insert_owner',
    'rls_kb_translations_update_owner'
  );

select
  'D3_existing_kb_helper_functions' as check_id,
  'INFO' as status,
  coalesce(string_agg(p.proname, ', ' order by p.proname), 'none') as detail
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'is_spiora_kb_reader',
    'kb_article_visible_to_reader',
    'knowledge_base_translations_search_vector'
  );

select
  'D4_existing_kb_triggers' as check_id,
  'INFO' as status,
  coalesce(string_agg(tg.tgname, ', ' order by tg.tgname), 'none') as detail
from pg_trigger tg
join pg_class c on c.oid = tg.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and not tg.tgisinternal
  and c.relname in (
    'knowledge_base_articles',
    'knowledge_base_article_translations'
  );

select
  'D5_unexpected_kb_triggers' as check_id,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status,
  coalesce(string_agg(tg.tgname, ', ' order by tg.tgname), 'none') as detail
from pg_trigger tg
join pg_class c on c.oid = tg.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and not tg.tgisinternal
  and c.relname in (
    'knowledge_base_articles',
    'knowledge_base_article_translations'
  )
  and tg.tgname not in (
    'knowledge_base_articles_block_hard_delete',
    'knowledge_base_article_translations_block_hard_delete',
    'knowledge_base_article_translations_search_vector'
  );

-- -----------------------------------------------------------------------------
-- E. FINAL VERDICT — READY_TO_APPLY / NOT_READY
-- -----------------------------------------------------------------------------
with checks as (
  select * from (
    values
      (
        'A1',
        (to_regprocedure('public.spiora_rls_phase1_status()') is not null)
      ),
      (
        'A2',
        (to_regprocedure('public.is_spiora_owner()') is not null)
      ),
      (
        'A3',
        (to_regprocedure('public.spiora_block_hard_delete()') is not null)
      ),
      (
        'A4',
        (
          to_regprocedure('public.spiora_rls_phase1_status()') is not null
          and public.spiora_rls_phase1_status()::text = 'enabled'
        )
      ),
      (
        'B2',
        (
          select count(*) = 1
          from public.user_profiles
          where status = 'active'
            and archived_at is null
            and role = 'owner'
        )
      ),
      (
        'B3',
        (
          select count(*) = 0
          from public.user_profiles
          where auth_user_id is null
            and archived_at is null
        )
      ),
      (
        'B4',
        (
          select count(*) = 0
          from public.user_profiles
          where role not in ('owner', 'manager', 'consultant', 'viewer')
        )
      ),
      (
        'B5',
        (
          select count(*) = 0
          from public.user_profiles
          where status not in ('active', 'invited', 'suspended')
        )
      ),
      (
        'C3',
        (
          to_regclass('public.knowledge_base_articles') is null
          or (
            select count(*) = 11
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'knowledge_base_articles'
              and column_name in (
                'id', 'slug', 'category_id', 'tag_keys', 'author_key', 'status',
                'is_demo', 'created_at', 'updated_at', 'published_at', 'archived_at'
              )
          )
        )
      ),
      (
        'C4',
        (
          to_regclass('public.knowledge_base_article_translations') is null
          or (
            select count(*) = 9
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'knowledge_base_article_translations'
              and column_name in (
                'id', 'article_id', 'locale', 'title', 'summary', 'content',
                'search_vector', 'created_at', 'updated_at'
              )
          )
        )
      ),
      (
        'C5',
        (
          select count(*) = 0
          from pg_tables
          where schemaname = 'public'
            and tablename in ('knowledge_base', 'kb_articles', 'knowledge_articles')
        )
      ),
      (
        'D2',
        (
          select count(*) = 0
          from pg_policies
          where schemaname = 'public'
            and tablename in (
              'knowledge_base_articles',
              'knowledge_base_article_translations'
            )
            and policyname not in (
              'rls_kb_articles_select_owner',
              'rls_kb_articles_select_published',
              'rls_kb_articles_insert_owner',
              'rls_kb_articles_update_owner',
              'rls_kb_translations_select',
              'rls_kb_translations_insert_owner',
              'rls_kb_translations_update_owner'
            )
        )
      ),
      (
        'D5',
        (
          select count(*) = 0
          from pg_trigger tg
          join pg_class c on c.oid = tg.tgrelid
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public'
            and not tg.tgisinternal
            and c.relname in (
              'knowledge_base_articles',
              'knowledge_base_article_translations'
            )
            and tg.tgname not in (
              'knowledge_base_articles_block_hard_delete',
              'knowledge_base_article_translations_block_hard_delete',
              'knowledge_base_article_translations_search_vector'
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
      then 'All blocking checks PASS. Proceed to backup confirmation, then apply patch 026 + seed manually.'
    else 'Failed checks: ' || (select failed_keys from failed) || '. Do NOT apply migration 026.'
  end as detail;

-- =============================================================================
-- How to read:
--   Run all queries. Look at FINAL_VERDICT row.
--   READY_TO_APPLY → safe to proceed with manual apply (after backup).
--   NOT_READY → fix failed check_keys, re-run this file.
-- Migration / seed are NOT applied by this script.
-- =============================================================================
