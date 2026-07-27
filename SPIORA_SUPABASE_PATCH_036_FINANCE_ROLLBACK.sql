-- =============================================================================
-- SPIORA_SUPABASE_PATCH_036_FINANCE_ROLLBACK.sql
-- PRE-PRODUCTION ONLY. Destructive for finance tables / RPCs.
-- Refuses if any real profile/payment/history rows exist.
-- Does NOT touch clients / cases / questionnaires / non-finance audit.
-- Role note: user_profiles.role uses CHECK constraint (not enum). Removing
-- finance_manager is safe only when no rows use that role; otherwise refuse.
-- =============================================================================

do $$
declare
  profile_count bigint := 0;
  payment_count bigint := 0;
  history_count bigint := 0;
  finance_manager_users bigint := 0;
begin
  if to_regclass('public.client_finance_profiles') is not null then
    execute 'select count(*) from public.client_finance_profiles' into profile_count;
  end if;
  if to_regclass('public.client_finance_payments') is not null then
    execute 'select count(*) from public.client_finance_payments' into payment_count;
  end if;
  if to_regclass('public.client_finance_contract_changes') is not null then
    execute 'select count(*) from public.client_finance_contract_changes' into history_count;
  end if;

  if profile_count > 0 or payment_count > 0 or history_count > 0 then
    raise exception
      'REFUSING ROLLBACK: finance data present (profiles=%, payments=%, history=%). Manual cleanup required.',
      profile_count, payment_count, history_count;
  end if;

  select count(*) into finance_manager_users
  from public.user_profiles
  where role = 'finance_manager';

  if finance_manager_users > 0 then
    raise exception
      'REFUSING ROLLBACK: % user_profiles still have role=finance_manager. Reassign first.',
      finance_manager_users;
  end if;
end $$;

drop trigger if exists client_finance_contract_changes_no_update
  on public.client_finance_contract_changes;
drop trigger if exists client_finance_contract_changes_no_delete
  on public.client_finance_contract_changes;
drop trigger if exists client_finance_profiles_no_delete
  on public.client_finance_profiles;
drop trigger if exists client_finance_payments_no_delete
  on public.client_finance_payments;

drop function if exists public.spiora_block_finance_history_mutation();
drop function if exists public.spiora_block_finance_hard_delete();

drop function if exists public.spiora_finance_void_payment(uuid, uuid, text, text, text);
drop function if exists public.spiora_finance_create_payment(uuid, bigint, date, text, text, text, text);
drop function if exists public.spiora_finance_change_contract(uuid, bigint, date, text, int, text, text);
drop function if exists public.spiora_finance_create_contract(uuid, bigint, date, text, text);
drop function if exists public.spiora_finance_analytics(int, int, text);
drop function if exists public.spiora_finance_dashboard_summary();
drop function if exists public.is_spiora_finance_staff();

drop table if exists public.client_finance_contract_changes;
drop table if exists public.client_finance_payments;
drop table if exists public.client_finance_profiles;

-- Restore prior role check without finance_manager (pre-036). Safe only after
-- finance_manager user count guard above. Not an enum — no enum rollback hazard.
alter table public.user_profiles
  drop constraint if exists user_profiles_role_check;

alter table public.user_profiles
  add constraint user_profiles_role_check
  check (role in ('owner', 'manager', 'consultant', 'viewer'));
