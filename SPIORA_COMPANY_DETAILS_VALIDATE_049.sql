-- =============================================================================
-- SPIORA_COMPANY_DETAILS_VALIDATE_049.sql
-- Post-apply validation for Company Details migration 049 (PR #34).
-- Result: VALIDATED_OK / VALIDATION_FAILED
-- =============================================================================

with required as (
  select unnest(array['company_details', 'company_details_changes']) as table_name
),
tables_ok as (
  select bool_and(exists (
    select 1 from information_schema.tables t
    where t.table_schema = 'public' and t.table_name = r.table_name
  )) as ok
  from required r
),
rls_ok as (
  select bool_and(c.relrowsecurity) as ok
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('company_details', 'company_details_changes')
),
rpc_ok as (
  select count(*) >= 2 as ok
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('spiora_company_details_get', 'spiora_company_details_update')
),
seed_ok as (
  select exists (
    select 1 from public.company_details where singleton_key = 'active'
  ) as ok
),
verdict as (
  select case
    when (select ok from tables_ok)
      and (select ok from rls_ok)
      and (select ok from rpc_ok)
      and (select ok from seed_ok)
    then 'VALIDATED_OK'
    else 'VALIDATION_FAILED'
  end as verdict
)
select verdict, case verdict
  when 'VALIDATED_OK' then 'Company Details migration 049 validated'
  else 'Company Details migration 049 validation failed'
end as details
from verdict;
