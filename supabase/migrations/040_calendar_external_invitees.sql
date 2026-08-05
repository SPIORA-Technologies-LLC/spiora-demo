-- Named external (non-CRM) invitees for video meetings.
-- They join via the shared guest link; this list is for organizer UI / share personalization.

alter table public.calendar_events
  add column if not exists external_invitees jsonb not null default '[]'::jsonb;

comment on column public.calendar_events.external_invitees is
  'JSON array of {name, email?} for non-CRM invitees. Join uses shared guest invite token.';
