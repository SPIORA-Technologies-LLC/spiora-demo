-- =============================================================================
-- SPIORA_SUPABASE_PATCH_025_RLS_ROLLBACK.sql
-- PR #18 — Rollback ONLY Phase 1 RLS policies/triggers/helpers
--
-- Use ONLY on blocking runtime regression after Phase 1 apply.
-- Does NOT delete tables, data, profiles, or Auth users.
-- Do NOT auto-run. Manual confirmation required.
-- =============================================================================

-- Policies
drop policy if exists rls_p1_user_profiles_select_self on public.user_profiles;
drop policy if exists rls_p1_user_profiles_select_owner on public.user_profiles;
drop policy if exists rls_p1_user_profiles_select_manager on public.user_profiles;
drop policy if exists rls_p1_user_profiles_update_self on public.user_profiles;
drop policy if exists rls_p1_user_profiles_update_owner on public.user_profiles;

drop policy if exists rls_p1_clients_select_owner_manager on public.clients;
drop policy if exists rls_p1_clients_insert_owner_manager on public.clients;
drop policy if exists rls_p1_clients_update_owner on public.clients;
drop policy if exists rls_p1_clients_update_manager on public.clients;

drop policy if exists rls_p1_client_notes_select on public.client_notes;
drop policy if exists rls_p1_client_notes_insert on public.client_notes;
drop policy if exists rls_p1_client_notes_update on public.client_notes;

drop policy if exists rls_p1_client_documents_select on public.client_documents;
drop policy if exists rls_p1_client_documents_insert on public.client_documents;
drop policy if exists rls_p1_client_documents_update_owner on public.client_documents;
drop policy if exists rls_p1_client_documents_update_manager on public.client_documents;

-- Triggers
drop trigger if exists user_profiles_guard_sensitive_update on public.user_profiles;
drop trigger if exists clients_block_hard_delete on public.clients;
drop trigger if exists client_notes_block_hard_delete on public.client_notes;
drop trigger if exists client_documents_block_hard_delete on public.client_documents;
drop trigger if exists user_profiles_block_hard_delete on public.user_profiles;

-- Disable RLS (tables and data remain)
alter table if exists public.user_profiles disable row level security;
alter table if exists public.clients disable row level security;
alter table if exists public.client_notes disable row level security;
alter table if exists public.client_documents disable row level security;

-- Helper / guard functions
drop function if exists public.user_profiles_guard_sensitive_update();
drop function if exists public.spiora_block_hard_delete();
drop function if exists public.spiora_rls_phase1_status();
drop function if exists public.current_spiora_profile_id();
drop function if exists public.current_spiora_role();
drop function if exists public.is_active_spiora_user();
drop function if exists public.is_spiora_owner();
drop function if exists public.is_spiora_manager();

-- Verification (read-only)
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('user_profiles', 'clients', 'client_notes', 'client_documents')
order by 1;
