-- Rollback file-panel links table.
-- Do NOT auto-apply.

drop trigger if exists knowledge_base_links_block_hard_delete
  on public.knowledge_base_links;

drop policy if exists rls_kb_links_select_owner on public.knowledge_base_links;
drop policy if exists rls_kb_links_select_published on public.knowledge_base_links;
drop policy if exists rls_kb_links_insert_owner on public.knowledge_base_links;
drop policy if exists rls_kb_links_update_owner on public.knowledge_base_links;

drop table if exists public.knowledge_base_links;
