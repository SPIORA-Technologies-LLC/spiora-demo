-- CRM clients — PostgreSQL primary store (Spiora Demo PR #13)
-- Idempotent, non-destructive. client_notes.client_id references external_id by convention.

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  external_id text not null,
  first_name text not null default '',
  last_name text not null default '',
  full_name text not null,
  email text not null default '',
  phone text not null default '',
  status text not null default 'New',
  pipeline_stage text not null default '',
  assigned_user_id text,
  assigned_manager_name text not null default '',
  country text not null default '',
  citizenship text not null default '',
  direction text not null default '',
  service_type text not null default '',
  source text not null default 'demo',
  notes_summary text not null default '',
  passport_number text,
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  is_demo boolean not null default true,
  legacy_fields jsonb not null default '{}'::jsonb
);

create unique index if not exists clients_external_id_uidx
  on clients (external_id);

create index if not exists clients_full_name_idx
  on clients (full_name);

create index if not exists clients_email_idx
  on clients (lower(email));

create index if not exists clients_status_idx
  on clients (status)
  where archived_at is null;

create index if not exists clients_pipeline_stage_idx
  on clients (pipeline_stage)
  where archived_at is null;

create index if not exists clients_assigned_manager_idx
  on clients (assigned_manager_name)
  where archived_at is null;

create index if not exists clients_country_idx
  on clients (country)
  where archived_at is null;

create index if not exists clients_direction_idx
  on clients (direction)
  where archived_at is null;

create index if not exists clients_service_type_idx
  on clients (service_type)
  where archived_at is null;

create index if not exists clients_active_updated_idx
  on clients (updated_at desc)
  where archived_at is null;

create index if not exists clients_is_demo_idx
  on clients (is_demo)
  where archived_at is null;

comment on table clients is
  'CRM clients. API exposes external_id as Client.id. client_notes.client_id uses external_id.';

comment on column clients.external_id is
  'Public client identifier, e.g. DEMO-1001. Unique across active and archived rows.';

comment on column clients.legacy_fields is
  'Optional Google Sheets-only fields (referentName, bookingAddress, etc.) as JSON.';
