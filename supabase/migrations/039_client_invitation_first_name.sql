-- =============================================================================
-- SPIORA migration 039 — client invitation first_name (staff table display)
-- Idempotent. Non-destructive. Do NOT auto-apply blindly on shared DBs.
-- Requires: 032 (client_invitations).
-- =============================================================================

alter table public.client_invitations
  add column if not exists first_name text;

alter table public.client_invitations
  drop constraint if exists client_invitations_first_name_len;

alter table public.client_invitations
  add constraint client_invitations_first_name_len
  check (first_name is null or (length(trim(first_name)) > 0 and length(first_name) <= 80));

comment on column public.client_invitations.first_name is
  'Optional client given name entered by staff when creating the invite; shown in the invitations table.';
