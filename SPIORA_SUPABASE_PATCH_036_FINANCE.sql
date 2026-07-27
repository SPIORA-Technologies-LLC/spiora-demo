-- =============================================================================
-- SPIORA_SUPABASE_PATCH_036_FINANCE.sql
-- Functional parity with supabase/migrations/036_finance.sql (PR #33.1).
-- Do NOT auto-apply. Apply manually after preflight + backup.
-- =============================================================================
-- SPIORA migration 036 — Finance Module (PR #33 + #33.1 cutover)
-- Idempotent. Non-destructive. Do NOT auto-apply.
-- Requires: 022 clients, 024 user_profiles, 025 RLS helpers.
-- Actor ids are text (session user id) — compatible with legacy JWT + profile uuid.
-- Canonical client FK: clients.id (uuid). App resolves external_id → uuid.
-- =============================================================================

alter table public.user_profiles
  drop constraint if exists user_profiles_role_check;

alter table public.user_profiles
  add constraint user_profiles_role_check
  check (role in ('owner', 'manager', 'finance_manager', 'consultant', 'viewer'));

create or replace function public.is_spiora_finance_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_spiora_user()
    and public.current_spiora_role() in ('owner', 'finance_manager');
$$;

revoke all on function public.is_spiora_finance_staff() from public, anon;
grant execute on function public.is_spiora_finance_staff() to authenticated, service_role;

create table if not exists public.client_finance_profiles (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  currency_code text not null default 'EUR',
  contract_amount_cents bigint,
  contract_date date,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  archived_at timestamptz,
  constraint client_finance_profiles_currency_eur check (currency_code = 'EUR'),
  constraint client_finance_profiles_amount_positive
    check (contract_amount_cents is null or contract_amount_cents > 0),
  constraint client_finance_profiles_version_positive check (version >= 1)
);

-- PR #33.1: if older draft used uuid actor FKs, widen to text
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'client_finance_profiles'
      and column_name = 'created_by' and data_type = 'uuid'
  ) then
    alter table public.client_finance_profiles
      alter column created_by type text using created_by::text,
      alter column updated_by type text using updated_by::text;
  end if;
end $$;

create unique index if not exists client_finance_profiles_client_active_uidx
  on public.client_finance_profiles (client_id)
  where archived_at is null;

create index if not exists client_finance_profiles_contract_date_idx
  on public.client_finance_profiles (contract_date)
  where archived_at is null and contract_amount_cents is not null;

create table if not exists public.client_finance_payments (
  id uuid primary key default gen_random_uuid(),
  finance_profile_id uuid not null
    references public.client_finance_profiles (id) on delete restrict,
  client_id uuid not null references public.clients (id) on delete restrict,
  amount_cents bigint not null,
  currency_code text not null default 'EUR',
  payment_date date not null,
  comment text,
  created_by text not null,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by text,
  voided_by_name text,
  void_reason text,
  idempotency_key text,
  constraint client_finance_payments_amount_positive check (amount_cents > 0),
  constraint client_finance_payments_currency_eur check (currency_code = 'EUR'),
  constraint client_finance_payments_comment_len
    check (comment is null or length(comment) <= 500),
  constraint client_finance_payments_void_reason_len
    check (void_reason is null or length(void_reason) <= 1000)
);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'client_finance_payments'
      and column_name = 'created_by' and data_type = 'uuid'
  ) then
    alter table public.client_finance_payments
      alter column created_by type text using created_by::text;
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'client_finance_payments'
        and column_name = 'voided_by' and data_type = 'uuid'
    ) then
      alter table public.client_finance_payments
        alter column voided_by type text using voided_by::text;
    end if;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'client_finance_payments'
      and column_name = 'created_by_name'
  ) then
    alter table public.client_finance_payments
      add column created_by_name text not null default '';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'client_finance_payments'
      and column_name = 'voided_by_name'
  ) then
    alter table public.client_finance_payments
      add column voided_by_name text;
  end if;
end $$;

-- Idempotency: one active (non-voided) payment per key per profile
drop index if exists client_finance_payments_idempotency_uidx;
create unique index if not exists client_finance_payments_idempotency_active_uidx
  on public.client_finance_payments (finance_profile_id, idempotency_key)
  where idempotency_key is not null and voided_at is null;

create index if not exists client_finance_payments_profile_date_idx
  on public.client_finance_payments (finance_profile_id, payment_date desc);

create index if not exists client_finance_payments_client_date_idx
  on public.client_finance_payments (client_id, payment_date desc)
  where voided_at is null;

create table if not exists public.client_finance_contract_changes (
  id uuid primary key default gen_random_uuid(),
  finance_profile_id uuid not null
    references public.client_finance_profiles (id) on delete restrict,
  client_id uuid not null references public.clients (id) on delete restrict,
  change_type text not null,
  old_contract_amount_cents bigint,
  new_contract_amount_cents bigint,
  old_contract_date date,
  new_contract_date date,
  reason text not null,
  changed_by text not null,
  changed_by_name text not null default '',
  created_at timestamptz not null default now(),
  constraint client_finance_contract_changes_type_check
    check (change_type in (
      'contract_created', 'amount_changed', 'date_changed', 'contract_archived'
    )),
  constraint client_finance_contract_changes_reason_nonempty
    check (length(trim(reason)) > 0 and length(reason) <= 2000)
);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'client_finance_contract_changes'
      and column_name = 'changed_by' and data_type = 'uuid'
  ) then
    alter table public.client_finance_contract_changes
      alter column changed_by type text using changed_by::text;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'client_finance_contract_changes'
      and column_name = 'changed_by_name'
  ) then
    alter table public.client_finance_contract_changes
      add column changed_by_name text not null default '';
  end if;
end $$;

create index if not exists client_finance_contract_changes_profile_idx
  on public.client_finance_contract_changes (finance_profile_id, created_at desc);

create or replace function public.spiora_block_finance_history_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'client_finance_contract_changes is append-only';
end;
$$;

drop trigger if exists client_finance_contract_changes_no_update
  on public.client_finance_contract_changes;
create trigger client_finance_contract_changes_no_update
  before update on public.client_finance_contract_changes
  for each row execute function public.spiora_block_finance_history_mutation();

drop trigger if exists client_finance_contract_changes_no_delete
  on public.client_finance_contract_changes;
create trigger client_finance_contract_changes_no_delete
  before delete on public.client_finance_contract_changes
  for each row execute function public.spiora_block_finance_history_mutation();

create or replace function public.spiora_block_finance_hard_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'hard delete forbidden on finance tables; archive or void instead';
end;
$$;

drop trigger if exists client_finance_profiles_no_delete on public.client_finance_profiles;
create trigger client_finance_profiles_no_delete
  before delete on public.client_finance_profiles
  for each row execute function public.spiora_block_finance_hard_delete();

drop trigger if exists client_finance_payments_no_delete on public.client_finance_payments;
create trigger client_finance_payments_no_delete
  before delete on public.client_finance_payments
  for each row execute function public.spiora_block_finance_hard_delete();

-- ---------------------------------------------------------------------------
-- Dashboard summary (all-time, non-paginated)
-- ---------------------------------------------------------------------------
create or replace function public.spiora_finance_dashboard_summary()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with paid as (
    select finance_profile_id, coalesce(sum(amount_cents), 0)::bigint as paid_cents
    from public.client_finance_payments
    where voided_at is null
    group by finance_profile_id
  ),
  active_profiles as (
    select p.id, p.contract_amount_cents, coalesce(paid.paid_cents, 0)::bigint as paid_cents
    from public.client_finance_profiles p
    join public.clients c on c.id = p.client_id and c.archived_at is null
    left join paid on paid.finance_profile_id = p.id
    where p.archived_at is null
  )
  select jsonb_build_object(
    'totalContractsCents', coalesce((
      select sum(contract_amount_cents)::bigint from active_profiles
      where contract_amount_cents is not null
    ), 0),
    'totalReceivedCents', coalesce((
      select sum(paid_cents)::bigint from active_profiles
    ), 0),
    'totalDebtCents', coalesce((
      select sum(greatest(contract_amount_cents - paid_cents, 0))::bigint
      from active_profiles
      where contract_amount_cents is not null
    ), 0),
    'clientsWithDebt', coalesce((
      select count(*)::int
      from active_profiles
      where contract_amount_cents is not null
        and contract_amount_cents - paid_cents > 0
    ), 0)
  );
$$;

revoke all on function public.spiora_finance_dashboard_summary() from public, anon;
grant execute on function public.spiora_finance_dashboard_summary() to service_role;

-- ---------------------------------------------------------------------------
-- Analytics for year (+ optional month + direction)
-- Direction match: lower(trim(clients.direction)) in aliases for Spain/Croatia/Slovenia
-- ---------------------------------------------------------------------------
create or replace function public.spiora_finance_analytics(
  p_year int,
  p_month int default null,
  p_direction text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dir text := nullif(lower(trim(coalesce(p_direction, ''))), '');
  v_contracts bigint;
  v_received bigint;
  v_pay_count int;
  v_new_clients int;
  v_monthly jsonb;
begin
  if v_dir in ('all', '') then v_dir := null; end if;

  select coalesce(sum(p.contract_amount_cents), 0)::bigint into v_contracts
  from public.client_finance_profiles p
  join public.clients c on c.id = p.client_id and c.archived_at is null
  where p.archived_at is null
    and p.contract_amount_cents is not null
    and p.contract_date is not null
    and extract(year from p.contract_date)::int = p_year
    and (p_month is null or extract(month from p.contract_date)::int = p_month)
    and (
      v_dir is null
      or (
        case
          when v_dir in ('spain', 'испания') then lower(trim(c.direction)) in ('spain', 'испания')
          when v_dir in ('croatia', 'хорватия') then lower(trim(c.direction)) in ('croatia', 'хорватия')
          when v_dir in ('slovenia', 'словения') then lower(trim(c.direction)) in ('slovenia', 'словения')
          when v_dir = 'none' then nullif(trim(c.direction), '') is null or trim(c.direction) in ('—', '-')
          else lower(trim(c.direction)) = v_dir
        end
      )
    );

  select coalesce(sum(pay.amount_cents), 0)::bigint, count(*)::int
    into v_received, v_pay_count
  from public.client_finance_payments pay
  join public.clients c on c.id = pay.client_id and c.archived_at is null
  where pay.voided_at is null
    and extract(year from pay.payment_date)::int = p_year
    and (p_month is null or extract(month from pay.payment_date)::int = p_month)
    and (
      v_dir is null
      or (
        case
          when v_dir in ('spain', 'испания') then lower(trim(c.direction)) in ('spain', 'испания')
          when v_dir in ('croatia', 'хорватия') then lower(trim(c.direction)) in ('croatia', 'хорватия')
          when v_dir in ('slovenia', 'словения') then lower(trim(c.direction)) in ('slovenia', 'словения')
          when v_dir = 'none' then nullif(trim(c.direction), '') is null or trim(c.direction) in ('—', '-')
          else lower(trim(c.direction)) = v_dir
        end
      )
    );

  select count(*)::int into v_new_clients
  from public.clients c
  where c.archived_at is null
    and extract(year from c.created_at)::int = p_year
    and (p_month is null or extract(month from c.created_at)::int = p_month)
    and (
      v_dir is null
      or (
        case
          when v_dir in ('spain', 'испания') then lower(trim(c.direction)) in ('spain', 'испания')
          when v_dir in ('croatia', 'хорватия') then lower(trim(c.direction)) in ('croatia', 'хорватия')
          when v_dir in ('slovenia', 'словения') then lower(trim(c.direction)) in ('slovenia', 'словения')
          when v_dir = 'none' then nullif(trim(c.direction), '') is null or trim(c.direction) in ('—', '-')
          else lower(trim(c.direction)) = v_dir
        end
      )
    );

  select coalesce(jsonb_agg(row_data order by m), '[]'::jsonb) into v_monthly
  from (
    select
      m,
      jsonb_build_object(
        'month', m,
        'labelKey', 'm' || m::text,
        'receivedCents', coalesce((
          select sum(pay.amount_cents)::bigint
          from public.client_finance_payments pay
          join public.clients c on c.id = pay.client_id and c.archived_at is null
          where pay.voided_at is null
            and extract(year from pay.payment_date)::int = p_year
            and extract(month from pay.payment_date)::int = m
            and (
              v_dir is null
              or (
                case
                  when v_dir in ('spain', 'испания') then lower(trim(c.direction)) in ('spain', 'испания')
                  when v_dir in ('croatia', 'хорватия') then lower(trim(c.direction)) in ('croatia', 'хорватия')
                  when v_dir in ('slovenia', 'словения') then lower(trim(c.direction)) in ('slovenia', 'словения')
                  when v_dir = 'none' then nullif(trim(c.direction), '') is null or trim(c.direction) in ('—', '-')
                  else lower(trim(c.direction)) = v_dir
                end
              )
            )
        ), 0),
        'contractsSignedCents', coalesce((
          select sum(p.contract_amount_cents)::bigint
          from public.client_finance_profiles p
          join public.clients c on c.id = p.client_id and c.archived_at is null
          where p.archived_at is null
            and p.contract_amount_cents is not null
            and p.contract_date is not null
            and extract(year from p.contract_date)::int = p_year
            and extract(month from p.contract_date)::int = m
            and (
              v_dir is null
              or (
                case
                  when v_dir in ('spain', 'испания') then lower(trim(c.direction)) in ('spain', 'испания')
                  when v_dir in ('croatia', 'хорватия') then lower(trim(c.direction)) in ('croatia', 'хорватия')
                  when v_dir in ('slovenia', 'словения') then lower(trim(c.direction)) in ('slovenia', 'словения')
                  when v_dir = 'none' then nullif(trim(c.direction), '') is null or trim(c.direction) in ('—', '-')
                  else lower(trim(c.direction)) = v_dir
                end
              )
            )
        ), 0)
      ) as row_data
    from generate_series(1, 12) as m
  ) s;

  return jsonb_build_object(
    'contractsSignedCents', v_contracts,
    'newClientsCount', v_new_clients,
    'receivedCents', v_received,
    'paymentsCount', v_pay_count,
    'monthly', v_monthly
  );
end;
$$;

revoke all on function public.spiora_finance_analytics(int, int, text) from public, anon;
grant execute on function public.spiora_finance_analytics(int, int, text) to service_role;

-- ---------------------------------------------------------------------------
-- Mutation RPCs (service_role only).
-- TECHNICAL DEBT (PR #33.1 / follow-up): p_actor_id / p_actor_name are passed from
-- the trusted Next.js session layer because legacy employee JWT often has no
-- auth.uid() mapped to user_profiles. Ideal end-state:
--   1) app authenticates user;
--   2) server derives identity;
--   3) RPC resolves actor from auth.uid() / current_spiora user helpers;
--   4) reject or ignore client-supplied actor ids.
-- Until Spiora Auth maps every employee session to auth.uid(), app-layer RBAC
-- (canManageFinance) + service_role-only EXECUTE remain mandatory controls.
-- Tracked as: Finance RPC actor identity from auth.uid() (post–auth cutover).
-- ---------------------------------------------------------------------------
create or replace function public.spiora_finance_create_contract(
  p_client_id uuid,
  p_amount_cents bigint,
  p_contract_date date,
  p_actor_id text,
  p_actor_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'FINANCE_PAYMENT_AMOUNT_INVALID';
  end if;
  if p_contract_date is null then
    raise exception 'FINANCE_PAYMENT_DATE_INVALID';
  end if;
  if not exists (select 1 from public.clients c where c.id = p_client_id and c.archived_at is null) then
    raise exception 'FINANCE_CLIENT_NOT_FOUND';
  end if;
  if exists (
    select 1 from public.client_finance_profiles
    where client_id = p_client_id and archived_at is null and contract_amount_cents is not null
  ) then
    raise exception 'FINANCE_CONTRACT_ALREADY_EXISTS';
  end if;

  insert into public.client_finance_profiles (
    client_id, currency_code, contract_amount_cents, contract_date,
    version, created_by, updated_by
  ) values (
    p_client_id, 'EUR', p_amount_cents, p_contract_date,
    1, p_actor_id, p_actor_id
  )
  on conflict (client_id) where archived_at is null do nothing
  returning id into v_profile_id;

  -- handle unique active profile that exists without amount
  if v_profile_id is null then
    select id into v_profile_id
    from public.client_finance_profiles
    where client_id = p_client_id and archived_at is null
    for update;
    if v_profile_id is null then
      insert into public.client_finance_profiles (
        client_id, currency_code, contract_amount_cents, contract_date,
        version, created_by, updated_by
      ) values (
        p_client_id, 'EUR', p_amount_cents, p_contract_date,
        1, p_actor_id, p_actor_id
      ) returning id into v_profile_id;
    else
      if (select contract_amount_cents from public.client_finance_profiles where id = v_profile_id) is not null then
        raise exception 'FINANCE_CONTRACT_ALREADY_EXISTS';
      end if;
      update public.client_finance_profiles
      set contract_amount_cents = p_amount_cents,
          contract_date = p_contract_date,
          updated_by = p_actor_id,
          updated_at = now(),
          version = version + 1
      where id = v_profile_id;
    end if;
  end if;

  insert into public.client_finance_contract_changes (
    finance_profile_id, client_id, change_type,
    old_contract_amount_cents, new_contract_amount_cents,
    old_contract_date, new_contract_date,
    reason, changed_by, changed_by_name
  ) values (
    v_profile_id, p_client_id, 'contract_created',
    null, p_amount_cents,
    null, p_contract_date,
    'Initial contract setup', p_actor_id, coalesce(p_actor_name, '')
  );

  return v_profile_id;
end;
$$;

revoke all on function public.spiora_finance_create_contract(uuid, bigint, date, text, text) from public, anon;
grant execute on function public.spiora_finance_create_contract(uuid, bigint, date, text, text) to service_role;

create or replace function public.spiora_finance_change_contract(
  p_client_id uuid,
  p_amount_cents bigint,
  p_contract_date date,
  p_reason text,
  p_expected_version int,
  p_actor_id text,
  p_actor_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.client_finance_profiles%rowtype;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'FINANCE_CHANGE_REASON_REQUIRED';
  end if;

  select * into v_profile
  from public.client_finance_profiles
  where client_id = p_client_id and archived_at is null
  for update;

  if not found or v_profile.contract_amount_cents is null then
    raise exception 'FINANCE_CONTRACT_NOT_SET';
  end if;

  if p_expected_version is not null and v_profile.version <> p_expected_version then
    raise exception 'FINANCE_CONCURRENT_MODIFICATION';
  end if;

  if p_amount_cents is not null then
    if p_amount_cents <= 0 then
      raise exception 'FINANCE_PAYMENT_AMOUNT_INVALID';
    end if;
    if p_amount_cents = v_profile.contract_amount_cents and p_contract_date is null then
      raise exception 'FINANCE_AMOUNT_UNCHANGED';
    end if;
    if p_amount_cents <> v_profile.contract_amount_cents then
      insert into public.client_finance_contract_changes (
        finance_profile_id, client_id, change_type,
        old_contract_amount_cents, new_contract_amount_cents,
        old_contract_date, new_contract_date,
        reason, changed_by, changed_by_name
      ) values (
        v_profile.id, p_client_id, 'amount_changed',
        v_profile.contract_amount_cents, p_amount_cents,
        v_profile.contract_date, v_profile.contract_date,
        trim(p_reason), p_actor_id, coalesce(p_actor_name, '')
      );
      v_profile.contract_amount_cents := p_amount_cents;
    end if;
  end if;

  if p_contract_date is not null and p_contract_date is distinct from v_profile.contract_date then
    insert into public.client_finance_contract_changes (
      finance_profile_id, client_id, change_type,
      old_contract_amount_cents, new_contract_amount_cents,
      old_contract_date, new_contract_date,
      reason, changed_by, changed_by_name
    ) values (
      v_profile.id, p_client_id, 'date_changed',
      v_profile.contract_amount_cents, v_profile.contract_amount_cents,
      v_profile.contract_date, p_contract_date,
      trim(p_reason), p_actor_id, coalesce(p_actor_name, '')
    );
    v_profile.contract_date := p_contract_date;
  end if;

  update public.client_finance_profiles
  set contract_amount_cents = v_profile.contract_amount_cents,
      contract_date = v_profile.contract_date,
      updated_by = p_actor_id,
      updated_at = now(),
      version = version + 1
  where id = v_profile.id;

  return v_profile.id;
end;
$$;

revoke all on function public.spiora_finance_change_contract(uuid, bigint, date, text, int, text, text) from public, anon;
grant execute on function public.spiora_finance_change_contract(uuid, bigint, date, text, int, text, text) to service_role;

create or replace function public.spiora_finance_create_payment(
  p_client_id uuid,
  p_amount_cents bigint,
  p_payment_date date,
  p_comment text,
  p_idempotency_key text,
  p_actor_id text,
  p_actor_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_existing uuid;
  v_payment_id uuid;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'FINANCE_IDEMPOTENCY_REQUIRED';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'FINANCE_PAYMENT_AMOUNT_INVALID';
  end if;
  if p_payment_date is null then
    raise exception 'FINANCE_PAYMENT_DATE_INVALID';
  end if;

  select id into v_profile_id
  from public.client_finance_profiles
  where client_id = p_client_id and archived_at is null and contract_amount_cents is not null
  for update;

  if v_profile_id is null then
    raise exception 'FINANCE_CONTRACT_NOT_SET';
  end if;

  select id into v_existing
  from public.client_finance_payments
  where finance_profile_id = v_profile_id
    and idempotency_key = trim(p_idempotency_key)
    and voided_at is null
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.client_finance_payments (
    finance_profile_id, client_id, amount_cents, currency_code,
    payment_date, comment, created_by, created_by_name, idempotency_key
  ) values (
    v_profile_id, p_client_id, p_amount_cents, 'EUR',
    p_payment_date, nullif(trim(coalesce(p_comment, '')), ''),
    p_actor_id, coalesce(p_actor_name, ''), trim(p_idempotency_key)
  ) returning id into v_payment_id;

  update public.client_finance_profiles
  set updated_at = now(), updated_by = p_actor_id, version = version + 1
  where id = v_profile_id;

  return v_payment_id;
end;
$$;

revoke all on function public.spiora_finance_create_payment(uuid, bigint, date, text, text, text, text) from public, anon;
grant execute on function public.spiora_finance_create_payment(uuid, bigint, date, text, text, text, text) to service_role;

create or replace function public.spiora_finance_void_payment(
  p_client_id uuid,
  p_payment_id uuid,
  p_reason text,
  p_actor_id text,
  p_actor_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.client_finance_payments%rowtype;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'FINANCE_CHANGE_REASON_REQUIRED';
  end if;

  select * into v_payment
  from public.client_finance_payments
  where id = p_payment_id and client_id = p_client_id
  for update;

  if not found then
    raise exception 'FINANCE_PAYMENT_NOT_FOUND';
  end if;

  if v_payment.voided_at is not null then
    return v_payment.id;
  end if;

  update public.client_finance_payments
  set voided_at = now(),
      voided_by = p_actor_id,
      voided_by_name = coalesce(p_actor_name, ''),
      void_reason = trim(p_reason)
  where id = v_payment.id;

  update public.client_finance_profiles
  set updated_at = now(), updated_by = p_actor_id, version = version + 1
  where id = v_payment.finance_profile_id;

  return v_payment.id;
end;
$$;

revoke all on function public.spiora_finance_void_payment(uuid, uuid, text, text, text) from public, anon;
grant execute on function public.spiora_finance_void_payment(uuid, uuid, text, text, text) to service_role;

-- RLS
alter table public.client_finance_profiles enable row level security;
alter table public.client_finance_payments enable row level security;
alter table public.client_finance_contract_changes enable row level security;

drop policy if exists client_finance_profiles_select on public.client_finance_profiles;
create policy client_finance_profiles_select
  on public.client_finance_profiles for select to authenticated
  using (public.is_spiora_finance_staff());

drop policy if exists client_finance_profiles_insert on public.client_finance_profiles;
create policy client_finance_profiles_insert
  on public.client_finance_profiles for insert to authenticated
  with check (public.is_spiora_finance_staff());

drop policy if exists client_finance_profiles_update on public.client_finance_profiles;
create policy client_finance_profiles_update
  on public.client_finance_profiles for update to authenticated
  using (public.is_spiora_finance_staff())
  with check (public.is_spiora_finance_staff());

drop policy if exists client_finance_payments_select on public.client_finance_payments;
create policy client_finance_payments_select
  on public.client_finance_payments for select to authenticated
  using (public.is_spiora_finance_staff());

drop policy if exists client_finance_payments_insert on public.client_finance_payments;
create policy client_finance_payments_insert
  on public.client_finance_payments for insert to authenticated
  with check (public.is_spiora_finance_staff());

drop policy if exists client_finance_payments_update on public.client_finance_payments;
create policy client_finance_payments_update
  on public.client_finance_payments for update to authenticated
  using (public.is_spiora_finance_staff())
  with check (public.is_spiora_finance_staff());

drop policy if exists client_finance_contract_changes_select on public.client_finance_contract_changes;
create policy client_finance_contract_changes_select
  on public.client_finance_contract_changes for select to authenticated
  using (public.is_spiora_finance_staff());

drop policy if exists client_finance_contract_changes_insert on public.client_finance_contract_changes;
create policy client_finance_contract_changes_insert
  on public.client_finance_contract_changes for insert to authenticated
  with check (public.is_spiora_finance_staff());

revoke all on table public.client_finance_profiles from public, anon;
revoke all on table public.client_finance_payments from public, anon;
revoke all on table public.client_finance_contract_changes from public, anon;

grant select, insert, update on table public.client_finance_profiles to authenticated, service_role;
grant select, insert, update on table public.client_finance_payments to authenticated, service_role;
grant select, insert on table public.client_finance_contract_changes to authenticated, service_role;
