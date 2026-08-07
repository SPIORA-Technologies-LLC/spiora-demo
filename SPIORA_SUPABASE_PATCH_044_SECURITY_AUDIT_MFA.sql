-- SPIORA_SUPABASE_PATCH_044_SECURITY_AUDIT_MFA.sql
-- Extends security_audit_events.action for employee MFA (Phase C).
-- Apply AFTER 043. Does not enable audit by itself.
--
-- Enable with SPIORA_SECURITY_AUDIT_MFA=true
-- or umbrella SPIORA_SECURITY_AUDIT_AUTH=true.

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
    'google_oauth_failed',
    'mfa_enroll_started',
    'mfa_enroll_completed',
    'mfa_challenge_success',
    'mfa_challenge_failure',
    'mfa_disabled',
    'mfa_recovery_codes_generated',
    'mfa_recovery_used',
    'mfa_factor_removed'
  ));

comment on constraint security_audit_events_action_check on public.security_audit_events is
  'Phase A password + Phase B Google OAuth + Phase C employee MFA actions';
