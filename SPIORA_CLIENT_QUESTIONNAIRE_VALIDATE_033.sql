-- =============================================================================
-- SPIORA_CLIENT_QUESTIONNAIRE_VALIDATE_033.sql
-- Read-only validation for PR #31 questionnaire schema after apply.
-- Result: VALIDATED_OK / VALIDATION_FAILED
-- =============================================================================
-- Expected schema_hash is the TypeScript deep-canonical literal.
-- SQL does not recompute hash from jsonb::text.

with expected_tables as (
  select unnest(array[
    'questionnaire_templates',
    'questionnaire_template_versions',
    'client_questionnaires'
  ]) as table_name
),
missing_tables as (
  select et.table_name
  from expected_tables et
  where not exists (
    select 1
    from information_schema.tables t
    where t.table_schema = 'public'
      and t.table_name = et.table_name
  )
),
rls_checks as (
  select c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'questionnaire_templates',
      'questionnaire_template_versions',
      'client_questionnaires'
    )
    and not c.relrowsecurity
),
policy_checks as (
  select unnest(array[
    'rls_questionnaire_templates_select_published',
    'rls_questionnaire_template_versions_select_published',
    'rls_client_questionnaires_select_own',
    'rls_client_questionnaires_insert_own',
    'rls_client_questionnaires_update_own'
  ]) as policy_name
),
missing_policies as (
  select pc.policy_name
  from policy_checks pc
  where not exists (
    select 1
    from pg_policies p
    where p.schemaname = 'public'
      and p.policyname = pc.policy_name
  )
),
template_version_check as (
  select
    exists (
      select 1
      from public.questionnaire_templates qt
      join public.questionnaire_template_versions qtv
        on qtv.template_id = qt.id
      where qt.template_key = 'general_client_onboarding'
        and qt.status = 'published'
        and qtv.version = 1
        and qtv.status = 'published'
        and qtv.schema_hash =
          '222a220a4f8ef5ddbdca34849ef57145208425060a9dfc12b5668132d40a24ac'
        and qtv.schema ->> 'templateKey' = 'general_client_onboarding'
    ) as ok
),
orphans as (
  select count(*) as orphan_count
  from public.client_questionnaires cq
  left join public.client_portal_users cpu
    on cpu.id = cq.client_portal_user_id
  left join public.client_invitations ci
    on ci.id = cq.invitation_id
  left join public.questionnaire_template_versions qtv
    on qtv.id = cq.template_version_id
  where cpu.id is null
     or ci.id is null
     or qtv.id is null
),
duplicates as (
  select count(*) as duplicate_count
  from (
    select invitation_id
    from public.client_questionnaires
    where archived_at is null
    group by invitation_id
    having count(*) > 1
  ) d
),
problems as (
  select 'missing_table:' || table_name as detail from missing_tables
  union all
  select 'rls_disabled:' || relname from rls_checks
  union all
  select 'missing_policy:' || policy_name from missing_policies
  union all
  select 'schema_hash_or_template_mismatch'
  where not (select ok from template_version_check)
  union all
  select 'orphan_questionnaires'
  where (select orphan_count from orphans) > 0
  union all
  select 'duplicate_active_questionnaires'
  where (select duplicate_count from duplicates) > 0
),
summary as (
  select
    case
      when exists (select 1 from problems) then 'VALIDATION_FAILED'
      else 'VALIDATED_OK'
    end as validation_result
)
select
  s.validation_result,
  p.detail
from summary s
left join problems p on true
order by p.detail nulls first;
