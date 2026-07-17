-- =============================================================================
-- SPIORA_SUPABASE_PATCH_025_RLS_PHASE1.sql
-- PR #18 â€” RLS Phase 1: Identity-Aware Data Protection
-- Tables: user_profiles, clients, client_notes, client_documents
-- Idempotent. Non-destructive. No secrets. No seed changes. No Storage policies.
-- Do NOT auto-apply. Manual confirmation required before running on demo/prod.

-- =============================================================================
-- 1. Helper functions (SECURITY DEFINER, fixed search_path, STABLE)
--    Do not return email or full profile rows.
-- =============================================================================

create or replace function public.current_spiora_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.user_profiles
  where auth_user_id = auth.uid()
    and status = 'active'
    and archived_at is null
  limit 1;
$$;

create or replace function public.current_spiora_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.user_profiles
  where auth_user_id = auth.uid()
    and status = 'active'
    and archived_at is null
  limit 1;
$$;

create or replace function public.is_active_spiora_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles
    where auth_user_id = auth.uid()
      and status = 'active'
      and archived_at is null
  );
$$;

create or replace function public.is_spiora_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles
    where auth_user_id = auth.uid()
      and status = 'active'
      and archived_at is null
      and role = 'owner'
  );
$$;

create or replace function public.is_spiora_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles
    where auth_user_id = auth.uid()
      and status = 'active'
      and archived_at is null
      and role = 'manager'
  );
$$;

-- Safe status for health API (no policy names / IDs).
create or replace function public.spiora_rls_phase1_status()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  enabled_count integer;
begin
  select count(*)::integer into enabled_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname in (
      'user_profiles',
      'clients',
      'client_notes',
      'client_documents'
    )
    and c.relrowsecurity;

  if enabled_count = 4 then
    return 'enabled';
  elsif enabled_count = 0 then
    return 'disabled';
  else
    return 'warning';
  end if;
end;
$$;

revoke all on function public.current_spiora_profile_id() from public;
revoke all on function public.current_spiora_role() from public;
revoke all on function public.is_active_spiora_user() from public;
revoke all on function public.is_spiora_owner() from public;
revoke all on function public.is_spiora_manager() from public;
revoke all on function public.spiora_rls_phase1_status() from public;

grant execute on function public.current_spiora_profile_id() to authenticated, service_role;
grant execute on function public.current_spiora_role() to authenticated, service_role;
grant execute on function public.is_active_spiora_user() to authenticated, service_role;
grant execute on function public.is_spiora_owner() to authenticated, service_role;
grant execute on function public.is_spiora_manager() to authenticated, service_role;
grant execute on function public.spiora_rls_phase1_status() to authenticated, service_role;

-- =============================================================================
-- 2. Triggers â€” privilege escalation + last active owner
-- =============================================================================

create or replace function public.user_profiles_guard_sensitive_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  active_owners integer;
  actor_is_owner boolean;
begin
  actor_is_owner := public.is_spiora_owner();

  -- Non-owners (including self) cannot change privileged columns.
  if not actor_is_owner then
    if new.role is distinct from old.role
      or new.status is distinct from old.status
      or new.auth_user_id is distinct from old.auth_user_id
      or new.email is distinct from old.email
      or new.archived_at is distinct from old.archived_at
      or new.first_name is distinct from old.first_name
      or new.last_name is distinct from old.last_name
      or new.display_name is distinct from old.display_name
      or new.is_demo is distinct from old.is_demo
    then
      raise exception 'spiora_rls_phase1: privileged profile fields are owner-only'
        using errcode = '42501';
    end if;
  end if;

  -- Protect last active owner from demotion / suspend / archive.
  if old.role = 'owner'
    and old.status = 'active'
    and old.archived_at is null
    and (
      new.role is distinct from 'owner'
      or new.status is distinct from 'active'
      or new.archived_at is not null
    )
  then
    select count(*)::integer into active_owners
    from public.user_profiles
    where role = 'owner'
      and status = 'active'
      and archived_at is null
      and id is distinct from old.id;

    if active_owners < 1 then
      raise exception 'spiora_rls_phase1: cannot demote or archive the last active owner'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists user_profiles_guard_sensitive_update on public.user_profiles;
create trigger user_profiles_guard_sensitive_update
  before update on public.user_profiles
  for each row
  execute function public.user_profiles_guard_sensitive_update();

-- Block hard DELETE on CRM tables for authenticated / anon (defense in depth).
-- Service role still bypasses RLS; app must prefer archive.
create or replace function public.spiora_block_hard_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return old;
  end if;
  raise exception 'spiora_rls_phase1: hard delete denied; use archive'
    using errcode = '42501';
end;
$$;

drop trigger if exists clients_block_hard_delete on public.clients;
create trigger clients_block_hard_delete
  before delete on public.clients
  for each row
  execute function public.spiora_block_hard_delete();

drop trigger if exists client_notes_block_hard_delete on public.client_notes;
create trigger client_notes_block_hard_delete
  before delete on public.client_notes
  for each row
  execute function public.spiora_block_hard_delete();

drop trigger if exists client_documents_block_hard_delete on public.client_documents;
create trigger client_documents_block_hard_delete
  before delete on public.client_documents
  for each row
  execute function public.spiora_block_hard_delete();

drop trigger if exists user_profiles_block_hard_delete on public.user_profiles;
create trigger user_profiles_block_hard_delete
  before delete on public.user_profiles
  for each row
  execute function public.spiora_block_hard_delete();

-- =============================================================================
-- 3. Table privileges â€” no anon; authenticated via RLS only
-- =============================================================================

revoke all on table public.user_profiles from anon, public;
revoke all on table public.clients from anon, public;
revoke all on table public.client_notes from anon, public;
revoke all on table public.client_documents from anon, public;

grant select, insert, update on table public.user_profiles to authenticated;
grant select, insert, update on table public.clients to authenticated;
grant select, insert, update on table public.client_notes to authenticated;
grant select, insert, update on table public.client_documents to authenticated;

-- No DELETE grants for authenticated (archive via UPDATE).
revoke delete on table public.user_profiles from authenticated;
revoke delete on table public.clients from authenticated;
revoke delete on table public.client_notes from authenticated;
revoke delete on table public.client_documents from authenticated;

-- =============================================================================
-- 4. Enable RLS
-- =============================================================================

alter table public.user_profiles enable row level security;
alter table public.clients enable row level security;
alter table public.client_notes enable row level security;
alter table public.client_documents enable row level security;

-- Note: FORCE RLS is intentionally NOT set in Phase 1.
-- Helpers are SECURITY DEFINER; service_role retains BYPASSRLS for app repos.

-- =============================================================================
-- 5. Policies â€” user_profiles
-- =============================================================================

drop policy if exists rls_p1_user_profiles_select_self on public.user_profiles;
create policy rls_p1_user_profiles_select_self
  on public.user_profiles
  for select
  to authenticated
  using (
    auth_user_id = auth.uid()
    and public.is_active_spiora_user()
  );

drop policy if exists rls_p1_user_profiles_select_owner on public.user_profiles;
create policy rls_p1_user_profiles_select_owner
  on public.user_profiles
  for select
  to authenticated
  using (public.is_spiora_owner());

drop policy if exists rls_p1_user_profiles_select_manager on public.user_profiles;
create policy rls_p1_user_profiles_select_manager
  on public.user_profiles
  for select
  to authenticated
  using (
    public.is_spiora_manager()
    and status in ('active', 'invited')
    and archived_at is null
  );

drop policy if exists rls_p1_user_profiles_update_self on public.user_profiles;
create policy rls_p1_user_profiles_update_self
  on public.user_profiles
  for update
  to authenticated
  using (
    auth_user_id = auth.uid()
    and public.is_active_spiora_user()
  )
  with check (
    auth_user_id = auth.uid()
    and public.is_active_spiora_user()
  );

drop policy if exists rls_p1_user_profiles_update_owner on public.user_profiles;
create policy rls_p1_user_profiles_update_owner
  on public.user_profiles
  for update
  to authenticated
  using (public.is_spiora_owner())
  with check (public.is_spiora_owner());

-- INSERT / DELETE: no policies for authenticated (denied). Provisioning = service_role.

-- =============================================================================
-- 6. Policies â€” clients
-- Consultant/viewer: DENIED until assigned_user_id is reliably linked to user_profiles.id.
-- Do not use display-name assignee fields as a security boundary.
-- =============================================================================

drop policy if exists rls_p1_clients_select_owner_manager on public.clients;
create policy rls_p1_clients_select_owner_manager
  on public.clients
  for select
  to authenticated
  using (
    public.is_spiora_owner()
    or public.is_spiora_manager()
  );

drop policy if exists rls_p1_clients_insert_owner_manager on public.clients;
create policy rls_p1_clients_insert_owner_manager
  on public.clients
  for insert
  to authenticated
  with check (
    (public.is_spiora_owner() or public.is_spiora_manager())
    and archived_at is null
  );

drop policy if exists rls_p1_clients_update_owner on public.clients;
create policy rls_p1_clients_update_owner
  on public.clients
  for update
  to authenticated
  using (public.is_spiora_owner())
  with check (public.is_spiora_owner());

drop policy if exists rls_p1_clients_update_manager on public.clients;
create policy rls_p1_clients_update_manager
  on public.clients
  for update
  to authenticated
  using (
    public.is_spiora_manager()
    and archived_at is null
  )
  with check (
    public.is_spiora_manager()
    and archived_at is null
  );

-- No DELETE policy â†’ hard delete denied for authenticated.

-- =============================================================================
-- 7. Policies â€” client_notes (via client_uuid â†’ clients.id; never legacy client_id)
-- =============================================================================

drop policy if exists rls_p1_client_notes_select on public.client_notes;
create policy rls_p1_client_notes_select
  on public.client_notes
  for select
  to authenticated
  using (
    client_uuid is not null
    and exists (
      select 1
      from public.clients c
      where c.id = client_notes.client_uuid
    )
  );

drop policy if exists rls_p1_client_notes_insert on public.client_notes;
create policy rls_p1_client_notes_insert
  on public.client_notes
  for insert
  to authenticated
  with check (
    (public.is_spiora_owner() or public.is_spiora_manager())
    and client_uuid is not null
    and archived_at is null
    and exists (
      select 1
      from public.clients c
      where c.id = client_notes.client_uuid
    )
  );

drop policy if exists rls_p1_client_notes_update on public.client_notes;
create policy rls_p1_client_notes_update
  on public.client_notes
  for update
  to authenticated
  using (
    (public.is_spiora_owner() or public.is_spiora_manager())
    and client_uuid is not null
    and exists (
      select 1
      from public.clients c
      where c.id = client_notes.client_uuid
    )
  )
  with check (
    (public.is_spiora_owner() or public.is_spiora_manager())
    and client_uuid is not null
    and exists (
      select 1
      from public.clients c
      where c.id = client_notes.client_uuid
    )
  );

-- =============================================================================
-- 8. Policies â€” client_documents (via client_uuid; manager cannot archive)
-- =============================================================================

drop policy if exists rls_p1_client_documents_select on public.client_documents;
create policy rls_p1_client_documents_select
  on public.client_documents
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.clients c
      where c.id = client_documents.client_uuid
    )
  );

drop policy if exists rls_p1_client_documents_insert on public.client_documents;
create policy rls_p1_client_documents_insert
  on public.client_documents
  for insert
  to authenticated
  with check (
    (public.is_spiora_owner() or public.is_spiora_manager())
    and archived_at is null
    and exists (
      select 1
      from public.clients c
      where c.id = client_documents.client_uuid
    )
  );

drop policy if exists rls_p1_client_documents_update_owner on public.client_documents;
create policy rls_p1_client_documents_update_owner
  on public.client_documents
  for update
  to authenticated
  using (public.is_spiora_owner())
  with check (public.is_spiora_owner());

drop policy if exists rls_p1_client_documents_update_manager on public.client_documents;
create policy rls_p1_client_documents_update_manager
  on public.client_documents
  for update
  to authenticated
  using (
    public.is_spiora_manager()
    and archived_at is null
    and exists (
      select 1
      from public.clients c
      where c.id = client_documents.client_uuid
    )
  )
  with check (
    public.is_spiora_manager()
    and archived_at is null
    and exists (
      select 1
      from public.clients c
      where c.id = client_documents.client_uuid
    )
  );

comment on function public.spiora_rls_phase1_status() is
  'Returns enabled|disabled|warning for health. No policy names exposed.';

comment on table public.user_profiles is
  'Spiora application profiles linked to Supabase Auth. RLS Phase 1 enabled.';

-- PART B — VERIFICATION (read-only)
-- -----------------------------------------------------------------------------

select public.spiora_rls_phase1_status() as rls_status;
-- expect: enabled

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('user_profiles', 'clients', 'client_notes', 'client_documents')
order by 1;

select schemaname, tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('user_profiles', 'clients', 'client_notes', 'client_documents')
order by tablename, policyname;

-- Expect: no policies for anon role; no USING (true) catch-all in definitions.

