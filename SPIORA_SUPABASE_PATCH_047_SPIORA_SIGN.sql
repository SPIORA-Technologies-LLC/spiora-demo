-- =============================================================================
-- SPIORA PATCH 047 — SPIORA Sign
-- Apply either the Supabase migration or the corresponding manual patch.
-- Do not apply both.
-- SQL body matches supabase/migrations/047_spiora_sign.sql.
-- Re-run is additive and does not DROP constraints or rewrite existing indexes.
-- =============================================================================

create table if not exists public.consulting_sign_contracts (
  id uuid primary key default gen_random_uuid(),
  questionnaire_id uuid not null unique
    references public.client_questionnaires (id) on delete cascade,
  case_id uuid references public.client_cases (id) on delete set null,
  portal_user_id uuid not null
    references public.client_portal_users (id) on delete restrict,
  agreement_number text not null,
  active_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint consulting_sign_contracts_number_len
    check (length(trim(agreement_number)) > 0 and length(agreement_number) <= 40)
);

create table if not exists public.consulting_sign_versions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null
    references public.consulting_sign_contracts (id) on delete cascade,
  version_number integer not null,
  transaction_id text not null unique,
  status text not null,
  locale text not null,
  snapshot jsonb not null,
  content_fingerprint text not null,
  source_pdf_path text,
  source_pdf_hash text,
  final_pdf_path text,
  final_pdf_hash text,
  locked_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint consulting_sign_versions_number_positive
    check (version_number >= 1),
  constraint consulting_sign_versions_locale_check
    check (locale in ('en', 'ru')),
  constraint consulting_sign_versions_status_check
    check (status in (
      'draft',
      'awaiting_client_signature',
      'client_signed',
      'provider_signed',
      'completed',
      'expired',
      'cancelled',
      'superseded'
    )),
  constraint consulting_sign_versions_unique_number
    unique (contract_id, version_number)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'consulting_sign_contracts_active_version_fk'
  ) then
    alter table public.consulting_sign_contracts
      add constraint consulting_sign_contracts_active_version_fk
      foreign key (active_version_id)
      references public.consulting_sign_versions (id)
      on delete set null;
  end if;
end $$;

create table if not exists public.consulting_sign_requests (
  id uuid primary key default gen_random_uuid(),
  contract_version_id uuid not null
    references public.consulting_sign_versions (id) on delete cascade,
  signer_type text not null,
  signer_user_id text,
  signer_name text not null default '',
  signer_email text not null default '',
  signer_role text not null default '',
  signer_title text not null default '',
  signer_authority text not null default '',
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  signed_at timestamptz,
  signed_document_hash text,
  ip_address text,
  user_agent text,
  constraint consulting_sign_requests_type_check
    check (signer_type in ('client', 'provider')),
  constraint consulting_sign_requests_status_check
    check (status in ('pending', 'signed', 'cancelled')),
  constraint consulting_sign_requests_unique_type
    unique (contract_version_id, signer_type)
);

create table if not exists public.consulting_sign_otps (
  id uuid primary key default gen_random_uuid(),
  signature_request_id uuid not null
    references public.consulting_sign_requests (id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts_count integer not null default 0,
  max_attempts integer not null default 5,
  sent_at timestamptz not null default now(),
  verified_at timestamptz,
  consumed_at timestamptz,
  constraint consulting_sign_otps_attempts_nonneg
    check (attempts_count >= 0),
  constraint consulting_sign_otps_max_attempts_positive
    check (max_attempts > 0)
);

create table if not exists public.consulting_sign_events (
  id uuid primary key default gen_random_uuid(),
  contract_version_id uuid not null
    references public.consulting_sign_versions (id) on delete cascade,
  transaction_id text not null,
  event_type text not null,
  actor_user_id text,
  actor_type text not null,
  document_hash text,
  ip_address text,
  user_agent text,
  metadata_json jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  previous_event_hash text not null,
  event_hash text not null,
  constraint consulting_sign_events_actor_check
    check (actor_type in ('client', 'provider', 'system', 'admin'))
);

create index if not exists consulting_sign_contracts_portal_idx
  on public.consulting_sign_contracts (portal_user_id, updated_at desc);
create index if not exists consulting_sign_contracts_case_idx
  on public.consulting_sign_contracts (case_id)
  where case_id is not null;
create index if not exists consulting_sign_versions_contract_idx
  on public.consulting_sign_versions (contract_id, version_number desc);
create index if not exists consulting_sign_versions_status_idx
  on public.consulting_sign_versions (status);
create index if not exists consulting_sign_versions_tx_idx
  on public.consulting_sign_versions (transaction_id);
create index if not exists consulting_sign_requests_version_idx
  on public.consulting_sign_requests (contract_version_id);
create index if not exists consulting_sign_requests_signer_idx
  on public.consulting_sign_requests (signer_user_id);
create index if not exists consulting_sign_otps_request_idx
  on public.consulting_sign_otps (signature_request_id, sent_at desc);
create index if not exists consulting_sign_events_version_idx
  on public.consulting_sign_events (contract_version_id, occurred_at);
create index if not exists consulting_sign_events_tx_idx
  on public.consulting_sign_events (transaction_id, occurred_at);

comment on table public.consulting_sign_contracts is
  'SPIORA Sign envelope for a client questionnaire consulting agreement.';
comment on table public.consulting_sign_versions is
  'Immutable published versions of a consulting agreement, each with its own PDFs and signatures.';
comment on table public.consulting_sign_events is
  'Append-only signature audit trail with SHA-256 hash chain. Application must not UPDATE/DELETE.';

alter table public.consulting_sign_contracts enable row level security;
alter table public.consulting_sign_versions enable row level security;
alter table public.consulting_sign_requests enable row level security;
alter table public.consulting_sign_otps enable row level security;
alter table public.consulting_sign_events enable row level security;

revoke all on table public.consulting_sign_contracts from anon, authenticated;
revoke all on table public.consulting_sign_versions from anon, authenticated;
revoke all on table public.consulting_sign_requests from anon, authenticated;
revoke all on table public.consulting_sign_otps from anon, authenticated;
revoke all on table public.consulting_sign_events from anon, authenticated;

grant select, insert, update, delete on table public.consulting_sign_contracts to service_role;
grant select, insert, update, delete on table public.consulting_sign_versions to service_role;
grant select, insert, update, delete on table public.consulting_sign_requests to service_role;
grant select, insert, update, delete on table public.consulting_sign_otps to service_role;
grant select, insert on table public.consulting_sign_events to service_role;

-- Add missing columns/constraints only if absent. Do not DROP existing
-- constraints (a re-run must not weaken FKs/checks or rewrite indexes).
alter table public.consulting_sign_requests
  add column if not exists signer_title text not null default '';
alter table public.consulting_sign_requests
  add column if not exists signer_authority text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'consulting_sign_otps_attempts_nonneg'
  ) then
    alter table public.consulting_sign_otps
      add constraint consulting_sign_otps_attempts_nonneg
      check (attempts_count >= 0);
  end if;
  if not exists (
    select 1
    from pg_constraint
    where conname = 'consulting_sign_otps_max_attempts_positive'
  ) then
    alter table public.consulting_sign_otps
      add constraint consulting_sign_otps_max_attempts_positive
      check (max_attempts > 0);
  end if;
end $$;

-- Application retries on conflict; this unique index is the last line of defense
-- against two events sharing the same previous_event_hash (chain fork).
create unique index if not exists consulting_sign_events_prev_hash_uidx
  on public.consulting_sign_events (contract_version_id, previous_event_hash);
