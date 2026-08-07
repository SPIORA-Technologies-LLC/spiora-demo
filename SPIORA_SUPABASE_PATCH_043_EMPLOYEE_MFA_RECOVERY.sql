-- SPIORA_SUPABASE_PATCH_043_EMPLOYEE_MFA_RECOVERY.sql
-- Phase C: app-owned MFA recovery codes + re-enroll flag (employees only).
-- Apply AFTER 042. Does NOT enable MFA — set SPIORA_MFA_EMPLOYEE=true after smoke.
--
-- Recovery codes are hashed at rest (HMAC-SHA256 hex via SPIORA_MFA_RECOVERY_PEPPER).
-- Never store plaintext codes. TOTP secrets stay in Supabase Auth (not this table).
--
-- Pending enrollment policy (app): replace/cleanup unverified factors before new enroll;
-- max one verified TOTP factor (enforced in app, not DB).

alter table public.user_profiles
  add column if not exists mfa_reenroll_required boolean not null default false;

comment on column public.user_profiles.mfa_reenroll_required is
  'Set true after MFA recovery-at-login; cleared after successful TOTP re-enrollment.';

create table if not exists public.employee_mfa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  code_hash text not null,
  created_at timestamptz not null default now(),
  used_at timestamptz null,
  used_ip_hash text null,
  constraint employee_mfa_recovery_codes_code_hash_unique unique (code_hash)
);

create index if not exists employee_mfa_recovery_codes_user_unused_idx
  on public.employee_mfa_recovery_codes (auth_user_id)
  where used_at is null;

comment on table public.employee_mfa_recovery_codes is
  'One-time MFA recovery codes for employees. Hashes only. service_role only.';

alter table public.employee_mfa_recovery_codes enable row level security;

revoke all on table public.employee_mfa_recovery_codes from anon, authenticated;
grant select, insert, update, delete on table public.employee_mfa_recovery_codes to service_role;
