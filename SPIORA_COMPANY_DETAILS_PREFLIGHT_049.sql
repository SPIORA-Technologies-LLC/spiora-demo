-- =============================================================================
-- SPIORA_COMPANY_DETAILS_PREFLIGHT_049.sql
-- Read-only preflight for Company Details migration 049 (PR #34).
-- Result: READY_TO_APPLY / ALREADY_APPLIED / NOT_READY
--
-- IMPORTANT: never statically reference company_details tables/RPCs that may be absent.
-- =============================================================================

drop function if exists pg_temp.spiora_company_details_preflight_049();

create function pg_temp.spiora_company_details_preflight_049()
returns table (
  verdict text,
  details text,
  has_rls_helpers boolean,
  company_details_tables_present int,
  company_details_rpc_count int
)
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_missing_prereq boolean := false;
  v_has_is_spiora_owner boolean := false;
  v_has_is_active_spiora_user boolean := false;
  v_has_current_spiora_role boolean := false;
  v_tables_present int := 0;
  v_rpc_count int := 0;
  v_reasons text[] := array[]::text[];
  v_verdict text;
  v_details text;
begin
  select exists (
    select 1 from information_schema.tables t
    where t.table_schema = 'public' and t.table_name = 'user_profiles'
  )
  into v_missing_prereq;
  v_missing_prereq := not coalesce(v_missing_prereq, false);
  if v_missing_prereq then
    v_reasons := array_append(v_reasons, 'missing_user_profiles');
  end if;

  select exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_spiora_owner'
  ),
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_active_spiora_user'
  ),
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'current_spiora_role'
  )
  into v_has_is_spiora_owner, v_has_is_active_spiora_user, v_has_current_spiora_role;

  if not v_has_is_spiora_owner then
    v_reasons := array_append(v_reasons, 'missing_is_spiora_owner');
  end if;
  if not v_has_is_active_spiora_user then
    v_reasons := array_append(v_reasons, 'missing_is_active_spiora_user');
  end if;
  if not v_has_current_spiora_role then
    v_reasons := array_append(v_reasons, 'missing_current_spiora_role');
  end if;

  if to_regclass('public.company_details') is not null then
    v_tables_present := v_tables_present + 1;
  end if;
  if to_regclass('public.company_details_changes') is not null then
    v_tables_present := v_tables_present + 1;
  end if;

  select count(*)::int into v_rpc_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('spiora_company_details_get', 'spiora_company_details_update');

  if v_tables_present = 2 and v_rpc_count >= 2 then
    v_verdict := 'ALREADY_APPLIED';
    v_details := 'company_details schema and RPCs present';
  elsif coalesce(array_length(v_reasons, 1), 0) > 0 then
    v_verdict := 'NOT_READY';
    v_details := array_to_string(v_reasons, ', ');
  else
    v_verdict := 'READY_TO_APPLY';
    v_details := 'prerequisites satisfied; company_details not yet applied';
  end if;

  return query
  select
    v_verdict,
    v_details,
    (v_has_is_spiora_owner and v_has_is_active_spiora_user and v_has_current_spiora_role),
    v_tables_present,
    v_rpc_count;
end;
$$;

select * from pg_temp.spiora_company_details_preflight_049();
