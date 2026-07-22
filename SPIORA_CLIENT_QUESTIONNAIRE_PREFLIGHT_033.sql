-- =============================================================================
-- SPIORA_CLIENT_QUESTIONNAIRE_PREFLIGHT_033.sql
-- Read-only preflight for PR #31 questionnaire apply.
-- Result: READY_TO_APPLY / ALREADY_APPLIED / NOT_READY
-- =============================================================================
-- Expected schema_hash is the TypeScript deep-canonical literal.
-- SQL does not recompute hash from jsonb::text.

with required_tables as (
  select unnest(array['client_invitations', 'client_portal_users']) as table_name
),
table_checks as (
  select
    rt.table_name,
    exists (
      select 1
      from information_schema.tables t
      where t.table_schema = 'public'
        and t.table_name = rt.table_name
    ) as present
  from required_tables rt
),
helper_checks as (
  select
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'spiora_block_hard_delete'
    ) as has_block_hard_delete,
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'is_spiora_owner'
    ) as has_is_spiora_owner,
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'is_spiora_manager'
    ) as has_is_spiora_manager
),
target_tables as (
  select unnest(array[
    'questionnaire_templates',
    'questionnaire_template_versions',
    'client_questionnaires'
  ]) as table_name
),
target_state as (
  select
    count(*) filter (
      where exists (
        select 1
        from information_schema.tables t
        where t.table_schema = 'public'
          and t.table_name = tt.table_name
      )
    ) as existing_count
  from target_tables tt
),
hash_check as (
  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'questionnaire_template_versions'
  ) as version_table_exists
),
template_hash_conflict as (
  select
    case
      when not (select version_table_exists from hash_check) then false
      else exists (
        select 1
        from public.questionnaire_templates qt
        join public.questionnaire_template_versions qtv
          on qtv.template_id = qt.id
        where qt.template_key = 'general_client_onboarding'
          and qtv.version = 1
          and qtv.schema_hash <>
            '222a220a4f8ef5ddbdca34849ef57145208425060a9dfc12b5668132d40a24ac'
      )
    end as has_conflict
),
reasons as (
  select case when exists (select 1 from table_checks where not present)
    then 'missing_pr30_tables' end as reason
  union all
  select case when not (select has_block_hard_delete from helper_checks)
    then 'missing_spiora_block_hard_delete' end
  union all
  select case when not (select has_is_spiora_owner from helper_checks)
    then 'missing_is_spiora_owner' end
  union all
  select case when not (select has_is_spiora_manager from helper_checks)
    then 'missing_is_spiora_manager' end
  union all
  select case
    when (select existing_count from target_state) between 1 and 2
    then 'partial_questionnaire_schema_present'
  end
  union all
  select case
    when (select has_conflict from template_hash_conflict)
    then 'template_hash_conflict_general_client_onboarding_v1'
  end
),
status as (
  select
    case
      when (select existing_count from target_state) = 3
        and not exists (select 1 from reasons where reason is not null)
      then 'ALREADY_APPLIED'
      when exists (select 1 from reasons where reason is not null)
      then 'NOT_READY'
      else 'READY_TO_APPLY'
    end as result
)
select
  s.result as preflight_result,
  r.reason
from status s
left join reasons r on r.reason is not null
order by r.reason nulls first;
