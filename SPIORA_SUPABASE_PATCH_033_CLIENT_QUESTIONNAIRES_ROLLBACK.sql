-- =============================================================================
-- SPIORA_SUPABASE_PATCH_033_CLIENT_QUESTIONNAIRES_ROLLBACK.sql
-- Rolls back PR #31 questionnaire engine. PRE-PRODUCTION ONLY.
-- Refuses rollback when questionnaire data already exists.
-- Does not touch PR #30 tables: client_invitations / client_portal_users.
-- =============================================================================

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'client_questionnaires'
  ) and exists (
    select 1 from public.client_questionnaires limit 1
  ) then
    raise exception 'questionnaire_rollback_blocked_nonempty_data';
  end if;
end;
$$;

drop policy if exists rls_client_questionnaires_update_own on public.client_questionnaires;
drop policy if exists rls_client_questionnaires_insert_own on public.client_questionnaires;
drop policy if exists rls_client_questionnaires_select_own on public.client_questionnaires;
drop policy if exists rls_questionnaire_template_versions_select_published on public.questionnaire_template_versions;
drop policy if exists rls_questionnaire_templates_select_published on public.questionnaire_templates;

drop trigger if exists client_questionnaires_block_hard_delete on public.client_questionnaires;
drop trigger if exists questionnaire_template_versions_block_hard_delete on public.questionnaire_template_versions;
drop trigger if exists questionnaire_templates_block_hard_delete on public.questionnaire_templates;
drop trigger if exists questionnaire_template_versions_guard on public.questionnaire_template_versions;
drop trigger if exists client_questionnaires_touch_updated_at on public.client_questionnaires;
drop trigger if exists questionnaire_templates_touch_updated_at on public.questionnaire_templates;

drop function if exists public.questionnaire_template_versions_guard();
drop function if exists public.client_questionnaires_touch_updated_at();
drop function if exists public.questionnaire_templates_touch_updated_at();

drop table if exists public.client_questionnaires;
drop table if exists public.questionnaire_template_versions;
drop table if exists public.questionnaire_templates;

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'questionnaire_templates',
    'questionnaire_template_versions',
    'client_questionnaires'
  )
order by table_name;
