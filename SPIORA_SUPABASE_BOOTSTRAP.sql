-- =============================================================================
-- SPIORA — Supabase Bootstrap (SQL Editor)
-- =============================================================================
-- Объединяет миграции 001–021 в порядке применения.
-- Без demo seed. Без секретов, URL и project ref.
-- Безопасен для пустой базы (IF NOT EXISTS / идемпотентные ALTER).
--
-- НЕ запускать повторно без проверки — см. SPIORA_SUPABASE_SQL_EDITOR_RUNBOOK.md
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 001_platform.sql
-- -----------------------------------------------------------------------------
-- Northstar Mobility demo — initial schema

create extension if not exists "pgcrypto";

create table if not exists tasks (
  id text primary key,
  title text not null,
  description text not null default '',
  status text not null check (status in ('new', 'in_progress', 'completed')),
  created_by_user_id text not null,
  created_by_name text not null,
  created_at timestamptz not null default now(),
  due_date date,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  assignees jsonb not null default '[]'::jsonb
);

create index if not exists tasks_updated_at_idx on tasks (updated_at desc);

create table if not exists team_chat_messages (
  id text primary key,
  user_id text not null,
  user_name text not null,
  user_role text not null,
  message_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists team_chat_messages_created_at_idx
  on team_chat_messages (created_at asc);

create table if not exists team_chat_last_seen (
  user_id text primary key,
  last_seen_at timestamptz not null default now()
);

create table if not exists ai_workspace_chats (
  id text primary key,
  user_id text not null,
  title text not null default 'Новый чат',
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_workspace_chats_user_updated_idx
  on ai_workspace_chats (user_id, updated_at desc);

create table if not exists client_notes (
  id text primary key,
  client_id text not null,
  author text not null,
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists client_notes_client_created_idx
  on client_notes (client_id, created_at desc);

create table if not exists notifications (
  id text primary key,
  user_id text not null,
  type text not null,
  title text not null,
  message text not null,
  author_name text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on notifications (user_id, created_at desc);

create table if not exists app_state (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 002_task_assignees.sql
-- -----------------------------------------------------------------------------
-- Назначение задач на одного или нескольких сотрудников

alter table tasks
  add column if not exists assignees jsonb not null default '[]'::jsonb;

-- -----------------------------------------------------------------------------
-- 003_user_presence.sql
-- -----------------------------------------------------------------------------
-- Online presence (heartbeat), separate from team_chat_last_seen

create table if not exists user_presence (
  user_id text primary key,
  last_active_at timestamptz not null default now()
);

create index if not exists user_presence_last_active_idx
  on user_presence (last_active_at desc);

-- -----------------------------------------------------------------------------
-- 004_team_chat_voice.sql
-- -----------------------------------------------------------------------------
-- Голосовые сообщения в командном чате

alter table team_chat_messages
  add column if not exists message_type text not null default 'text'
    check (message_type in ('text', 'voice')),
  add column if not exists audio_url text,
  add column if not exists audio_duration_ms integer;

-- Приватное хранилище аудио (раздача через API платформы)
insert into storage.buckets (id, name, public)
values ('team-chat-audio', 'team-chat-audio', false)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 005_task_approval_workflow.sql
-- -----------------------------------------------------------------------------
-- Цикл согласования задач: исполнитель → проверка автором → доработка (повторяемо)

alter table tasks drop constraint if exists tasks_status_check;

alter table tasks add constraint tasks_status_check check (
  status in (
    'new',
    'in_progress',
    'pending_approval',
    'needs_revision',
    'completed'
  )
);

alter table tasks
  add column if not exists review_history jsonb not null default '[]'::jsonb;

-- -----------------------------------------------------------------------------
-- 006_task_attachments.sql
-- -----------------------------------------------------------------------------
-- Вложения к задачам (метаданные в JSONB, файлы — в Storage)

alter table tasks
  add column if not exists attachments jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public)
values ('task-attachments', 'task-attachments', false)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 007_team_chat_images.sql
-- -----------------------------------------------------------------------------
-- Командный чат: изображения (вставка скриншота / фото)

alter table team_chat_messages
  add column if not exists image_url text;

alter table team_chat_messages
  drop constraint if exists team_chat_messages_message_type_check;

alter table team_chat_messages
  add constraint team_chat_messages_message_type_check
  check (message_type in ('text', 'voice', 'image'));

insert into storage.buckets (id, name, public)
values ('team-chat-images', 'team-chat-images', false)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 008_team_chat_files.sql
-- -----------------------------------------------------------------------------
-- Командный чат: документы (PDF, Word, Excel и т.д.)

alter table team_chat_messages
  add column if not exists file_url text,
  add column if not exists file_name text,
  add column if not exists file_content_type text,
  add column if not exists file_size integer;

alter table team_chat_messages
  drop constraint if exists team_chat_messages_message_type_check;

alter table team_chat_messages
  add constraint team_chat_messages_message_type_check
  check (message_type in ('text', 'voice', 'image', 'file'));

insert into storage.buckets (id, name, public)
values ('team-chat-files', 'team-chat-files', false)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 009_calendar.sql
-- -----------------------------------------------------------------------------
-- Calendar MVP — persisted events (personal + company)

create table if not exists calendar_events (
  id text primary key,
  company_id text not null default 'northstar-mobility',
  scope text not null check (scope in ('personal', 'company')),
  owner_user_id text,
  title text not null,
  description text not null default '',
  event_type text not null default 'general',
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  location text not null default '',
  created_by_user_id text not null,
  created_by_name text not null,
  updated_by_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scope <> 'personal' or owner_user_id is not null),
  check (end_at >= start_at)
);

create index if not exists calendar_events_range_idx
  on calendar_events (company_id, start_at, end_at);

create index if not exists calendar_events_personal_idx
  on calendar_events (owner_user_id, start_at)
  where scope = 'personal';

create index if not exists calendar_events_company_idx
  on calendar_events (company_id, start_at)
  where scope = 'company';

-- -----------------------------------------------------------------------------
-- 010_011_calendar_notifications_apply.sql
-- -----------------------------------------------------------------------------
-- Calendar notifications — apply 010 + 011 in one run

-- 010: per-event reminder opt-out
alter table calendar_events
  add column if not exists send_reminders boolean not null default true;

-- 011: idempotent delivery log (24h / 1h)
create table if not exists calendar_reminder_deliveries (
  id text primary key,
  event_id text not null references calendar_events(id) on delete cascade,
  user_id text not null,
  offset_minutes int not null check (offset_minutes in (1440, 60)),
  fire_at timestamptz not null,
  notification_id text,
  event_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (event_id, user_id, offset_minutes)
);

create index if not exists calendar_reminder_deliveries_fire_idx
  on calendar_reminder_deliveries (fire_at);

create index if not exists calendar_reminder_deliveries_event_idx
  on calendar_reminder_deliveries (event_id);

-- -----------------------------------------------------------------------------
-- 010_calendar_send_reminders.sql
-- -----------------------------------------------------------------------------
-- Calendar notifications PR #1 — per-event reminder opt-out

alter table calendar_events
  add column if not exists send_reminders boolean not null default true;

-- -----------------------------------------------------------------------------
-- 011_calendar_reminder_deliveries.sql
-- -----------------------------------------------------------------------------
-- Calendar notifications PR #1 — idempotent delivery log for 24h / 1h reminders

create table if not exists calendar_reminder_deliveries (
  id text primary key,
  event_id text not null references calendar_events(id) on delete cascade,
  user_id text not null,
  offset_minutes int not null check (offset_minutes in (1440, 60)),
  fire_at timestamptz not null,
  notification_id text,
  event_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (event_id, user_id, offset_minutes)
);

create index if not exists calendar_reminder_deliveries_fire_idx
  on calendar_reminder_deliveries (fire_at);

create index if not exists calendar_reminder_deliveries_event_idx
  on calendar_reminder_deliveries (event_id);

-- -----------------------------------------------------------------------------
-- 012_calendar_video_meetings.sql
-- -----------------------------------------------------------------------------
-- Internal video meetings — event type + join/leave audit

alter table calendar_events
  drop constraint if exists calendar_events_event_type_check;

alter table calendar_events
  add constraint calendar_events_event_type_check
  check (event_type in ('general', 'video_meeting'));

create table if not exists calendar_meeting_audit (
  id text primary key,
  event_id text not null references calendar_events(id) on delete cascade,
  user_id text not null,
  user_name text not null,
  room_name text not null,
  action text not null check (action in ('joined', 'left')),
  occurred_at timestamptz not null default now()
);

create index if not exists calendar_meeting_audit_event_idx
  on calendar_meeting_audit (event_id, occurred_at desc);

create index if not exists calendar_meeting_audit_user_idx
  on calendar_meeting_audit (user_id, occurred_at desc);

-- -----------------------------------------------------------------------------
-- 013_calendar_event_participants.sql
-- -----------------------------------------------------------------------------
-- Video meeting invite lists (selected participants or all team)

alter table calendar_events
  add column if not exists video_invite_mode text
  check (video_invite_mode is null or video_invite_mode in ('all_team', 'selected'));

create table if not exists calendar_event_participants (
  event_id text not null references calendar_events(id) on delete cascade,
  user_id text not null,
  primary key (event_id, user_id)
);

create index if not exists calendar_event_participants_user_idx
  on calendar_event_participants (user_id, event_id);

-- -----------------------------------------------------------------------------
-- 014_task_progress_reports.sql
-- -----------------------------------------------------------------------------
-- Assignee progress reports (comment + optional file) on tasks

alter table tasks
  add column if not exists progress_reports jsonb not null default '[]'::jsonb;

-- -----------------------------------------------------------------------------
-- 015_calendar_meeting_guest_invites.sql
-- -----------------------------------------------------------------------------
-- Guest invite links for external video meeting participants

create table if not exists calendar_meeting_guest_invites (
  id text primary key,
  event_id text not null references calendar_events(id) on delete cascade,
  token text not null unique,
  created_by_user_id text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists calendar_meeting_guest_invites_event_idx
  on calendar_meeting_guest_invites (event_id, created_at desc);

create unique index if not exists calendar_meeting_guest_invites_active_event_idx
  on calendar_meeting_guest_invites (event_id)
  where enabled = true and revoked_at is null;

alter table calendar_meeting_audit
  add column if not exists participant_type text not null default 'team'
  check (participant_type in ('team', 'guest'));

-- -----------------------------------------------------------------------------
-- 016_calendar_meeting_guest_waiting_room.sql
-- -----------------------------------------------------------------------------
-- Guest waiting room for external video meeting participants

alter table calendar_events
  add column if not exists guest_waiting_room boolean not null default true;

create table if not exists calendar_meeting_guest_admissions (
  id text primary key,
  event_id text not null references calendar_events(id) on delete cascade,
  invite_id text not null references calendar_meeting_guest_invites(id) on delete cascade,
  guest_id text not null,
  display_name text not null,
  status text not null check (status in ('pending', 'admitted', 'rejected', 'left')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by_user_id text
);

create index if not exists calendar_meeting_guest_admissions_event_status_idx
  on calendar_meeting_guest_admissions (event_id, status, created_at desc);

create index if not exists calendar_meeting_guest_admissions_guest_idx
  on calendar_meeting_guest_admissions (guest_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 017_calendar_meeting_guest_access.sql
-- -----------------------------------------------------------------------------
-- Guest access limits and optional password for external participants

alter table calendar_events
  add column if not exists guest_max_count int
    check (guest_max_count is null or (guest_max_count >= 1 and guest_max_count <= 50)),
  add column if not exists guest_access_password_hash text;

update calendar_events
set guest_max_count = 10
where event_type = 'video_meeting' and guest_max_count is null;

-- -----------------------------------------------------------------------------
-- 018_calendar_meeting_client_link.sql
-- -----------------------------------------------------------------------------
-- Optional CRM client link for video meetings

alter table calendar_events
  add column if not exists linked_client_id text,
  add column if not exists linked_client_name text;

-- -----------------------------------------------------------------------------
-- 019_calendar_meeting_recordings.sql
-- -----------------------------------------------------------------------------
-- Video meeting recordings (LiveKit egress → storage)

create table if not exists calendar_meeting_recordings (
  id text primary key,
  event_id text not null references calendar_events(id) on delete cascade,
  egress_id text unique,
  status text not null default 'starting'
    check (status in ('starting', 'active', 'processing', 'complete', 'failed', 'stopped')),
  started_by_user_id text not null,
  started_by_name text not null,
  storage_path text,
  file_name text,
  duration_seconds int,
  file_size_bytes bigint,
  error_message text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists calendar_meeting_recordings_event_idx
  on calendar_meeting_recordings (event_id, started_at desc);

create index if not exists calendar_meeting_recordings_status_idx
  on calendar_meeting_recordings (status, started_at desc);

-- -----------------------------------------------------------------------------
-- 020_team_chat_reply_pin.sql
-- -----------------------------------------------------------------------------
-- Reply-to and pin support for team chat messages.

ALTER TABLE team_chat_messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id text REFERENCES team_chat_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reply_to_user_name text,
  ADD COLUMN IF NOT EXISTS reply_to_message_type text,
  ADD COLUMN IF NOT EXISTS reply_to_preview text,
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz,
  ADD COLUMN IF NOT EXISTS pinned_by_user_id text;

CREATE INDEX IF NOT EXISTS team_chat_messages_pinned_idx
  ON team_chat_messages (pinned_at DESC)
  WHERE is_pinned = true;

CREATE INDEX IF NOT EXISTS team_chat_messages_type_created_idx
  ON team_chat_messages (message_type, created_at DESC);

-- -----------------------------------------------------------------------------
-- 021_meeting_recordings_storage.sql
-- -----------------------------------------------------------------------------
-- Meeting recordings — private Storage bucket

insert into storage.buckets (id, name, public)
values ('meeting-recordings', 'meeting-recordings', false)
on conflict (id) do update
  set public = excluded.public,
      name = excluded.name;

drop policy if exists "meeting_recordings_service_role_all" on storage.objects;

create policy "meeting_recordings_service_role_all"
  on storage.objects
  for all
  to service_role
  using (bucket_id = 'meeting-recordings')
  with check (bucket_id = 'meeting-recordings');

-- =============================================================================
-- VERIFICATION (read-only) — выполняется после bootstrap
-- =============================================================================

-- 1. Список созданных таблиц (ожидается 15)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 2. Список индексов public schema
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 3. Storage buckets (ожидается 5, все public = false)
SELECT id, name, public
FROM storage.buckets
WHERE id IN (
  'team-chat-audio',
  'task-attachments',
  'team-chat-images',
  'team-chat-files',
  'meeting-recordings'
)
ORDER BY id;

-- 4. Bucket meeting-recordings + policy
SELECT id, name, public
FROM storage.buckets
WHERE id = 'meeting-recordings';

SELECT policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname = 'meeting_recordings_service_role_all';

-- 5. Ключевые колонки tasks
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tasks'
  AND column_name IN (
    'assignees',
    'review_history',
    'attachments',
    'progress_reports',
    'status'
  )
ORDER BY column_name;

-- 6. CHECK constraint tasks.status (workflow)
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.tasks'::regclass
  AND contype = 'c'
  AND conname = 'tasks_status_check';

-- 7. Ключевые колонки calendar_events
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'calendar_events'
  AND column_name IN (
    'send_reminders',
    'video_invite_mode',
    'guest_waiting_room',
    'guest_max_count',
    'guest_access_password_hash',
    'linked_client_id',
    'linked_client_name',
    'event_type'
  )
ORDER BY column_name;

-- 8. CHECK constraint calendar_events.event_type
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.calendar_events'::regclass
  AND contype = 'c'
  AND conname = 'calendar_events_event_type_check';

-- 9. FK calendar_meeting_recordings → calendar_events
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'calendar_meeting_recordings';

-- 10. Ключевые колонки team_chat_messages (reply / pin)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'team_chat_messages'
  AND column_name IN (
    'message_type',
    'reply_to_message_id',
    'is_pinned',
    'pinned_at'
  )
ORDER BY column_name;
