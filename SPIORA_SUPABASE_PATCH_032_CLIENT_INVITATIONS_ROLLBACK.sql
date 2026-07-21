-- =============================================================================
-- SPIORA_SUPABASE_PATCH_032_CLIENT_INVITATIONS_ROLLBACK.sql
-- Rolls back PR #30 Spiora Client Invitations.
-- Idempotent. Manual confirmation required. Do NOT auto-apply.
-- =============================================================================

drop policy if exists rls_client_portal_users_select_employee on public.client_portal_users;
drop policy if exists rls_client_portal_users_select_own on public.client_portal_users;
drop policy if exists rls_client_invitations_select_own_accepted on public.client_invitations;
drop policy if exists rls_client_invitations_update_employee on public.client_invitations;
drop policy if exists rls_client_invitations_insert_employee on public.client_invitations;
drop policy if exists rls_client_invitations_select_employee on public.client_invitations;

drop trigger if exists client_portal_users_block_hard_delete on public.client_portal_users;
drop trigger if exists client_invitations_block_hard_delete on public.client_invitations;
drop trigger if exists client_portal_users_touch_updated_at on public.client_portal_users;
drop trigger if exists client_invitations_touch_updated_at on public.client_invitations;

drop function if exists public.client_portal_users_touch_updated_at();
drop function if exists public.client_invitations_touch_updated_at();

drop table if exists public.client_portal_users;
drop table if exists public.client_invitations;
