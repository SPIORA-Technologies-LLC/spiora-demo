-- =============================================================================
-- SPIORA migration 048 — Optional provider signing title
-- Minimal profile field for SPIORA Sign provider snapshot.
-- Apply either the Supabase migration or the corresponding manual patch.
-- Do not apply both.
-- Re-run only adds the column if it is missing; it does not rewrite data.
-- =============================================================================

alter table public.user_profiles
  add column if not exists signing_title text;

comment on column public.user_profiles.signing_title is
  'Optional explicit signing title for SPIORA Sign. Falls back to role label when empty.';
