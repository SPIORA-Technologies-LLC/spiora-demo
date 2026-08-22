-- =============================================================================
-- SPIORA_SUPABASE_PATCH_049_COMPANY_DETAILS_ROLLBACK.sql
-- PRE-PRODUCTION ONLY. Destructive for company_details tables / RPCs.
-- =============================================================================

drop function if exists public.spiora_company_details_update(
  uuid, integer, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text
);
drop function if exists public.spiora_company_details_get();
drop function if exists public.is_spiora_company_details_manager();
drop function if exists public.is_spiora_company_details_viewer();
drop function if exists public.spiora_block_company_details_history_mutation();
drop function if exists public.spiora_block_company_details_hard_delete();

drop table if exists public.company_details_changes;
drop table if exists public.company_details;
