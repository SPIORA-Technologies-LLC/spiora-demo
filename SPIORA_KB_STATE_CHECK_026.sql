-- =============================================================================
-- SPIORA_KB_STATE_CHECK_026.sql
-- PR #19.3 — Read-only state inspection after accidental/partial patch apply
--
-- SAFE: SELECT only.
-- FORBIDDEN: INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, GRANT.
--
-- Does NOT apply migration, patch, seed, or rollback.
-- Run in Supabase SQL Editor. Do not paste service-role keys.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tables exist?
-- -----------------------------------------------------------------------------
select
  'T1_articles_exists' as check_id,
  case
    when to_regclass('public.knowledge_base_articles') is null then 'NO'
    else 'YES'
  end as status,
  coalesce(to_regclass('public.knowledge_base_articles')::text, 'absent') as detail;

select
  'T2_translations_exists' as check_id,
  case
    when to_regclass('public.knowledge_base_article_translations') is null then 'NO'
    else 'YES'
  end as status,
  coalesce(
    to_regclass('public.knowledge_base_article_translations')::text,
    'absent'
  ) as detail;

-- -----------------------------------------------------------------------------
-- 2. Row counts
-- -----------------------------------------------------------------------------
select
  'R1_articles_count' as check_id,
  case
    when to_regclass('public.knowledge_base_articles') is null then 'n/a'
    else (
      select count(*)::text from public.knowledge_base_articles
    )
  end as status,
  'rows in knowledge_base_articles' as detail;

select
  'R2_translations_count' as check_id,
  case
    when to_regclass('public.knowledge_base_article_translations') is null then 'n/a'
    else (
      select count(*)::text from public.knowledge_base_article_translations
    )
  end as status,
  'rows in knowledge_base_article_translations' as detail;

-- -----------------------------------------------------------------------------
-- 3. RLS enabled?
-- -----------------------------------------------------------------------------
select
  'L1_rls_articles' as check_id,
  case
    when to_regclass('public.knowledge_base_articles') is null then 'n/a'
    when (
      select c.relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'knowledge_base_articles'
    ) then 'ENABLED'
    else 'DISABLED'
  end as status,
  'row level security on knowledge_base_articles' as detail;

select
  'L2_rls_translations' as check_id,
  case
    when to_regclass('public.knowledge_base_article_translations') is null then 'n/a'
    when (
      select c.relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'knowledge_base_article_translations'
    ) then 'ENABLED'
    else 'DISABLED'
  end as status,
  'row level security on knowledge_base_article_translations' as detail;

-- -----------------------------------------------------------------------------
-- 4. Expected policies (7)
-- -----------------------------------------------------------------------------
select
  'P1_expected_policies' as check_id,
  (
    select count(*)::text
    from pg_policies
    where schemaname = 'public'
      and policyname in (
        'rls_kb_articles_select_owner',
        'rls_kb_articles_select_published',
        'rls_kb_articles_insert_owner',
        'rls_kb_articles_update_owner',
        'rls_kb_translations_select',
        'rls_kb_translations_insert_owner',
        'rls_kb_translations_update_owner'
      )
  ) || ' / 7' as status,
  coalesce(
    (
      select string_agg(policyname, ', ' order by policyname)
      from pg_policies
      where schemaname = 'public'
        and policyname in (
          'rls_kb_articles_select_owner',
          'rls_kb_articles_select_published',
          'rls_kb_articles_insert_owner',
          'rls_kb_articles_update_owner',
          'rls_kb_translations_select',
          'rls_kb_translations_insert_owner',
          'rls_kb_translations_update_owner'
        )
    ),
    'none'
  ) as detail;

select
  'P2_missing_policies' as check_id,
  case
    when count(*) = 0 then 'none'
    else string_agg(expected, ', ' order by expected)
  end as status,
  'policies from migration 026 that are absent' as detail
from (
  values
    ('rls_kb_articles_select_owner'),
    ('rls_kb_articles_select_published'),
    ('rls_kb_articles_insert_owner'),
    ('rls_kb_articles_update_owner'),
    ('rls_kb_translations_select'),
    ('rls_kb_translations_insert_owner'),
    ('rls_kb_translations_update_owner')
) as e(expected)
where not exists (
  select 1
  from pg_policies p
  where p.schemaname = 'public'
    and p.policyname = e.expected
);

select
  'P3_unexpected_policies' as check_id,
  coalesce(string_agg(policyname, ', ' order by policyname), 'none') as status,
  'KB policies not defined in migration 026' as detail
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

-- -----------------------------------------------------------------------------
-- 5. Expected triggers (3)
-- -----------------------------------------------------------------------------
select
  'G1_expected_triggers' as check_id,
  (
    select count(*)::text
    from pg_trigger tg
    join pg_class c on c.oid = tg.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and not tg.tgisinternal
      and tg.tgname in (
        'knowledge_base_articles_block_hard_delete',
        'knowledge_base_article_translations_block_hard_delete',
        'knowledge_base_article_translations_search_vector'
      )
  ) || ' / 3' as status,
  coalesce(
    (
      select string_agg(tg.tgname, ', ' order by tg.tgname)
      from pg_trigger tg
      join pg_class c on c.oid = tg.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and not tg.tgisinternal
        and tg.tgname in (
          'knowledge_base_articles_block_hard_delete',
          'knowledge_base_article_translations_block_hard_delete',
          'knowledge_base_article_translations_search_vector'
        )
    ),
    'none'
  ) as detail;

select
  'G2_missing_triggers' as check_id,
  case
    when count(*) = 0 then 'none'
    else string_agg(expected, ', ' order by expected)
  end as status,
  'triggers from migration 026 that are absent' as detail
from (
  values
    ('knowledge_base_articles_block_hard_delete'),
    ('knowledge_base_article_translations_block_hard_delete'),
    ('knowledge_base_article_translations_search_vector')
) as e(expected)
where not exists (
  select 1
  from pg_trigger tg
  join pg_class c on c.oid = tg.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and not tg.tgisinternal
    and tg.tgname = e.expected
);

-- -----------------------------------------------------------------------------
-- 6. Expected indexes (6)
-- -----------------------------------------------------------------------------
select
  'I1_expected_indexes' as check_id,
  (
    select count(*)::text
    from pg_indexes
    where schemaname = 'public'
      and indexname in (
        'knowledge_base_articles_slug_uidx',
        'knowledge_base_articles_status_idx',
        'knowledge_base_articles_category_idx',
        'knowledge_base_articles_updated_idx',
        'knowledge_base_article_translations_article_locale_uidx',
        'knowledge_base_article_translations_search_idx'
      )
  ) || ' / 6' as status,
  coalesce(
    (
      select string_agg(indexname, ', ' order by indexname)
      from pg_indexes
      where schemaname = 'public'
        and indexname in (
          'knowledge_base_articles_slug_uidx',
          'knowledge_base_articles_status_idx',
          'knowledge_base_articles_category_idx',
          'knowledge_base_articles_updated_idx',
          'knowledge_base_article_translations_article_locale_uidx',
          'knowledge_base_article_translations_search_idx'
        )
    ),
    'none'
  ) as detail;

select
  'I2_missing_indexes' as check_id,
  case
    when count(*) = 0 then 'none'
    else string_agg(expected, ', ' order by expected)
  end as status,
  'indexes from migration 026 that are absent' as detail
from (
  values
    ('knowledge_base_articles_slug_uidx'),
    ('knowledge_base_articles_status_idx'),
    ('knowledge_base_articles_category_idx'),
    ('knowledge_base_articles_updated_idx'),
    ('knowledge_base_article_translations_article_locale_uidx'),
    ('knowledge_base_article_translations_search_idx')
) as e(expected)
where not exists (
  select 1
  from pg_indexes i
  where i.schemaname = 'public'
    and i.indexname = e.expected
);

-- -----------------------------------------------------------------------------
-- 7. Helper functions
-- -----------------------------------------------------------------------------
select
  'F1_helpers' as check_id,
  (
    select count(*)::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'is_spiora_kb_reader',
        'kb_article_visible_to_reader',
        'knowledge_base_translations_search_vector'
      )
  ) || ' / 3' as status,
  coalesce(
    (
      select string_agg(p.proname, ', ' order by p.proname)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in (
          'is_spiora_kb_reader',
          'kb_article_visible_to_reader',
          'knowledge_base_translations_search_vector'
        )
    ),
    'none'
  ) as detail;

-- -----------------------------------------------------------------------------
-- 8. Structure matches migration 026?
-- -----------------------------------------------------------------------------
select
  'S1_articles_columns' as check_id,
  case
    when to_regclass('public.knowledge_base_articles') is null then 'ABSENT'
    when (
      select count(*) = 11
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'knowledge_base_articles'
        and column_name in (
          'id', 'slug', 'category_id', 'tag_keys', 'author_key', 'status',
          'is_demo', 'created_at', 'updated_at', 'published_at', 'archived_at'
        )
    ) then 'MATCH'
    else 'MISMATCH'
  end as status,
  coalesce(
    (
      select string_agg(column_name || ':' || data_type, ', ' order by ordinal_position)
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'knowledge_base_articles'
    ),
    'n/a'
  ) as detail;

select
  'S2_translations_columns' as check_id,
  case
    when to_regclass('public.knowledge_base_article_translations') is null
      then 'ABSENT'
    when (
      select count(*) = 9
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'knowledge_base_article_translations'
        and column_name in (
          'id', 'article_id', 'locale', 'title', 'summary', 'content',
          'search_vector', 'created_at', 'updated_at'
        )
    ) then 'MATCH'
    else 'MISMATCH'
  end as status,
  coalesce(
    (
      select string_agg(column_name || ':' || data_type, ', ' order by ordinal_position)
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'knowledge_base_article_translations'
    ),
    'n/a'
  ) as detail;

-- -----------------------------------------------------------------------------
-- 9. NEXT ACTION recommendation
-- -----------------------------------------------------------------------------
with state as (
  select
    (to_regclass('public.knowledge_base_articles') is not null) as articles_exist,
    (to_regclass('public.knowledge_base_article_translations') is not null) as translations_exist,
    coalesce(
      (
        select c.relrowsecurity
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = 'knowledge_base_articles'
      ),
      false
    ) as rls_articles,
    coalesce(
      (
        select c.relrowsecurity
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname = 'knowledge_base_article_translations'
      ),
      false
    ) as rls_translations,
    (
      select count(*)
      from pg_policies
      where schemaname = 'public'
        and policyname in (
          'rls_kb_articles_select_owner',
          'rls_kb_articles_select_published',
          'rls_kb_articles_insert_owner',
          'rls_kb_articles_update_owner',
          'rls_kb_translations_select',
          'rls_kb_translations_insert_owner',
          'rls_kb_translations_update_owner'
        )
    ) as policy_count,
    (
      select count(*)
      from pg_trigger tg
      join pg_class c on c.oid = tg.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and not tg.tgisinternal
        and tg.tgname in (
          'knowledge_base_articles_block_hard_delete',
          'knowledge_base_article_translations_block_hard_delete',
          'knowledge_base_article_translations_search_vector'
        )
    ) as trigger_count,
    (
      select count(*)
      from pg_indexes
      where schemaname = 'public'
        and indexname in (
          'knowledge_base_articles_slug_uidx',
          'knowledge_base_articles_status_idx',
          'knowledge_base_articles_category_idx',
          'knowledge_base_articles_updated_idx',
          'knowledge_base_article_translations_article_locale_uidx',
          'knowledge_base_article_translations_search_idx'
        )
    ) as index_count,
    (
      select count(*)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in (
          'is_spiora_kb_reader',
          'kb_article_visible_to_reader',
          'knowledge_base_translations_search_vector'
        )
    ) as helper_count,
    case
      when to_regclass('public.knowledge_base_articles') is null then false
      else (
        select count(*) = 11
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'knowledge_base_articles'
          and column_name in (
            'id', 'slug', 'category_id', 'tag_keys', 'author_key', 'status',
            'is_demo', 'created_at', 'updated_at', 'published_at', 'archived_at'
          )
      )
    end as articles_shape_ok,
    case
      when to_regclass('public.knowledge_base_article_translations') is null
        then false
      else (
        select count(*) = 9
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'knowledge_base_article_translations'
          and column_name in (
            'id', 'article_id', 'locale', 'title', 'summary', 'content',
            'search_vector', 'created_at', 'updated_at'
          )
      )
    end as translations_shape_ok,
    case
      when to_regclass('public.knowledge_base_articles') is null then 0
      else (select count(*)::int from public.knowledge_base_articles)
    end as articles_rows,
    case
      when to_regclass('public.knowledge_base_article_translations') is null then 0
      else (select count(*)::int from public.knowledge_base_article_translations)
    end as translations_rows,
    (
      select count(*)
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
    ) as unexpected_policy_count
),
classified as (
  select
    *,
    (
      articles_exist
      and translations_exist
      and articles_shape_ok
      and translations_shape_ok
      and rls_articles
      and rls_translations
      and policy_count = 7
      and trigger_count = 3
      and index_count = 6
      and helper_count = 3
      and unexpected_policy_count = 0
    ) as fully_applied,
    (
      not articles_exist and not translations_exist
    ) as not_applied,
    (
      articles_exist
      and translations_exist
      and (not articles_shape_ok or not translations_shape_ok)
    ) as shape_broken
  from state
)
select
  'NEXT_ACTION' as check_id,
  case
    when shape_broken then 'ROLLBACK_THEN_REAPPLY_PATCH'
    when not_applied then 'APPLY_PATCH_THEN_SEED'
    when fully_applied and articles_rows = 0 and translations_rows = 0
      then 'CONTINUE_WITH_SEED'
    when fully_applied and articles_rows = 15 and translations_rows = 30
      then 'NOTHING_RUN_VALIDATE_026'
    when fully_applied and articles_rows > 0
      then 'REVIEW_DATA_THEN_VALIDATE_OR_RESEED'
    when articles_exist or translations_exist
      then 'REAPPLY_PATCH_IDEMPOTENT'
    else 'APPLY_PATCH_THEN_SEED'
  end as status,
  case
    when shape_broken then
      'Table shape MISMATCH vs migration 026. Do NOT seed. Consider SPIORA_SUPABASE_PATCH_026_KNOWLEDGE_BASE_ROLLBACK.sql then re-apply patch (manual confirmation required).'
    when not_applied then
      'Tables absent. Apply SPIORA_SUPABASE_PATCH_026_KNOWLEDGE_BASE.sql, then seed.'
    when fully_applied and articles_rows = 0 and translations_rows = 0 then
      'Patch looks complete and tables are empty. Safe next step: apply SPIORA_KNOWLEDGE_BASE_SEED_026.sql only (no rollback).'
    when fully_applied and articles_rows = 15 and translations_rows = 30 then
      'Patch + seed already look complete. Do nothing destructive. Run SPIORA_KB_VALIDATE_026.sql.'
    when fully_applied and articles_rows > 0 then
      'Patch complete but row counts are not 15/30. Inspect data; decide validate vs re-run seed (seed is idempotent upsert).'
    when articles_exist or translations_exist then
      'Partial objects present. Re-run SPIORA_SUPABASE_PATCH_026_KNOWLEDGE_BASE.sql (idempotent) to finish policies/triggers/indexes/RLS. Then seed if empty.'
    else
      'Apply patch, then seed.'
  end as detail
from classified;

-- -----------------------------------------------------------------------------
-- 10. FINAL VERDICT
-- -----------------------------------------------------------------------------
with state as (
  select
    (to_regclass('public.knowledge_base_articles') is not null) as articles_exist,
    (to_regclass('public.knowledge_base_article_translations') is not null) as translations_exist,
    coalesce(
      (
        select c.relrowsecurity
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = 'knowledge_base_articles'
      ),
      false
    ) as rls_articles,
    coalesce(
      (
        select c.relrowsecurity
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname = 'knowledge_base_article_translations'
      ),
      false
    ) as rls_translations,
    (
      select count(*)
      from pg_policies
      where schemaname = 'public'
        and policyname in (
          'rls_kb_articles_select_owner',
          'rls_kb_articles_select_published',
          'rls_kb_articles_insert_owner',
          'rls_kb_articles_update_owner',
          'rls_kb_translations_select',
          'rls_kb_translations_insert_owner',
          'rls_kb_translations_update_owner'
        )
    ) as policy_count,
    (
      select count(*)
      from pg_trigger tg
      join pg_class c on c.oid = tg.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and not tg.tgisinternal
        and tg.tgname in (
          'knowledge_base_articles_block_hard_delete',
          'knowledge_base_article_translations_block_hard_delete',
          'knowledge_base_article_translations_search_vector'
        )
    ) as trigger_count,
    (
      select count(*)
      from pg_indexes
      where schemaname = 'public'
        and indexname in (
          'knowledge_base_articles_slug_uidx',
          'knowledge_base_articles_status_idx',
          'knowledge_base_articles_category_idx',
          'knowledge_base_articles_updated_idx',
          'knowledge_base_article_translations_article_locale_uidx',
          'knowledge_base_article_translations_search_idx'
        )
    ) as index_count,
    (
      select count(*)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in (
          'is_spiora_kb_reader',
          'kb_article_visible_to_reader',
          'knowledge_base_translations_search_vector'
        )
    ) as helper_count,
    case
      when to_regclass('public.knowledge_base_articles') is null then false
      else (
        select count(*) = 11
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'knowledge_base_articles'
          and column_name in (
            'id', 'slug', 'category_id', 'tag_keys', 'author_key', 'status',
            'is_demo', 'created_at', 'updated_at', 'published_at', 'archived_at'
          )
      )
    end as articles_shape_ok,
    case
      when to_regclass('public.knowledge_base_article_translations') is null
        then false
      else (
        select count(*) = 9
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'knowledge_base_article_translations'
          and column_name in (
            'id', 'article_id', 'locale', 'title', 'summary', 'content',
            'search_vector', 'created_at', 'updated_at'
          )
      )
    end as translations_shape_ok,
    (
      select count(*)
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
    ) as unexpected_policy_count
)
select
  'FINAL_VERDICT' as check_id,
  case
    when not articles_exist and not translations_exist
      then 'PATCH_NOT_APPLIED'
    when
      articles_exist
      and translations_exist
      and articles_shape_ok
      and translations_shape_ok
      and rls_articles
      and rls_translations
      and policy_count = 7
      and trigger_count = 3
      and index_count = 6
      and helper_count = 3
      and unexpected_policy_count = 0
      then 'PATCH_ALREADY_APPLIED'
    else 'PATCH_PARTIALLY_APPLIED'
  end as status,
  format(
    'tables=%s/%s shape=%s/%s rls=%s/%s policies=%s/7 triggers=%s/3 indexes=%s/6 helpers=%s/3 unexpected_policies=%s',
    case when articles_exist then 'Y' else 'N' end,
    case when translations_exist then 'Y' else 'N' end,
    case when articles_shape_ok then 'ok' else 'bad' end,
    case when translations_shape_ok then 'ok' else 'bad' end,
    case when rls_articles then 'on' else 'off' end,
    case when rls_translations then 'on' else 'off' end,
    policy_count,
    trigger_count,
    index_count,
    helper_count,
    unexpected_policy_count
  ) as detail
from state;

-- =============================================================================
-- How to read:
--   1) Inspect T*/R*/L*/P*/G*/I*/F*/S* rows.
--   2) Read NEXT_ACTION for recommended manual step.
--   3) Read FINAL_VERDICT:
--        PATCH_ALREADY_APPLIED  → usually CONTINUE_WITH_SEED if empty
--        PATCH_PARTIALLY_APPLIED → REAPPLY_PATCH (or ROLLBACK if shape broken)
--        PATCH_NOT_APPLIED      → APPLY_PATCH_THEN_SEED
-- This file changes nothing.
-- =============================================================================
