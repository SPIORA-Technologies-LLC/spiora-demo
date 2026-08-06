-- SPIORA_SUPABASE_PATCH_042_SECURITY_AUDIT_GOOGLE_OAUTH.sql
-- Extends security_audit_events.action for Google OAuth (Phase B).
-- Apply AFTER 041. Does not enable audit by itself.
--
-- Enable OAuth audit with SPIORA_SECURITY_AUDIT_OAUTH=true
-- or umbrella SPIORA_SECURITY_AUDIT_AUTH=true.
-- Phase A password audit remains SPIORA_SECURITY_AUDIT_PASSWORD=true
-- (AUTH=true enables both).

alter table public.security_audit_events
  drop constraint if exists security_audit_events_action_check;

alter table public.security_audit_events
  add constraint security_audit_events_action_check
  check (action in (
    'password_change_success',
    'password_change_failure',
    'password_reset_requested',
    'password_reset_completed',
    'password_reset_failed',
    'sessions_revoked',
    'google_oauth_started',
    'google_oauth_success',
    'google_oauth_denied',
    'google_oauth_failed'
  ));

comment on constraint security_audit_events_action_check on public.security_audit_events is
  'Phase A password actions + Phase B Google OAuth (four google_oauth_* events only)';
