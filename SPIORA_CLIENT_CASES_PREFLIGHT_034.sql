-- =============================================================================
-- SPIORA_CLIENT_CASES_PREFLIGHT_034.sql
-- Read-only preflight for PR #32.1 case apply.
-- Result: READY_TO_APPLY / ALREADY_APPLIED / NOT_READY
-- =============================================================================

with required_tables as (
  select unnest(array[
    'client_invitations',
    'client_portal_users',
    'client_questionnaires',
    'questionnaire_templates',
    'user_profiles'
  ]) as table_name
),
table_checks as (
  select
    rt.table_name,
    exists (
      select 1 from information_schema.tables t
      where t.table_schema = 'public' and t.table_name = rt.table_name
    ) as present
  from required_tables rt
),
helper_checks as (
  select
    exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'spiora_block_hard_delete'
    ) as has_block_hard_delete,
    exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'is_spiora_owner'
    ) as has_is_spiora_owner,
    exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'is_spiora_manager'
    ) as has_is_spiora_manager
),
target_tables as (
  select unnest(array[
    'client_cases',
    'client_case_status_history',
    'client_case_comments',
    'client_case_activity',
    'client_case_documents'
  ]) as table_name
),
target_state as (
  select
    count(*) filter (
      where exists (
        select 1 from information_schema.tables t
        where t.table_schema = 'public' and t.table_name = tt.table_name
      )
    ) as existing_count
  from target_tables tt
),
rpc_check as (
  select exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'spiora_submit_client_case'
  ) as has_submit_rpc
),
bucket_check as (
  select exists (
    select 1 from storage.buckets where id = 'task-attachments'
  ) as has_task_attachments_bucket
),
reasons as (
  select case when exists (select 1 from table_checks where not present)
    then 'missing_pr30_or_pr31_tables' end as reason
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
    when (select existing_count from target_state) > 0
     and (select existing_count from target_state) < 5
    then 'partial_case_schema_present'
  end
  union all
  select case when not (select has_task_attachments_bucket from bucket_check)
    then 'missing_task_attachments_bucket'
  end
)
select
  case
    when (select existing_count from target_state) = 5
     and (select has_submit_rpc from rpc_check)
     and not exists (select 1 from reasons where reason is not null)
      then 'ALREADY_APPLIED'
    when exists (select 1 from reasons where reason is not null)
      then 'NOT_READY'
    else 'READY_TO_APPLY'
  end as result,
  coalesce(
    (select string_agg(reason, ', ' order by reason) from reasons where reason is not null),
    ''
  ) as reasons,
  (select existing_count from target_state) as target_tables_present,
  (select has_submit_rpc from rpc_check) as has_submit_rpc,
  (select has_task_attachments_bucket from bucket_check) as has_storage_bucket;
