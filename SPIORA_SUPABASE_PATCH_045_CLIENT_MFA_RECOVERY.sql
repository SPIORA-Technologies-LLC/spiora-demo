-- SPIORA_SUPABASE_PATCH_045_CLIENT_MFA_RECOVERY.sql
-- Phase D3: app-owned client MFA recovery codes + re-enroll flag (clients only).
-- Apply AFTER 044. Does NOT enable MFA — set SPIORA_MFA_CLIENT=true after Stage 1 smoke.
--
-- Recovery codes are hashed at rest (HMAC-SHA256 hex via SPIORA_MFA_RECOVERY_PEPPER
-- with domain prefix "client-mfa-recovery:" + normalized code).
-- Never store plaintext codes. TOTP secrets stay in Supabase Auth (not this table).
--
-- Employee table employee_mfa_recovery_codes is intentionally separate.

alter table public.client_portal_users
  add column if not exists mfa_reenroll_required boolean not null default false;

comment on column public.client_portal_users.mfa_reenroll_required is
  'Set true after client MFA recovery-at-login; cleared after successful TOTP re-enrollment.';

create table if not exists public.client_mfa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  code_hash text not null,
  created_at timestamptz not null default now(),
  used_at timestamptz null,
  used_ip_hash text null,
  constraint client_mfa_recovery_codes_code_hash_unique unique (code_hash)
);

create index if not exists client_mfa_recovery_codes_user_unused_idx
  on public.client_mfa_recovery_codes (auth_user_id)
  where used_at is null;

comment on table public.client_mfa_recovery_codes is
  'One-time MFA recovery codes for client portal users. Hashes only. service_role only.';

alter table public.client_mfa_recovery_codes enable row level security;

revoke all on table public.client_mfa_recovery_codes from anon, authenticated;
grant select, insert, update, delete on table public.client_mfa_recovery_codes to service_role;
