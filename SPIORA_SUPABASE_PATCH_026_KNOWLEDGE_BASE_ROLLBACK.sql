-- =============================================================================
-- SPIORA_SUPABASE_PATCH_026_KNOWLEDGE_BASE_ROLLBACK.sql
-- PR #19 — Rollback Knowledge Base tables/policies only
--
-- Use ONLY on blocking runtime regression after KB migration apply.
-- Does NOT touch RLS Phase 1 tables (clients, profiles, etc.).
-- Do NOT auto-run. Manual confirmation required.
-- =============================================================================

-- Policies — articles
drop policy if exists rls_kb_articles_select_owner on public.knowledge_base_articles;
drop policy if exists rls_kb_articles_select_published on public.knowledge_base_articles;
drop policy if exists rls_kb_articles_insert_owner on public.knowledge_base_articles;
drop policy if exists rls_kb_articles_update_owner on public.knowledge_base_articles;

-- Policies — translations
drop policy if exists rls_kb_translations_select on public.knowledge_base_article_translations;
drop policy if exists rls_kb_translations_insert_owner on public.knowledge_base_article_translations;
drop policy if exists rls_kb_translations_update_owner on public.knowledge_base_article_translations;

-- Triggers
drop trigger if exists knowledge_base_articles_block_hard_delete on public.knowledge_base_articles;
drop trigger if exists knowledge_base_article_translations_block_hard_delete
  on public.knowledge_base_article_translations;
drop trigger if exists knowledge_base_article_translations_search_vector
  on public.knowledge_base_article_translations;

-- Disable RLS before drop
alter table if exists public.knowledge_base_article_translations disable row level security;
alter table if exists public.knowledge_base_articles disable row level security;

-- Helpers (before tables — row type dependency)
drop function if exists public.kb_article_visible_to_reader(public.knowledge_base_articles);
drop function if exists public.is_spiora_kb_reader();
drop function if exists public.knowledge_base_translations_search_vector();

-- Tables (translations first — FK)
drop table if exists public.knowledge_base_article_translations;
drop table if exists public.knowledge_base_articles;

-- After rollback: keep SPIORA_KB_EMBEDDED_FALLBACK=true on Vercel.
-- Runtime serves embedded i18n articles until re-apply.
