-- =============================================================================
-- SPIORA_SUPABASE_PATCH_027_KNOWLEDGE_BASE_ATTACHMENTS_ROLLBACK.sql
-- PR #20 rollback. Destructive for attachments metadata + bucket objects.
-- Does NOT drop knowledge_base_articles / translations (026).
-- Do NOT auto-apply.
-- =============================================================================

drop trigger if exists knowledge_base_attachments_block_hard_delete
  on public.knowledge_base_attachments;

drop policy if exists rls_kb_attachments_select_owner on public.knowledge_base_attachments;
drop policy if exists rls_kb_attachments_select_published on public.knowledge_base_attachments;
drop policy if exists rls_kb_attachments_insert_owner on public.knowledge_base_attachments;
drop policy if exists rls_kb_attachments_update_owner on public.knowledge_base_attachments;

drop table if exists public.knowledge_base_attachments;

-- Remove Storage objects then bucket (manual review recommended in production)
delete from storage.objects where bucket_id = 'knowledge-base';
delete from storage.buckets where id = 'knowledge-base';
