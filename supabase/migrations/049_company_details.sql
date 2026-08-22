-- =============================================================================
-- SPIORA migration 049 — Company Details (PR #34)
-- Idempotent. Non-destructive. Do NOT auto-apply.
-- Requires: 024 user_profiles, 025 RLS helpers.
-- Note: migration number 037 is already used by knowledge_base_scope.
-- =============================================================================

create table if not exists public.company_details (
  id uuid primary key default gen_random_uuid(),
  singleton_key text not null default 'active',
  company_name text not null,
  trading_name text not null default '',
  registration_number text not null default '',
  vat_number text not null default '',
  address_line_1 text not null default '',
  address_line_2 text not null default '',
  city text not null default '',
  postal_code text not null default '',
  country text not null,
  general_email text not null default '',
  finance_email text not null default '',
  phone text not null default '',
  website text not null default '',
  bank_account_holder text not null default '',
  bank_name text not null default '',
  iban text not null default '',
  swift_bic text not null default '',
  currency text not null default 'EUR',
  is_demo boolean not null default true,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.user_profiles(id) on delete set null,
  constraint company_details_singleton_key unique (singleton_key)
);

create table if not exists public.company_details_changes (
  id uuid primary key default gen_random_uuid(),
  company_details_id uuid not null references public.company_details(id) on delete restrict,
  changed_at timestamptz not null default now(),
  changed_by uuid references public.user_profiles(id) on delete set null,
  changed_fields text[] not null default '{}',
  previous_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb
);

create index if not exists company_details_changes_details_idx
  on public.company_details_changes (company_details_id, changed_at desc);

create or replace function public.is_spiora_company_details_viewer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_spiora_user()
    and public.current_spiora_role() in ('owner', 'finance_manager', 'manager');
$$;

create or replace function public.is_spiora_company_details_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_spiora_user()
    and public.current_spiora_role() in ('owner', 'finance_manager');
$$;

create or replace function public.spiora_block_company_details_history_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'company_details_changes is append-only';
end;
$$;

drop trigger if exists company_details_changes_no_update on public.company_details_changes;
create trigger company_details_changes_no_update
  before update on public.company_details_changes
  for each row execute function public.spiora_block_company_details_history_mutation();

drop trigger if exists company_details_changes_no_delete on public.company_details_changes;
create trigger company_details_changes_no_delete
  before delete on public.company_details_changes
  for each row execute function public.spiora_block_company_details_history_mutation();

create or replace function public.spiora_block_company_details_hard_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'hard delete forbidden on company_details';
end;
$$;

drop trigger if exists company_details_no_delete on public.company_details;
create trigger company_details_no_delete
  before delete on public.company_details
  for each row execute function public.spiora_block_company_details_hard_delete();

alter table public.company_details enable row level security;
alter table public.company_details_changes enable row level security;

drop policy if exists company_details_select on public.company_details;
create policy company_details_select
  on public.company_details for select to authenticated
  using (public.is_spiora_company_details_viewer());

drop policy if exists company_details_update on public.company_details;
create policy company_details_update
  on public.company_details for update to authenticated
  using (public.is_spiora_company_details_manager())
  with check (public.is_spiora_company_details_manager());

drop policy if exists company_details_insert on public.company_details;
create policy company_details_insert
  on public.company_details for insert to authenticated
  with check (public.is_spiora_company_details_manager());

drop policy if exists company_details_changes_select on public.company_details_changes;
create policy company_details_changes_select
  on public.company_details_changes for select to authenticated
  using (
    public.is_active_spiora_user()
    and public.current_spiora_role() in ('owner', 'finance_manager')
  );

create or replace function public.spiora_company_details_get()
returns public.company_details
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row public.company_details%rowtype;
begin
  select * into v_row
  from public.company_details
  where singleton_key = 'active'
  limit 1;

  if not found then
    raise exception 'COMPANY_DETAILS_NOT_FOUND';
  end if;

  return v_row;
end;
$$;

create or replace function public.spiora_company_details_update(
  p_actor_profile_id uuid,
  p_expected_version integer,
  p_company_name text,
  p_trading_name text,
  p_registration_number text,
  p_vat_number text,
  p_address_line_1 text,
  p_address_line_2 text,
  p_city text,
  p_postal_code text,
  p_country text,
  p_general_email text,
  p_finance_email text,
  p_phone text,
  p_website text,
  p_bank_account_holder text,
  p_bank_name text,
  p_iban text,
  p_swift_bic text,
  p_currency text
)
returns public.company_details
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.company_details%rowtype;
  v_after public.company_details%rowtype;
  v_changed text[] := array[]::text[];
  v_prev jsonb := '{}'::jsonb;
  v_new jsonb := '{}'::jsonb;
  v_key text;
begin
  select * into v_before
  from public.company_details
  where singleton_key = 'active'
  for update;

  if not found then
    raise exception 'COMPANY_DETAILS_NOT_FOUND';
  end if;

  if p_expected_version is null or v_before.version <> p_expected_version then
    raise exception 'COMPANY_DETAILS_VERSION_CONFLICT';
  end if;

  update public.company_details
  set
    company_name = coalesce(trim(p_company_name), ''),
    trading_name = coalesce(trim(p_trading_name), ''),
    registration_number = coalesce(trim(p_registration_number), ''),
    vat_number = coalesce(trim(p_vat_number), ''),
    address_line_1 = coalesce(trim(p_address_line_1), ''),
    address_line_2 = coalesce(trim(p_address_line_2), ''),
    city = coalesce(trim(p_city), ''),
    postal_code = coalesce(trim(p_postal_code), ''),
    country = coalesce(trim(p_country), ''),
    general_email = coalesce(trim(p_general_email), ''),
    finance_email = coalesce(trim(p_finance_email), ''),
    phone = coalesce(trim(p_phone), ''),
    website = coalesce(trim(p_website), ''),
    bank_account_holder = coalesce(trim(p_bank_account_holder), ''),
    bank_name = coalesce(trim(p_bank_name), ''),
    iban = coalesce(trim(p_iban), ''),
    swift_bic = coalesce(trim(p_swift_bic), ''),
    currency = coalesce(upper(trim(p_currency)), 'EUR'),
    version = v_before.version + 1,
    updated_at = now(),
    updated_by = p_actor_profile_id
  where id = v_before.id
  returning * into v_after;

  for v_key in
    select unnest(array[
      'company_name','trading_name','registration_number','vat_number',
      'address_line_1','address_line_2','city','postal_code','country',
      'general_email','finance_email','phone','website',
      'bank_account_holder','bank_name','iban','swift_bic','currency'
    ])
  loop
    if to_jsonb(v_before)->>v_key is distinct from to_jsonb(v_after)->>v_key then
      v_changed := array_append(v_changed, v_key);
      v_prev := v_prev || jsonb_build_object(v_key, to_jsonb(v_before)->>v_key);
      v_new := v_new || jsonb_build_object(v_key, to_jsonb(v_after)->>v_key);
    end if;
  end loop;

  if coalesce(array_length(v_changed, 1), 0) > 0 then
    insert into public.company_details_changes (
      company_details_id,
      changed_by,
      changed_fields,
      previous_values,
      new_values
    ) values (
      v_after.id,
      p_actor_profile_id,
      v_changed,
      v_prev,
      v_new
    );
  end if;

  return v_after;
end;
$$;

revoke all on function public.spiora_company_details_get() from public, anon;
revoke all on function public.spiora_company_details_update(
  uuid, integer, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.spiora_company_details_get() to service_role;
grant execute on function public.spiora_company_details_update(
  uuid, integer, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text
) to service_role;

insert into public.company_details (
  id,
  singleton_key,
  company_name,
  trading_name,
  registration_number,
  vat_number,
  address_line_1,
  address_line_2,
  city,
  postal_code,
  country,
  general_email,
  finance_email,
  phone,
  website,
  bank_account_holder,
  bank_name,
  iban,
  swift_bic,
  currency,
  is_demo
)
select
  '00000000-0000-4000-8000-000000000049'::uuid,
  'active',
  'SPIORA Technologies LLC',
  'SPIORA',
  'DEMO-2026-001',
  'EU-DEMO-260001',
  '42 Innovation Avenue',
  'Suite 210',
  'Lisbon',
  '1000-001',
  'Portugal',
  'demo@spiora.example',
  'finance@spiora.example',
  '+351 210 000 000',
  'https://spiora.demo',
  'SPIORA Technologies LLC',
  'SPIORA Demo Bank',
  'PT00 0000 0000 0000 0000 0000 0',
  'DEMOPT00',
  'EUR',
  true
where not exists (
  select 1 from public.company_details where singleton_key = 'active'
);
