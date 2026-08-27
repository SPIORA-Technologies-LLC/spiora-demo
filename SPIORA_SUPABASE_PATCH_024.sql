-- =============================================================================
-- SPIORA_SUPABASE_PATCH_024.sql
-- PR #17.1 — Runtime preparation patch (migration 024 only)
--
-- Apply manually in Supabase SQL Editor.
-- Do NOT auto-apply. Do NOT include migrations 001–023 here.
-- No passwords. No auth.users inserts. No production employee data.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PART A — Migration 024 (idempotent)
-- Source: supabase/migrations/024_users_auth_profiles.sql
-- -----------------------------------------------------------------------------

-- PR #17 — Supabase Auth Phase 1: user_profiles + login rate limits
-- Idempotent. No passwords. No auth.users inserts. Fictional demo profiles only after Auth users exist.

-- -----------------------------------------------------------------------------
-- user_profiles
-- -----------------------------------------------------------------------------

create table if not exists user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null,
  email text unique not null,
  first_name text not null default '',
  last_name text not null default '',
  display_name text not null default '',
  avatar_url text,
  role text not null,
  status text not null default 'active',
  language text not null default 'en',
  timezone text not null default 'UTC',
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  is_demo boolean not null default true,
  constraint user_profiles_role_check
    check (role in ('owner', 'manager', 'consultant', 'viewer')),
  constraint user_profiles_status_check
    check (status in ('invited', 'active', 'suspended', 'archived')),
  constraint user_profiles_email_nonempty
    check (length(trim(email)) > 0),
  constraint user_profiles_display_name_nonempty
    check (length(trim(display_name)) > 0)
);

create unique index if not exists user_profiles_auth_user_id_uidx
  on user_profiles (auth_user_id);

create unique index if not exists user_profiles_email_lower_uidx
  on user_profiles (lower(email));

create index if not exists user_profiles_role_idx
  on user_profiles (role);

create index if not exists user_profiles_status_idx
  on user_profiles (status);

create index if not exists user_profiles_active_idx
  on user_profiles (status, archived_at)
  where archived_at is null and status = 'active';

comment on table user_profiles is
  'Spiora application profiles linked to Supabase Auth. No passwords stored here.';

comment on column user_profiles.auth_user_id is
  'References auth.users.id. Must be created via Supabase Auth Dashboard/Admin API, not SQL insert.';

comment on column user_profiles.is_demo is
  'True for fictional Spiora demo accounts only.';

-- -----------------------------------------------------------------------------
-- auth_login_rate_limits — persistent server-side limiter (Vercel-safe)
-- -----------------------------------------------------------------------------

create table if not exists auth_login_rate_limits (
  rate_key text primary key,
  window_start timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists auth_login_rate_limits_blocked_until_idx
  on auth_login_rate_limits (blocked_until)
  where blocked_until is not null;

comment on table auth_login_rate_limits is
  'Persistent login rate-limit counters. Never store passwords here.';

-- -----------------------------------------------------------------------------
-- PART B — Read-only verification queries (run after PART A)
-- Expected after fresh apply (before Auth users / profile seed):
--   user_profiles rows: 0
--   auth_login_rate_limits rows: 0
--   tables exist: true
-- -----------------------------------------------------------------------------

-- B1. Tables exist
select
  to_regclass('public.user_profiles') as user_profiles_regclass,
  to_regclass('public.auth_login_rate_limits') as auth_login_rate_limits_regclass;

-- B2. Row counts (should be 0 before seed)
select
  (select count(*) from user_profiles) as user_profiles_count,
  (select count(*) from auth_login_rate_limits) as auth_login_rate_limits_count;

-- B3. Constraints on user_profiles
select conname, contype, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.user_profiles'::regclass
order by conname;

-- B4. Indexes on user_profiles + auth_login_rate_limits
select
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('user_profiles', 'auth_login_rate_limits')
order by tablename, indexname;

-- B5. Columns of user_profiles
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'user_profiles'
order by ordinal_position;

-- B6. Auth users count (read-only; Dashboard users may already exist)
select count(*) as auth_users_count
from auth.users;

-- B7. Profiles without matching auth user
select p.id, p.email, p.auth_user_id, p.role, p.status
from user_profiles p
left join auth.users u on u.id = p.auth_user_id
where u.id is null;

-- B8. Auth users without profile (after seed should be empty for demo emails)
select u.id, u.email, u.created_at
from auth.users u
left join user_profiles p on p.auth_user_id = u.id
where p.id is null
order by u.created_at;

-- B9. Role / status distribution
select role, status, count(*) as cnt
from user_profiles
group by role, status
order by role, status;

-- B10. Duplicate emails (should be 0)
select lower(email) as email_norm, count(*) as cnt
from user_profiles
group by lower(email)
having count(*) > 1;

-- B11. Duplicate auth_user_id (should be 0)
select auth_user_id, count(*) as cnt
from user_profiles
group by auth_user_id
having count(*) > 1;

-- B12. Active owners count (after seed expected: 1)
select count(*) as active_owner_count
from user_profiles
where role = 'owner'
  and status = 'active'
  and archived_at is null;
