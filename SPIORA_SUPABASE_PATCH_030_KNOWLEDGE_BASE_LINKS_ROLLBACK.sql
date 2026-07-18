-- =============================================================================
-- SPIORA_SUPABASE_PATCH_030_KNOWLEDGE_BASE_LINKS_ROLLBACK.sql
-- Drops external_url from knowledge_base_articles.
-- Do NOT auto-apply.
-- =============================================================================

alter table public.knowledge_base_articles
  drop constraint if exists knowledge_base_articles_external_url_check;

alter table public.knowledge_base_articles
  drop column if exists external_url;
