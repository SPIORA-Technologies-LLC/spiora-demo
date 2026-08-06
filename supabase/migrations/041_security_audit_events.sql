-- Parity with SPIORA_SUPABASE_PATCH_041_SECURITY_AUDIT_EVENTS.sql
-- Retention: 180 days (ops). email_hash = HMAC-SHA256 pepper over normalized email.

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
