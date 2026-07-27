-- =============================================================================
-- SPIORA_FINANCE_VALIDATE_036.sql
-- Post-apply validation for Finance Module migration 036 (PR #33.1).
-- Result: VALIDATED_OK / VALIDATION_FAILED
-- =============================================================================

with required as (
  select unnest(array[
    'client_finance_profiles',
    'client_finance_payments',
    'client_finance_contract_changes'
  ]) as table_name
),
tables_ok as (
  select bool_and(exists (
    select 1 from information_schema.tables t
    where t.table_schema = 'public' and t.table_name = r.table_name
  )) as ok
  from required r
),
profile_cols_ok as (
  select bool_and(exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'client_finance_profiles'
      and c.column_name = col
  )) as ok
  from unnest(array[
    'id','client_id','currency_code','contract_amount_cents','contract_date',
    'version','created_at','updated_at','created_by','updated_by','archived_at'
  ]) as col
),
payment_cols_ok as (
  select bool_and(exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'client_finance_payments'
      and c.column_name = col
  )) as ok
  from unnest(array[
    'id','finance_profile_id','client_id','amount_cents','currency_code',
    'payment_date','comment','created_by','created_by_name','created_at',
    'voided_at','voided_by','voided_by_name','void_reason','idempotency_key'
  ]) as col
),
cents_types_ok as (
  select
    (
      select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'client_finance_profiles'
        and column_name = 'contract_amount_cents'
    ) = 'bigint'
    and (
      select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'client_finance_payments'
        and column_name = 'amount_cents'
    ) = 'bigint' as ok
),
rls_ok as (
  select bool_and(c.relrowsecurity) as ok
  from required r
  join pg_class c on c.relname = r.table_name
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
),
helper_ok as (
  select exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_spiora_finance_staff'
  ) as ok
),
rpc_ok as (
  select (
    select count(*) from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'spiora_finance_dashboard_summary',
      'spiora_finance_analytics',
      'spiora_finance_create_contract',
      'spiora_finance_change_contract',
      'spiora_finance_create_payment',
      'spiora_finance_void_payment'
    )
  ) = 6 as ok
),
search_path_ok as (
  select bool_and(coalesce(p.proconfig, array[]::text[])::text like '%search_path%') as ok
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'spiora_finance_dashboard_summary',
      'spiora_finance_analytics',
      'spiora_finance_create_contract',
      'spiora_finance_change_contract',
      'spiora_finance_create_payment',
      'spiora_finance_void_payment',
      'is_spiora_finance_staff'
    )
),
indexes_ok as (
  select
    exists (
      select 1 from pg_indexes
      where schemaname = 'public'
        and indexname = 'client_finance_profiles_client_active_uidx'
    )
    and exists (
      select 1 from pg_indexes
      where schemaname = 'public'
        and indexname = 'client_finance_payments_idempotency_active_uidx'
    ) as ok
),
role_ok as (
  select exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_profiles'::regclass
      and conname = 'user_profiles_role_check'
      and pg_get_constraintdef(oid) like '%finance_manager%'
  ) as ok
),
currency_ok as (
  select not exists (
    select 1 from public.client_finance_profiles where currency_code <> 'EUR'
  )
  and not exists (
    select 1 from public.client_finance_payments where currency_code <> 'EUR'
  ) as ok
),
amount_ok as (
  select not exists (
    select 1 from public.client_finance_payments where amount_cents <= 0
  )
  and not exists (
    select 1 from public.client_finance_profiles
    where contract_amount_cents is not null and contract_amount_cents <= 0
  ) as ok
),
version_ok as (
  select not exists (
    select 1 from public.client_finance_profiles where version < 1
  ) as ok
),
dup_profiles as (
  select not exists (
    select client_id
    from public.client_finance_profiles
    where archived_at is null
    group by client_id
    having count(*) > 1
  ) as ok
),
orphan_payments as (
  select not exists (
    select 1
    from public.client_finance_payments p
    left join public.client_finance_profiles f on f.id = p.finance_profile_id
    where f.id is null
  ) as ok
),
summary_probe as (
  select
    (public.spiora_finance_dashboard_summary() ? 'totalContractsCents')
    and (public.spiora_finance_dashboard_summary() ? 'totalReceivedCents')
    and (public.spiora_finance_dashboard_summary() ? 'totalDebtCents')
    and (public.spiora_finance_dashboard_summary() ? 'clientsWithDebt') as ok
),
analytics_probe as (
  select
    (public.spiora_finance_analytics(extract(year from now())::int, null, null) ? 'monthly')
    and jsonb_array_length(
      public.spiora_finance_analytics(extract(year from now())::int, null, null)->'monthly'
    ) = 12 as ok
),
failures as (
  select 'tables' as check_name where not (select ok from tables_ok)
  union all select 'profile_cols' where not (select ok from profile_cols_ok)
  union all select 'payment_cols' where not (select ok from payment_cols_ok)
  union all select 'cents_types' where not (select ok from cents_types_ok)
  union all select 'rls' where not (select ok from rls_ok)
  union all select 'helper' where not (select ok from helper_ok)
  union all select 'rpcs' where not (select ok from rpc_ok)
  union all select 'search_path' where not (select ok from search_path_ok)
  union all select 'indexes' where not (select ok from indexes_ok)
  union all select 'role_check' where not (select ok from role_ok)
  union all select 'currency' where not (select ok from currency_ok)
  union all select 'amounts' where not (select ok from amount_ok)
  union all select 'version' where not (select ok from version_ok)
  union all select 'dup_profiles' where not (select ok from dup_profiles)
  union all select 'orphan_payments' where not (select ok from orphan_payments)
  union all select 'summary_rpc' where not (select ok from summary_probe)
  union all select 'analytics_rpc' where not (select ok from analytics_probe)
)
select
  case when not exists (select 1 from failures)
    then 'VALIDATED_OK'
    else 'VALIDATION_FAILED'
  end as verdict,
  coalesce((select string_agg(check_name, ', ') from failures), 'ok') as failed_checks;
