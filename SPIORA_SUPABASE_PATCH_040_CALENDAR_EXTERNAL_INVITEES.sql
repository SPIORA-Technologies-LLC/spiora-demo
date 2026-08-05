-- Manual apply patch for 040 — calendar_events.external_invitees
-- Same as supabase/migrations/040_calendar_external_invitees.sql

alter table public.calendar_events
  add column if not exists external_invitees jsonb not null default '[]'::jsonb;

comment on column public.calendar_events.external_invitees is
  'JSON array of {name, email?} for non-CRM invitees. Join uses shared guest invite token.';
