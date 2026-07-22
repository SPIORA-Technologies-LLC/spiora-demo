-- =============================================================================
-- SPIORA_SUPABASE_PATCH_034_CLIENT_CASES_ROLLBACK.sql
-- Pre-production rollback for PR #32.1 ONLY.
-- Guard: refuses when real case rows exist.
-- Does NOT touch PR #30/#31 questionnaire/invitation tables (except case_id column).
-- =============================================================================

do $$
declare
  v_case_count bigint := 0;
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'client_cases'
  ) then
    execute 'select count(*) from public.client_cases' into v_case_count;
  end if;

  if v_case_count > 0 then
    raise exception 'ROLLBACK_BLOCKED: client_cases has % row(s). Pre-production only.', v_case_count;
  end if;
end $$;

drop function if exists public.spiora_submit_client_case(uuid, uuid, uuid, integer, uuid, text, text, text, text, text, timestamptz, jsonb);
drop function if exists public.is_spiora_case_client_owner(uuid);
drop function if exists public.is_spiora_case_staff();

drop table if exists public.client_case_documents cascade;
drop table if exists public.client_case_activity cascade;
drop table if exists public.client_case_comments cascade;
drop table if exists public.client_case_status_history cascade;
drop table if exists public.client_cases cascade;

alter table public.client_questionnaires drop column if exists case_id;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'client_documents'
  ) then
    alter table public.client_documents drop column if exists case_id;
    alter table public.client_documents drop column if exists uploader_role;
  end if;
end $$;
