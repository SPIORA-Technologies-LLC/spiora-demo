-- Manual apply patch for 039 — client_invitations.first_name
-- Same as supabase/migrations/039_client_invitation_first_name.sql

alter table public.client_invitations
  add column if not exists first_name text;

alter table public.client_invitations
  drop constraint if exists client_invitations_first_name_len;

alter table public.client_invitations
  add constraint client_invitations_first_name_len
  check (first_name is null or (length(trim(first_name)) > 0 and length(first_name) <= 80));

comment on column public.client_invitations.first_name is
  'Optional client given name entered by staff when creating the invite; shown in the invitations table.';
