-- =============================================================================
-- SPIORA_CLIENT_CASES_VALIDATE_034.sql
-- Post-apply validation for PR #32.1.
-- Result: VALIDATED_OK / VALIDATION_FAILED
-- =============================================================================

with required_tables as (
  select unnest(array[
    'client_cases',
    'client_case_status_history',
    'client_case_comments',
    'client_case_activity',
    'client_case_documents'
  ]) as table_name
),
table_ok as (
  select bool_and(exists (
    select 1 from information_schema.tables t
    where t.table_schema = 'public' and t.table_name = rt.table_name
  )) as ok
  from required_tables rt
),
column_ok as (
  select
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'client_cases'
        and column_name = 'questionnaire_id'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'client_case_status_history'
        and column_name = 'client_visible_key'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'client_case_comments'
        and column_name = 'visibility'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'client_case_activity'
        and column_name = 'activity_type'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'client_questionnaires'
        and column_name = 'case_id'
    ) as ok
),
index_ok as (
  select
    exists (
      select 1 from pg_indexes
      where schemaname = 'public' and indexname = 'client_cases_questionnaire_uidx'
    )
    and exists (
      select 1 from pg_indexes
      where schemaname = 'public' and indexname = 'client_case_documents_path_uidx'
    ) as ok
),
rpc_ok as (
  select exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'spiora_submit_client_case'
  ) as ok
),
rls_ok as (
  select bool_and(c.relrowsecurity) as ok
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'client_cases',
      'client_case_status_history',
      'client_case_comments',
      'client_case_activity',
      'client_case_documents'
    )
),
orphan_cases as (
  select count(*) as cnt
  from public.client_cases c
  left join public.client_questionnaires q on q.id = c.questionnaire_id
  where q.id is null
),
duplicate_cases as (
  select count(*) as cnt
  from (
    select questionnaire_id
    from public.client_cases
    where archived_at is null
    group by questionnaire_id
    having count(*) > 1
  ) d
),
submitted_consistency as (
  select count(*) as cnt
  from public.client_cases c
  join public.client_questionnaires q on q.id = c.questionnaire_id
  where c.archived_at is null
    and q.status not in ('submitted', 'locked')
),
failures as (
  select case when not (select ok from table_ok) then 'missing_tables' end as reason
  union all select case when not (select ok from column_ok) then 'missing_columns' end
  union all select case when not (select ok from index_ok) then 'missing_indexes' end
  union all select case when not (select ok from rpc_ok) then 'missing_submit_rpc' end
  union all select case when not (select ok from rls_ok) then 'rls_not_enabled' end
  union all select case when (select cnt from orphan_cases) > 0 then 'orphan_cases' end
  union all select case when (select cnt from duplicate_cases) > 0 then 'duplicate_case_per_questionnaire' end
  union all select case when (select cnt from submitted_consistency) > 0 then 'submitted_questionnaire_inconsistency' end
)
select
  case
    when exists (select 1 from failures where reason is not null)
      then 'VALIDATION_FAILED'
    else 'VALIDATED_OK'
  end as result,
  coalesce(
    (select string_agg(reason, ', ' order by reason) from failures where reason is not null),
    ''
  ) as reasons;
