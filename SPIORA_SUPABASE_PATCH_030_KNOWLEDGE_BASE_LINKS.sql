-- =============================================================================
-- SPIORA_SUPABASE_PATCH_030_KNOWLEDGE_BASE_LINKS.sql
-- Knowledge Base external link materials Phase 1
-- Adds nullable external_url on knowledge_base_articles.
-- Idempotent. Non-destructive. No secrets. Do NOT auto-apply.
-- Requires migration 026 (articles) already applied.
-- =============================================================================

alter table public.knowledge_base_articles
  add column if not exists external_url text;

alter table public.knowledge_base_articles
  drop constraint if exists knowledge_base_articles_external_url_check;

alter table public.knowledge_base_articles
  add constraint knowledge_base_articles_external_url_check
  check (
    external_url is null
    or (
      length(trim(external_url)) > 0
      and length(external_url) <= 2000
      and external_url ~* '^https?://'
    )
  );

comment on column public.knowledge_base_articles.external_url is
  'Optional external http(s) URL for link materials. Null for normal articles.';
