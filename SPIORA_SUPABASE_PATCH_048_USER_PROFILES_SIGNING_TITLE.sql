-- =============================================================================
-- SPIORA PATCH 048 — Optional provider signing title
-- Apply either the Supabase migration or the corresponding manual patch.
-- Do not apply both.
-- Apply after 047 (or its patch). Re-run only adds the column if missing.
-- =============================================================================

alter table public.user_profiles
  add column if not exists signing_title text;

comment on column public.user_profiles.signing_title is
  'Optional explicit signing title for SPIORA Sign. Falls back to role label when empty.';
