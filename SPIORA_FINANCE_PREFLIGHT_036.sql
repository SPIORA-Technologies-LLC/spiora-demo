-- =============================================================================
-- SPIORA_FINANCE_PREFLIGHT_036.sql
-- Read-only preflight for Finance Module migration 036 (PR #33.1).
-- Result: READY_TO_APPLY / ALREADY_APPLIED / NOT_READY
-- =============================================================================

with required_tables as (
  select unnest(array['clients', 'user_profiles']) as table_name
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
clients_key as (
  select
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'clients' and column_name = 'id'
        and data_type = 'uuid'
    ) as has_uuid_pk,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'clients' and column_name = 'external_id'
    ) as has_external_id
),
role_repr as (
  select
    exists (
      select 1 from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' and t.typname = 'user_role'
    ) as has_role_enum,
    (
      select c.data_type
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'user_profiles'
        and c.column_name = 'role'
      limit 1
    ) as role_data_type,
    exists (
      select 1 from pg_constraint
      where conrelid = 'public.user_profiles'::regclass
        and conname = 'user_profiles_role_check'
    ) as has_role_check
),
helper_checks as (
  select
    exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'is_spiora_owner'
    ) as has_is_spiora_owner,
    exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'is_active_spiora_user'
    ) as has_is_active_spiora_user,
    exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'current_spiora_role'
    ) as has_current_spiora_role
),
target_tables as (
  select unnest(array[
    'client_finance_profiles',
    'client_finance_payments',
    'client_finance_contract_changes'
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
rpc_state as (
  select
    (select count(*) from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in (
        'spiora_finance_dashboard_summary',
        'spiora_finance_analytics',
        'spiora_finance_create_contract',
        'spiora_finance_change_contract',
        'spiora_finance_create_payment',
        'spiora_finance_void_payment',
        'is_spiora_finance_staff'
      )
    ) as rpc_count
),
partial_data as (
  select
    case
      when to_regclass('public.client_finance_profiles') is null then false
      else exists (select 1 from public.client_finance_profiles)
    end as has_profiles,
    case
      when to_regclass('public.client_finance_payments') is null then false
      else exists (select 1 from public.client_finance_payments)
    end as has_payments
),
dup_active as (
  select
    case
      when to_regclass('public.client_finance_profiles') is null then false
      else exists (
        select client_id
        from public.client_finance_profiles
        where archived_at is null
        group by client_id
        having count(*) > 1
      )
    end as has_dup
),
reasons as (
  select case when exists (select 1 from table_checks where not present)
    then 'missing_clients_or_user_profiles' end as reason
  union all
  select case when not (select has_uuid_pk from clients_key)
    then 'clients_id_not_uuid' end
  union all
  select case when not (select has_external_id from clients_key)
    then 'clients_missing_external_id' end
  union all
  select case when not (select has_is_spiora_owner from helper_checks)
    then 'missing_is_spiora_owner' end
  union all
  select case when not (select has_is_active_spiora_user from helper_checks)
    then 'missing_is_active_spiora_user' end
  union all
  select case when not (select has_current_spiora_role from helper_checks)
    then 'missing_current_spiora_role' end
  union all
  select case when (select has_role_enum from role_repr)
    then 'role_is_enum_unexpected_use_check_constraint_path' end
  union all
  select case
    when (select role_data_type from role_repr) is distinct from 'text'
     and (select role_data_type from role_repr) is distinct from 'character varying'
    then 'user_profiles_role_type_incompatible'
  end
  union all
  select case when (select has_dup from dup_active)
    then 'duplicate_active_finance_profiles' end
  union all
  select case
    when (select existing_count from target_state) between 1 and 2
    then 'partial_finance_tables'
  end
  union all
  select case
    when (select existing_count from target_state) = 3
     and (select rpc_count from rpc_state) < 7
    then 'partial_finance_rpcs'
  end
)
select
  case
    when (select existing_count from target_state) = 3
     and (select rpc_count from rpc_state) >= 7
     and not exists (select 1 from reasons where reason is not null)
      then 'ALREADY_APPLIED'
    when exists (select 1 from reasons where reason is not null)
      then 'NOT_READY'
    else 'READY_TO_APPLY'
  end as verdict,
  coalesce(
    (select string_agg(reason, ', ') from reasons where reason is not null),
    'ok'
  ) as details,
  (select role_data_type from role_repr) as role_column_type,
  (select has_role_check from role_repr) as has_role_check,
  (select existing_count from target_state) as finance_tables_present,
  (select rpc_count from rpc_state) as finance_rpc_count;
