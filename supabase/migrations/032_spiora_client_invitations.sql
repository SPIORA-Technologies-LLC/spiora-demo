-- =============================================================================
-- SPIORA migration 032 — Spiora Client Invitations (PR #30)
-- Idempotent. Non-destructive. No secrets. Do NOT auto-apply.
-- Requires: 024 (user_profiles), 025 (RLS helpers / spiora_block_hard_delete).
-- Note: 029–031 are Knowledge Base patches; this is the next free number.
-- organization_id intentionally omitted (single-tenant demo); add later for multi-tenant.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. client_invitations
-- -----------------------------------------------------------------------------

create table if not exists public.client_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token_hash text not null,
  preferred_locale text not null default 'ru',
  service_type text,
  assigned_to uuid references public.user_profiles (id) on delete set null,
  questionnaire_template_key text,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  accepted_by_user_id uuid,
  created_by uuid not null references public.user_profiles (id) on delete restrict,
  create_request_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_invitations_email_nonempty
    check (length(trim(email)) > 0 and length(email) <= 320),
  constraint client_invitations_token_hash_nonempty
    check (length(token_hash) = 64),
  constraint client_invitations_locale_check
    check (preferred_locale in ('en', 'ru')),
  constraint client_invitations_expires_after_created
    check (expires_at > created_at),
  constraint client_invitations_accept_pair
    check (
      (accepted_at is null and accepted_by_user_id is null)
      or (accepted_at is not null and accepted_by_user_id is not null)
    ),
  constraint client_invitations_no_accept_and_revoke
    check (not (accepted_at is not null and revoked_at is not null))
);

create unique index if not exists client_invitations_token_hash_uidx
  on public.client_invitations (token_hash);

create index if not exists client_invitations_email_lower_idx
  on public.client_invitations (lower(email));

create index if not exists client_invitations_created_at_idx
  on public.client_invitations (created_at desc);

create index if not exists client_invitations_pending_idx
  on public.client_invitations (expires_at)
  where accepted_at is null and revoked_at is null;

create unique index if not exists client_invitations_create_request_uidx
  on public.client_invitations (created_by, create_request_id)
  where create_request_id is not null;

comment on table public.client_invitations is
  'Spiora Client one-time invite links. Store token_hash only; never plaintext tokens.';

comment on column public.client_invitations.token_hash is
  'SHA-256 hex of the invite token. Plaintext exists only in the create API response once.';

comment on column public.client_invitations.create_request_id is
  'Optional client request id for idempotent create (double-click protection).';

-- -----------------------------------------------------------------------------
-- 2. client_portal_users (portal identity — not CRM clients)
-- -----------------------------------------------------------------------------

create table if not exists public.client_portal_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null,
  email text not null,
  preferred_locale text not null default 'ru',
  invitation_id uuid not null unique
    references public.client_invitations (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_portal_users_email_nonempty
    check (length(trim(email)) > 0 and length(email) <= 320),
  constraint client_portal_users_locale_check
    check (preferred_locale in ('en', 'ru'))
);

create unique index if not exists client_portal_users_email_lower_uidx
  on public.client_portal_users (lower(email));

create index if not exists client_portal_users_auth_user_id_idx
  on public.client_portal_users (auth_user_id);

comment on table public.client_portal_users is
  'Spiora Client portal identity linked to auth.users. Not a CRM clients row.';

-- -----------------------------------------------------------------------------
-- 3. updated_at triggers
-- -----------------------------------------------------------------------------

create or replace function public.client_invitations_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists client_invitations_touch_updated_at
  on public.client_invitations;
create trigger client_invitations_touch_updated_at
  before update on public.client_invitations
  for each row
  execute function public.client_invitations_touch_updated_at();

create or replace function public.client_portal_users_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists client_portal_users_touch_updated_at
  on public.client_portal_users;
create trigger client_portal_users_touch_updated_at
  before update on public.client_portal_users
  for each row
  execute function public.client_portal_users_touch_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Hard-delete protection
-- -----------------------------------------------------------------------------

drop trigger if exists client_invitations_block_hard_delete
  on public.client_invitations;
create trigger client_invitations_block_hard_delete
  before delete on public.client_invitations
  for each row
  execute function public.spiora_block_hard_delete();

drop trigger if exists client_portal_users_block_hard_delete
  on public.client_portal_users;
create trigger client_portal_users_block_hard_delete
  before delete on public.client_portal_users
  for each row
  execute function public.spiora_block_hard_delete();

-- -----------------------------------------------------------------------------
-- 5. Grants + RLS
-- -----------------------------------------------------------------------------

revoke all on table public.client_invitations from anon, public;
revoke all on table public.client_portal_users from anon, public;

grant select, insert, update on table public.client_invitations to authenticated;
revoke delete on table public.client_invitations from authenticated;

grant select on table public.client_portal_users to authenticated;
revoke insert, update, delete on table public.client_portal_users from authenticated;

alter table public.client_invitations enable row level security;
alter table public.client_portal_users enable row level security;

-- Employees (owner/manager): full invite management
drop policy if exists rls_client_invitations_select_employee on public.client_invitations;
create policy rls_client_invitations_select_employee
  on public.client_invitations
  for select
  to authenticated
  using (public.is_spiora_owner() or public.is_spiora_manager());

drop policy if exists rls_client_invitations_insert_employee on public.client_invitations;
create policy rls_client_invitations_insert_employee
  on public.client_invitations
  for insert
  to authenticated
  with check (public.is_spiora_owner() or public.is_spiora_manager());

drop policy if exists rls_client_invitations_update_employee on public.client_invitations;
create policy rls_client_invitations_update_employee
  on public.client_invitations
  for update
  to authenticated
  using (public.is_spiora_owner() or public.is_spiora_manager())
  with check (public.is_spiora_owner() or public.is_spiora_manager());

-- Clients: may see own accepted invitation only (no token_hash needed in UI;
-- column still selected by PostgREST — app must never expose hash via DTO)
drop policy if exists rls_client_invitations_select_own_accepted on public.client_invitations;
create policy rls_client_invitations_select_own_accepted
  on public.client_invitations
  for select
  to authenticated
  using (
    accepted_by_user_id = auth.uid()
    and accepted_at is not null
  );

-- Portal users: client may SELECT own row only.
-- Inserts/updates go through Next.js service-role accept/create handlers (PR #30).
drop policy if exists rls_client_portal_users_select_own on public.client_portal_users;
create policy rls_client_portal_users_select_own
  on public.client_portal_users
  for select
  to authenticated
  using (auth_user_id = auth.uid());

-- Employees: read-only portal identities (Phase 1)
drop policy if exists rls_client_portal_users_select_employee on public.client_portal_users;
create policy rls_client_portal_users_select_employee
  on public.client_portal_users
  for select
  to authenticated
  using (public.is_spiora_owner() or public.is_spiora_manager());

-- Anonymous: no policies → denied
-- Token lookup must never use the anon/authenticated PostgREST client;
-- only server-side service role after hashing the presented token.
