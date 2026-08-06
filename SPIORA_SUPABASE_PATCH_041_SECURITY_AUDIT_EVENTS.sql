-- SPIORA_SUPABASE_PATCH_041_SECURITY_AUDIT_EVENTS
-- Append-only auth security audit for password change/reset flows.
-- Apply in Supabase SQL Editor / migration runner BEFORE enabling
-- SPIORA_SECURITY_AUDIT_PASSWORD=true.
--
-- email_hash format: lowercase hex of HMAC-SHA256(SPIORA_AUDIT_HMAC_PEPPER, normalized_email)
-- truncated_client_ip: e.g. IPv4 /24 ("203.0.113.0/24") or IPv6 /48
-- ip_hash: HMAC-SHA256(pepper, raw_ip) hex — correlation without storing raw IP
-- Retention: delete rows with created_at < now() - interval '180 days' (ops job).

create table if not exists public.security_audit_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_user_id uuid null,
  target_user_id uuid null,
  action text not null
    check (action in (
      'password_change_success',
      'password_change_failure',
      'password_reset_requested',
      'password_reset_completed',
      'password_reset_failed',
      'sessions_revoked'
    )),
  audience text not null
    check (audience in ('employee', 'client', 'unknown')),
  truncated_client_ip text null,
  ip_hash text null,
  -- HMAC-SHA256 hex of normalized email; never store raw email
  email_hash text null,
  user_agent text null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists security_audit_events_created_at_idx
  on public.security_audit_events (created_at desc);

create index if not exists security_audit_events_action_idx
  on public.security_audit_events (action);

create index if not exists security_audit_events_email_hash_idx
  on public.security_audit_events (email_hash)
  where email_hash is not null;

comment on table public.security_audit_events is
  'Append-only auth security events. No passwords/tokens/cookies. Retention 180 days.';

comment on column public.security_audit_events.email_hash is
  'HMAC-SHA256(SPIORA_AUDIT_HMAC_PEPPER, lower(trim(email))) as lowercase hex';

alter table public.security_audit_events enable row level security;

revoke all on table public.security_audit_events from anon, authenticated;
grant insert, select on table public.security_audit_events to service_role;
