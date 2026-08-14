-- =============================================================================
-- SPIORA migration 046 — Client consulting agreements
-- Idempotent. Same as SPIORA_SUPABASE_PATCH_046_CLIENT_CONSULTING_AGREEMENTS.sql
-- =============================================================================

create table if not exists public.client_consulting_agreements (
  id uuid primary key default gen_random_uuid(),
  questionnaire_id uuid not null unique
    references public.client_questionnaires (id) on delete cascade,
  case_id uuid references public.client_cases (id) on delete set null,
  portal_user_id uuid not null
    references public.client_portal_users (id) on delete restrict,
  locale text not null,
  agreement_number text not null,
  agreement_date date not null,
  party jsonb not null default '{}'::jsonb,
  client_accepted_at timestamptz,
  employee_accepted_at timestamptz,
  employee_user_id uuid references public.user_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_consulting_agreements_locale_check
    check (locale in ('en', 'ru')),
  constraint client_consulting_agreements_number_len
    check (length(trim(agreement_number)) > 0 and length(agreement_number) <= 40)
);

create index if not exists client_consulting_agreements_portal_idx
  on public.client_consulting_agreements (portal_user_id, updated_at desc);
create index if not exists client_consulting_agreements_case_idx
  on public.client_consulting_agreements (case_id)
  where case_id is not null;

comment on table public.client_consulting_agreements is
  'Frozen consulting-agreement snapshot from questionnaire submit; client and employee confirmation timestamps.';

alter table public.client_consulting_agreements enable row level security;

revoke all on table public.client_consulting_agreements from anon, authenticated;
grant select, insert, update, delete on table public.client_consulting_agreements to service_role;
