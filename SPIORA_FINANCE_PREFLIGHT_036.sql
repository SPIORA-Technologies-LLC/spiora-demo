-- =============================================================================
-- SPIORA_FINANCE_PREFLIGHT_036.sql
-- Read-only preflight for Finance Module migration 036 (PR #33.1).
-- Result: READY_TO_APPLY / ALREADY_APPLIED / NOT_READY
--
-- IMPORTANT: never statically reference finance tables/RPCs that may be absent.
-- PostgreSQL resolves relations at parse time even inside CASE/to_regclass
-- branches. Row/duplicate checks use dynamic SQL (EXECUTE) only after
-- to_regclass confirms the relation exists.
-- =============================================================================

drop function if exists pg_temp.spiora_finance_preflight_036();

create function pg_temp.spiora_finance_preflight_036()
returns table (
  verdict text,
  details text,
  role_column_type text,
  has_role_check boolean,
  finance_tables_present int,
  finance_rpc_count int
)
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_missing_prereq boolean := false;
  v_has_uuid_pk boolean := false;
  v_has_external_id boolean := false;
  v_has_role_enum boolean := false;
  v_role_data_type text;
  v_has_role_check boolean := false;
  v_has_is_spiora_owner boolean := false;
  v_has_is_active_spiora_user boolean := false;
  v_has_current_spiora_role boolean := false;
  v_existing_count int := 0;
  v_rpc_count int := 0;
  v_has_dup boolean := false;
  v_reasons text[] := array[]::text[];
  v_verdict text;
  v_details text;
begin
  -- Prerequisite tables (must already exist — safe static refs)
  select exists (
    select 1 from information_schema.tables t
    where t.table_schema = 'public' and t.table_name = 'clients'
  )
  and exists (
    select 1 from information_schema.tables t
    where t.table_schema = 'public' and t.table_name = 'user_profiles'
  )
  into v_missing_prereq;
  v_missing_prereq := not coalesce(v_missing_prereq, false);
  if v_missing_prereq then
    v_reasons := array_append(v_reasons, 'missing_clients_or_user_profiles');
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients' and column_name = 'id'
      and data_type = 'uuid'
  ),
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients' and column_name = 'external_id'
  )
  into v_has_uuid_pk, v_has_external_id;

  if not v_has_uuid_pk then
    v_reasons := array_append(v_reasons, 'clients_id_not_uuid');
  end if;
  if not v_has_external_id then
    v_reasons := array_append(v_reasons, 'clients_missing_external_id');
  end if;

  select exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'user_role'
  )
  into v_has_role_enum;

  select c.data_type
  into v_role_data_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'user_profiles'
    and c.column_name = 'role'
  limit 1;

  select exists (
    select 1
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    join pg_namespace n on n.oid = cl.relnamespace
    where n.nspname = 'public'
      and cl.relname = 'user_profiles'
      and c.conname = 'user_profiles_role_check'
  )
  into v_has_role_check;

  select exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_spiora_owner'
  ),
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_active_spiora_user'
  ),
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
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
  if v_has_role_enum then
    v_reasons := array_append(
      v_reasons,
      'role_is_enum_unexpected_use_check_constraint_path'
    );
  end if;
  if v_role_data_type is distinct from 'text'
     and v_role_data_type is distinct from 'character varying' then
    v_reasons := array_append(v_reasons, 'user_profiles_role_type_incompatible');
  end if;

  -- Finance table presence via catalog only (no static FROM on finance tables)
  select count(*)::int
  into v_existing_count
  from unnest(array[
    'client_finance_profiles',
    'client_finance_payments',
    'client_finance_contract_changes'
  ]) as table_name
  where to_regclass(format('public.%I', table_name)) is not null;

  select count(*)::int
  into v_rpc_count
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
    );

  -- Duplicate active profiles: dynamic SQL only if relation exists
  if to_regclass('public.client_finance_profiles') is not null then
    execute $q$
      select exists (
        select client_id
        from public.client_finance_profiles
        where archived_at is null
        group by client_id
        having count(*) > 1
      )
    $q$
    into v_has_dup;
  else
    v_has_dup := false;
  end if;

  if v_has_dup then
    v_reasons := array_append(v_reasons, 'duplicate_active_finance_profiles');
  end if;
  if v_existing_count between 1 and 2 then
    v_reasons := array_append(v_reasons, 'partial_finance_tables');
  end if;
  if v_existing_count = 3 and v_rpc_count < 7 then
    v_reasons := array_append(v_reasons, 'partial_finance_rpcs');
  end if;
  -- Partial RPC install without tables (or tables without enough RPCs already covered)
  if v_existing_count = 0 and v_rpc_count > 0 and v_rpc_count < 7 then
    v_reasons := array_append(v_reasons, 'partial_finance_rpcs');
  end if;
  if v_existing_count = 0 and v_rpc_count = 7 then
    -- RPCs present but tables missing — incomplete apply
    v_reasons := array_append(v_reasons, 'partial_finance_tables');
  end if;

  if v_existing_count = 3
     and v_rpc_count >= 7
     and coalesce(cardinality(v_reasons), 0) = 0 then
    v_verdict := 'ALREADY_APPLIED';
  elsif coalesce(cardinality(v_reasons), 0) > 0 then
    v_verdict := 'NOT_READY';
  else
    v_verdict := 'READY_TO_APPLY';
  end if;

  if coalesce(cardinality(v_reasons), 0) = 0 then
    v_details := 'ok';
  else
    v_details := array_to_string(v_reasons, ', ');
  end if;

  verdict := v_verdict;
  details := v_details;
  role_column_type := v_role_data_type;
  has_role_check := v_has_role_check;
  finance_tables_present := v_existing_count;
  finance_rpc_count := v_rpc_count;
  return next;
end;
$$;

select * from pg_temp.spiora_finance_preflight_036();
