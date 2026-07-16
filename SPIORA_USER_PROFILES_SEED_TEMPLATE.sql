-- =============================================================================
-- SPIORA_USER_PROFILES_SEED_TEMPLATE.sql
-- PR #17.1 — Fictional Northstar Mobility profiles (TEMPLATE ONLY)
--
-- DO NOT run this file as-is.
-- 1) Create Auth users in Supabase Dashboard (never INSERT into auth.users).
-- 2) Copy this file LOCALLY (outside Git staging if it will contain real UUIDs).
-- 3) Replace each <AUTH_USER_ID_*> placeholder with the Dashboard UUID.
-- 4) Run the edited LOCAL copy in SQL Editor.
--
-- No passwords. No real employee data. is_demo = true. status = active.
-- =============================================================================

-- REPLACE ALL PLACEHOLDERS BEFORE EXECUTE:
--   <AUTH_USER_ID_OLIVIA>
--   <AUTH_USER_ID_DANIEL>
--   <AUTH_USER_ID_EMMA>
--   <AUTH_USER_ID_LUCAS>
--
-- Example (do not commit real values):
--   '<AUTH_USER_ID_OLIVIA>'  →  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

insert into user_profiles (
  auth_user_id,
  email,
  first_name,
  last_name,
  display_name,
  avatar_url,
  role,
  status,
  language,
  timezone,
  last_login_at,
  archived_at,
  is_demo
) values
  (
    '<AUTH_USER_ID_OLIVIA>'::uuid,
    'olivia@spiora.demo',
    'Olivia',
    'Bennett',
    'Olivia Bennett',
    null,
    'owner',
    'active',
    'en',
    'Europe/Zagreb',
    null,
    null,
    true
  ),
  (
    '<AUTH_USER_ID_DANIEL>'::uuid,
    'daniel@spiora.demo',
    'Daniel',
    'Cooper',
    'Daniel Cooper',
    null,
    'manager',
    'active',
    'en',
    'Europe/Zagreb',
    null,
    null,
    true
  ),
  (
    '<AUTH_USER_ID_EMMA>'::uuid,
    'emma@spiora.demo',
    'Emma',
    'Wilson',
    'Emma Wilson',
    null,
    'manager',
    'active',
    'en',
    'Europe/Zagreb',
    null,
    null,
    true
  ),
  (
    '<AUTH_USER_ID_LUCAS>'::uuid,
    'lucas@spiora.demo',
    'Lucas',
    'Martin',
    'Lucas Martin',
    null,
    'manager',
    'active',
    'en',
    'Europe/Zagreb',
    null,
    null,
    true
  )
on conflict (auth_user_id) do update set
  email = excluded.email,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  display_name = excluded.display_name,
  avatar_url = excluded.avatar_url,
  role = excluded.role,
  status = excluded.status,
  language = excluded.language,
  timezone = excluded.timezone,
  archived_at = excluded.archived_at,
  is_demo = excluded.is_demo,
  updated_at = now();

-- Optional second pass if email already exists with same auth_user_id intent:
-- (safe re-run helper when auth_user_id was corrected for an existing demo email)
--
-- insert into user_profiles (
--   auth_user_id, email, first_name, last_name, display_name,
--   role, status, language, timezone, is_demo
-- ) values
--   ('<AUTH_USER_ID_OLIVIA>'::uuid, 'olivia@spiora.demo', 'Olivia', 'Bennett', 'Olivia Bennett', 'owner', 'active', 'en', 'Europe/Zagreb', true)
-- on conflict (email) do update set
--   auth_user_id = excluded.auth_user_id,
--   first_name = excluded.first_name,
--   last_name = excluded.last_name,
--   display_name = excluded.display_name,
--   role = excluded.role,
--   status = excluded.status,
--   language = excluded.language,
--   timezone = excluded.timezone,
--   is_demo = excluded.is_demo,
--   archived_at = null,
--   updated_at = now();

-- -----------------------------------------------------------------------------
-- Post-seed verification (read-only)
-- Expected after successful seed:
--   user_profiles_count = 4
--   active_owner_count = 1
--   profiles_without_auth = 0
--   demo_emails_without_profile = 0
-- -----------------------------------------------------------------------------

select count(*) as user_profiles_count from user_profiles;

select email, role, status, is_demo, auth_user_id
from user_profiles
order by email;

select count(*) as active_owner_count
from user_profiles
where role = 'owner' and status = 'active' and archived_at is null;

select p.email, p.auth_user_id
from user_profiles p
left join auth.users u on u.id = p.auth_user_id
where u.id is null;

select u.email, u.id as auth_user_id
from auth.users u
left join user_profiles p on p.auth_user_id = u.id
where lower(u.email) in (
  'olivia@spiora.demo',
  'daniel@spiora.demo',
  'emma@spiora.demo',
  'lucas@spiora.demo'
)
and p.id is null;
