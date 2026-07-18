-- =============================================================================
-- SPIORA_SUPABASE_PATCH_028_KNOWLEDGE_BASE_TABLES_ROLLBACK.sql
-- PR #21 rollback. Destructive for table metadata.
-- Does NOT drop knowledge_base_articles / attachments.
-- Do NOT auto-apply.
-- =============================================================================

drop trigger if exists knowledge_base_tables_block_hard_delete
  on public.knowledge_base_tables;
drop trigger if exists knowledge_base_tables_touch_updated_at
  on public.knowledge_base_tables;

drop policy if exists rls_kb_tables_select_owner on public.knowledge_base_tables;
drop policy if exists rls_kb_tables_select_published on public.knowledge_base_tables;
drop policy if exists rls_kb_tables_insert_owner on public.knowledge_base_tables;
drop policy if exists rls_kb_tables_update_owner on public.knowledge_base_tables;

drop table if exists public.knowledge_base_tables;

drop function if exists public.knowledge_base_tables_touch_updated_at();
