-- =============================================================================
-- SPIORA_KB_VALIDATE_026.sql
-- PR #19.3 — Post-apply validation for Knowledge Base migration 026 + seed
--
-- Run AFTER:
--   1) SPIORA_SUPABASE_PATCH_026_KNOWLEDGE_BASE.sql (or migration 026)
--   2) SPIORA_KNOWLEDGE_BASE_SEED_026.sql
--
-- Mostly read-only. No DROP / DELETE of data.
-- Do NOT paste service-role keys into browser or logs.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Counts
-- -----------------------------------------------------------------------------
select 'articles_total' as check_id, count(*)::text as result
from public.knowledge_base_articles;
-- EXPECT: 15

select 'articles_published' as check_id, count(*)::text as result
from public.knowledge_base_articles
where status = 'published' and archived_at is null;
-- EXPECT: 15 (after seed)

select 'translations_total' as check_id, count(*)::text as result
from public.knowledge_base_article_translations;
-- EXPECT: 30

select 'translations_by_locale' as check_id, locale || '=' || count(*)::text as result
from public.knowledge_base_article_translations
group by locale
order by locale;
-- EXPECT: en=15, ru=15

select 'unique_slugs' as check_id, count(distinct slug)::text as result
from public.knowledge_base_articles;
-- EXPECT: 15

-- -----------------------------------------------------------------------------
-- 2. Bilingual coverage (each slug has en + ru)
-- -----------------------------------------------------------------------------
select
  'missing_locale_pairs' as check_id,
  coalesce(string_agg(a.slug, ', ' order by a.slug), 'none') as result
from public.knowledge_base_articles a
where not exists (
  select 1 from public.knowledge_base_article_translations t
  where t.article_id = a.id and t.locale = 'en'
)
or not exists (
  select 1 from public.knowledge_base_article_translations t
  where t.article_id = a.id and t.locale = 'ru'
);
-- EXPECT: none

-- -----------------------------------------------------------------------------
-- 3. Content quality
-- -----------------------------------------------------------------------------
select
  'empty_title_summary_content' as check_id,
  count(*)::text as result
from public.knowledge_base_article_translations
where length(trim(title)) = 0
   or length(trim(summary)) = 0
   or length(trim(content)) = 0;
-- EXPECT: 0

select
  'invalid_article_status' as check_id,
  coalesce(string_agg(distinct status, ', '), 'none') as result
from public.knowledge_base_articles
where status not in ('draft', 'published', 'archived');
-- EXPECT: none

select
  'invalid_category' as check_id,
  coalesce(string_agg(distinct category_id, ', '), 'none') as result
from public.knowledge_base_articles
where category_id not in (
  'company-policies',
  'client-workflow',
  'document-management',
  'team-onboarding',
  'ai-automation'
);
-- EXPECT: none

select
  'invalid_locale' as check_id,
  coalesce(string_agg(distinct locale, ', '), 'none') as result
from public.knowledge_base_article_translations
where locale not in ('en', 'ru');
-- EXPECT: none

-- -----------------------------------------------------------------------------
-- 4. RLS enabled
-- -----------------------------------------------------------------------------
select
  'rls_articles' as check_id,
  case when c.relrowsecurity then 'enabled' else 'FAIL: disabled' end as result
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'knowledge_base_articles';

select
  'rls_translations' as check_id,
  case when c.relrowsecurity then 'enabled' else 'FAIL: disabled' end as result
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'knowledge_base_article_translations';

-- -----------------------------------------------------------------------------
-- 5. Expected policies
-- -----------------------------------------------------------------------------
select
  'kb_policies_present' as check_id,
  coalesce(string_agg(policyname, ', ' order by policyname), 'MISSING') as result
from pg_policies
where schemaname = 'public'
  and tablename in ('knowledge_base_articles', 'knowledge_base_article_translations')
  and policyname in (
    'rls_kb_articles_select_owner',
    'rls_kb_articles_select_published',
    'rls_kb_articles_insert_owner',
    'rls_kb_articles_update_owner',
    'rls_kb_translations_select',
    'rls_kb_translations_insert_owner',
    'rls_kb_translations_update_owner'
  );
-- EXPECT: all 7 names listed

select
  'kb_policies_count' as check_id,
  count(*)::text as result
from pg_policies
where schemaname = 'public'
  and tablename in ('knowledge_base_articles', 'knowledge_base_article_translations')
  and policyname in (
    'rls_kb_articles_select_owner',
    'rls_kb_articles_select_published',
    'rls_kb_articles_insert_owner',
    'rls_kb_articles_update_owner',
    'rls_kb_translations_select',
    'rls_kb_translations_insert_owner',
    'rls_kb_translations_update_owner'
  );
-- EXPECT: 7

-- -----------------------------------------------------------------------------
-- 6. Hard delete triggers
-- -----------------------------------------------------------------------------
select
  'hard_delete_triggers' as check_id,
  coalesce(string_agg(tg.tgname, ', ' order by tg.tgname), 'FAIL: missing') as result
from pg_trigger tg
join pg_class c on c.oid = tg.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and not tg.tgisinternal
  and c.relname in (
    'knowledge_base_articles',
    'knowledge_base_article_translations'
  )
  and tg.tgname in (
    'knowledge_base_articles_block_hard_delete',
    'knowledge_base_article_translations_block_hard_delete'
  );
-- EXPECT: both trigger names

-- -----------------------------------------------------------------------------
-- 7. Privileges: anon denied; authenticated no DELETE
-- -----------------------------------------------------------------------------
select
  'anon_table_privileges' as check_id,
  coalesce(
    (
      select string_agg(privilege_type, ',' order by privilege_type)
      from information_schema.role_table_grants
      where grantee = 'anon'
        and table_schema = 'public'
        and table_name in (
          'knowledge_base_articles',
          'knowledge_base_article_translations'
        )
    ),
    'none'
  ) as result;
-- EXPECT: none

select
  'authenticated_has_delete' as check_id,
  coalesce(
    (
      select string_agg(table_name || ':' || privilege_type, ', ')
      from information_schema.role_table_grants
      where grantee = 'authenticated'
        and table_schema = 'public'
        and table_name in (
          'knowledge_base_articles',
          'knowledge_base_article_translations'
        )
        and privilege_type = 'DELETE'
    ),
    'none'
  ) as result;
-- EXPECT: none

-- -----------------------------------------------------------------------------
-- 8. Policy intent summary (documentation query)
-- -----------------------------------------------------------------------------
select
  'owner_write_policies' as check_id,
  count(*)::text as result
from pg_policies
where schemaname = 'public'
  and policyname in (
    'rls_kb_articles_insert_owner',
    'rls_kb_articles_update_owner',
    'rls_kb_translations_insert_owner',
    'rls_kb_translations_update_owner'
  );
-- EXPECT: 4

select
  'published_select_policy' as check_id,
  case
    when exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and policyname = 'rls_kb_articles_select_published'
    ) then 'ok — non-owner published-only SELECT'
    else 'FAIL'
  end as result;

-- Note: live impersonation of anon / manager must be done from the app or
-- Dashboard Auth impersonation — not from this SQL alone (service_role bypasses RLS).

-- -----------------------------------------------------------------------------
-- Decision guide
-- -----------------------------------------------------------------------------
-- PASS when:
--   articles_total = 15, translations_total = 30, unique_slugs = 15
--   missing_locale_pairs = none, empty fields = 0
--   rls_* = enabled, kb_policies_count = 7
--   hard_delete_triggers present, anon privileges = none
--
-- Then proceed to local runtime + UI E2E (see SPIORA_KB_CUTOVER_CHECKLIST.md).
-- =============================================================================
