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
  'True for fictional Northstar Mobility demo accounts only.';

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
-- Seed template (DO NOT run blindly)
-- Replace AUTH_USER_ID_* with real auth.users.id values from Dashboard/Admin API.
-- Passwords must NEVER appear in this file.
-- -----------------------------------------------------------------------------

-- insert into user_profiles (
--   auth_user_id, email, first_name, last_name, display_name, role, status, language, timezone, is_demo
-- ) values
--   ('AUTH_USER_ID_OLIVIA', 'olivia@spiora.demo', 'Olivia', 'Bennett', 'Olivia Bennett', 'owner', 'active', 'en', 'Europe/Zagreb', true),
--   ('AUTH_USER_ID_DANIEL', 'daniel@spiora.demo', 'Daniel', 'Cooper', 'Daniel Cooper', 'manager', 'active', 'en', 'Europe/Zagreb', true),
--   ('AUTH_USER_ID_EMMA', 'emma@spiora.demo', 'Emma', 'Wilson', 'Emma Wilson', 'manager', 'active', 'en', 'Europe/Zagreb', true),
--   ('AUTH_USER_ID_LUCAS', 'lucas@spiora.demo', 'Lucas', 'Martin', 'Lucas Martin', 'manager', 'active', 'en', 'Europe/Zagreb', true)
-- on conflict (email) do nothing;
