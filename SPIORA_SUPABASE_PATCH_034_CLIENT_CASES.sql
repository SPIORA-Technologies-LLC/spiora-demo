-- =============================================================================
-- SPIORA migration 034 — Client Cases / Submission Workflow (PR #32.1)
-- Idempotent. Non-destructive. Do NOT auto-apply.
-- Requires: 024, 025, 032, 033. Storage: task-attachments (006).
-- =============================================================================

create table if not exists public.client_cases (
  id uuid primary key default gen_random_uuid(),
  client_portal_user_id uuid not null
    references public.client_portal_users (id) on delete restrict,
  invitation_id uuid not null
    references public.client_invitations (id) on delete restrict,
  questionnaire_id uuid not null
    references public.client_questionnaires (id) on delete restrict,
  crm_client_id uuid references public.clients (id) on delete set null,
  assigned_to uuid references public.user_profiles (id) on delete set null,
  service_type text,
  current_status text not null default 'application_received',
  first_name text,
  last_name text,
  email text,
  phone text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint client_cases_status_check check (
    current_status in (
      'application_received','initial_review','documents_requested',
      'documents_under_review','in_progress','awaiting_decision',
      'approved','completed','cancelled'
    )
  ),
  constraint client_cases_email_len check (email is null or length(email) <= 320)
);

create unique index if not exists client_cases_questionnaire_uidx
  on public.client_cases (questionnaire_id) where archived_at is null;
create unique index if not exists client_cases_portal_user_active_uidx
  on public.client_cases (client_portal_user_id) where archived_at is null;
create index if not exists client_cases_status_submitted_idx
  on public.client_cases (current_status, submitted_at desc) where archived_at is null;
create index if not exists client_cases_assigned_idx
  on public.client_cases (assigned_to, submitted_at desc) where archived_at is null;

create table if not exists public.client_case_status_history (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.client_cases (id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references public.user_profiles (id) on delete set null,
  actor_role text not null default 'system',
  client_visible_key text,
  note text,
  created_at timestamptz not null default now(),
  constraint client_case_status_history_actor_role_check
    check (actor_role in ('employee', 'client', 'system')),
  constraint client_case_status_history_note_len
    check (note is null or length(note) <= 2000)
);
create index if not exists client_case_status_history_case_idx
  on public.client_case_status_history (case_id, created_at desc);

create table if not exists public.client_case_comments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.client_cases (id) on delete cascade,
  author_user_id uuid references public.user_profiles (id) on delete set null,
  author_name text not null,
  body text not null,
  visibility text not null default 'internal',
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  archived_at timestamptz,
  constraint client_case_comments_body_nonempty
    check (length(trim(body)) > 0 and length(body) <= 8000),
  constraint client_case_comments_author_name_nonempty
    check (length(trim(author_name)) > 0 and length(author_name) <= 200),
  constraint client_case_comments_visibility_check
    check (visibility in ('internal', 'client'))
);
create index if not exists client_case_comments_case_idx
  on public.client_case_comments (case_id, created_at desc) where archived_at is null;

create table if not exists public.client_case_activity (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.client_cases (id) on delete cascade,
  activity_type text not null,
  actor_type text not null default 'system',
  actor_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint client_case_activity_type_nonempty
    check (length(trim(activity_type)) > 0 and length(activity_type) <= 80),
  constraint client_case_activity_actor_type_check
    check (actor_type in ('employee', 'client', 'system'))
);
create index if not exists client_case_activity_case_idx
  on public.client_case_activity (case_id, created_at desc);

create table if not exists public.client_case_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.client_cases (id) on delete cascade,
  uploader_role text not null,
  uploaded_by uuid,
  uploaded_by_name text,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  storage_bucket text not null default 'task-attachments',
  storage_path text not null,
  document_type text,
  category text,
  visibility text not null default 'internal',
  source_question_id text,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint client_case_documents_uploader_role_check
    check (uploader_role in ('client', 'employee', 'system')),
  constraint client_case_documents_visibility_check
    check (visibility in ('client', 'internal')),
  constraint client_case_documents_size_positive
    check (size_bytes > 0 and size_bytes <= 15728640),
  constraint client_case_documents_path_nonempty
    check (length(trim(storage_path)) > 0)
);
create unique index if not exists client_case_documents_path_uidx
  on public.client_case_documents (storage_bucket, storage_path) where archived_at is null;
create index if not exists client_case_documents_case_idx
  on public.client_case_documents (case_id, created_at desc) where archived_at is null;

alter table public.client_questionnaires
  add column if not exists case_id uuid
    references public.client_cases (id) on delete set null;
create index if not exists client_questionnaires_case_id_idx
  on public.client_questionnaires (case_id) where case_id is not null;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'client_documents'
  ) then
    alter table public.client_documents
      add column if not exists case_id uuid
        references public.client_cases (id) on delete set null;
    alter table public.client_documents
      add column if not exists uploader_role text;
  end if;
end $$;

create or replace function public.spiora_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists client_cases_touch_updated_at on public.client_cases;
create trigger client_cases_touch_updated_at
  before update on public.client_cases
  for each row execute function public.spiora_touch_updated_at();

do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'spiora_block_hard_delete'
  ) then
    drop trigger if exists client_cases_block_hard_delete on public.client_cases;
    create trigger client_cases_block_hard_delete
      before delete on public.client_cases
      for each row execute function public.spiora_block_hard_delete();
    drop trigger if exists client_case_activity_block_hard_delete on public.client_case_activity;
    create trigger client_case_activity_block_hard_delete
      before delete on public.client_case_activity
      for each row execute function public.spiora_block_hard_delete();
    drop trigger if exists client_case_documents_block_hard_delete on public.client_case_documents;
    create trigger client_case_documents_block_hard_delete
      before delete on public.client_case_documents
      for each row execute function public.spiora_block_hard_delete();
  end if;
end $$;

create or replace function public.spiora_submit_client_case(
  p_questionnaire_id uuid,
  p_portal_user_id uuid,
  p_invitation_id uuid,
  p_base_revision integer,
  p_assigned_to uuid,
  p_service_type text,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_submitted_at timestamptz,
  p_documents jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q public.client_questionnaires%rowtype;
  v_case public.client_cases%rowtype;
  v_created boolean := false;
  v_now timestamptz := coalesce(p_submitted_at, now());
  v_doc jsonb;
  v_before_id uuid;
begin
  select * into v_q from public.client_questionnaires where id = p_questionnaire_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'QUESTIONNAIRE_NOT_FOUND');
  end if;
  if v_q.client_portal_user_id <> p_portal_user_id or v_q.invitation_id <> p_invitation_id then
    return jsonb_build_object('ok', false, 'code', 'QUESTIONNAIRE_ACCESS_DENIED');
  end if;

  if v_q.status in ('submitted', 'locked') then
    select * into v_case from public.client_cases
      where questionnaire_id = v_q.id and archived_at is null limit 1;
    if found then
      update public.client_questionnaires set case_id = v_case.id, updated_at = now() where id = v_q.id;
      return jsonb_build_object('ok', true, 'created', false, 'case_id', v_case.id,
        'questionnaire_revision', v_q.revision,
        'submitted_at', coalesce(v_q.submitted_at, v_case.submitted_at));
    end if;
    if v_q.status = 'locked' then
      return jsonb_build_object('ok', false, 'code', 'QUESTIONNAIRE_READ_ONLY');
    end if;
  end if;

  if v_q.status not in ('draft', 'in_review', 'submitted') then
    return jsonb_build_object('ok', false, 'code', 'QUESTIONNAIRE_READ_ONLY');
  end if;

  if v_q.status in ('draft', 'in_review') then
    if v_q.revision <> p_base_revision then
      return jsonb_build_object('ok', false, 'code', 'QUESTIONNAIRE_REVISION_CONFLICT');
    end if;
    update public.client_questionnaires
    set status = 'submitted', submitted_at = v_now,
        reviewed_at = coalesce(reviewed_at, v_now),
        revision = revision + 1, updated_at = now()
    where id = v_q.id and revision = p_base_revision
    returning * into v_q;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'QUESTIONNAIRE_REVISION_CONFLICT');
    end if;
  end if;

  select id into v_before_id from public.client_cases
    where questionnaire_id = p_questionnaire_id and archived_at is null limit 1;

  if v_before_id is null then
    insert into public.client_cases (
      client_portal_user_id, invitation_id, questionnaire_id, assigned_to,
      service_type, current_status, first_name, last_name, email, phone, submitted_at
    ) values (
      p_portal_user_id, p_invitation_id, p_questionnaire_id, p_assigned_to,
      p_service_type, 'application_received', p_first_name, p_last_name, p_email, p_phone, v_now
    );
    v_created := true;
  end if;

  select * into v_case from public.client_cases
    where questionnaire_id = p_questionnaire_id and archived_at is null limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'SUBMIT_FAILED');
  end if;

  update public.client_questionnaires set case_id = v_case.id, updated_at = now()
    where id = p_questionnaire_id;

  if not exists (select 1 from public.client_case_status_history h where h.case_id = v_case.id) then
    insert into public.client_case_status_history (
      case_id, from_status, to_status, changed_by, actor_role, client_visible_key
    ) values (v_case.id, null, 'application_received', null, 'system', 'application_received');
  end if;

  if not exists (
    select 1 from public.client_case_activity a
    where a.case_id = v_case.id and a.activity_type = 'questionnaire_submitted'
  ) then
    insert into public.client_case_activity (case_id, activity_type, actor_type, actor_id, metadata)
    values (v_case.id, 'questionnaire_submitted', 'client', null,
      jsonb_build_object('questionnaireId', p_questionnaire_id));
  end if;

  if p_assigned_to is not null and not exists (
    select 1 from public.client_case_activity a
    where a.case_id = v_case.id and a.activity_type = 'employee_assigned'
  ) then
    insert into public.client_case_activity (case_id, activity_type, actor_type, actor_id, metadata)
    values (v_case.id, 'employee_assigned', 'system', p_assigned_to, '{}'::jsonb);
  end if;

  if jsonb_typeof(p_documents) = 'array' then
    for v_doc in select * from jsonb_array_elements(p_documents)
    loop
      if coalesce(v_doc->>'storagePath', '') = '' then continue; end if;
      insert into public.client_case_documents (
        case_id, uploader_role, uploaded_by, file_name, mime_type, size_bytes,
        storage_bucket, storage_path, document_type, category, visibility, source_question_id
      ) values (
        v_case.id, 'client', p_portal_user_id,
        coalesce(v_doc->>'fileName', 'file'),
        coalesce(v_doc->>'mimeType', 'application/octet-stream'),
        greatest(1, coalesce((v_doc->>'sizeBytes')::bigint, 1)),
        coalesce(v_doc->>'storageBucket', 'task-attachments'),
        v_doc->>'storagePath',
        v_doc->>'documentType', v_doc->>'category', 'client', v_doc->>'sourceQuestionId'
      )
      on conflict do nothing;
    end loop;
  end if;

  return jsonb_build_object(
    'ok', true, 'created', v_created, 'case_id', v_case.id,
    'questionnaire_revision', v_q.revision, 'submitted_at', coalesce(v_q.submitted_at, v_now)
  );
end;
$$;

revoke all on function public.spiora_submit_client_case(uuid, uuid, uuid, integer, uuid, text, text, text, text, text, timestamptz, jsonb) from public;
grant execute on function public.spiora_submit_client_case(uuid, uuid, uuid, integer, uuid, text, text, text, text, text, timestamptz, jsonb) to service_role;

alter table public.client_cases enable row level security;
alter table public.client_case_status_history enable row level security;
alter table public.client_case_comments enable row level security;
alter table public.client_case_activity enable row level security;
alter table public.client_case_documents enable row level security;

create or replace function public.is_spiora_case_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.is_spiora_owner(), false)
      or coalesce(public.is_spiora_manager(), false);
$$;

create or replace function public.is_spiora_case_client_owner(p_case_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.client_cases c
    join public.client_portal_users u on u.id = c.client_portal_user_id
    where c.id = p_case_id and u.auth_user_id = auth.uid() and c.archived_at is null
  );
$$;

do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_spiora_owner'
  ) then
    drop policy if exists client_cases_staff_select on public.client_cases;
    create policy client_cases_staff_select on public.client_cases for select to authenticated
      using (
        public.is_spiora_case_staff()
        or (coalesce(public.current_spiora_role(), '') = 'consultant' and assigned_to = public.current_spiora_profile_id())
        or exists (select 1 from public.client_portal_users u where u.id = client_cases.client_portal_user_id and u.auth_user_id = auth.uid())
      );

    drop policy if exists client_cases_staff_update on public.client_cases;
    create policy client_cases_staff_update on public.client_cases for update to authenticated
      using (public.is_spiora_case_staff()) with check (public.is_spiora_case_staff());

    drop policy if exists client_case_status_history_select on public.client_case_status_history;
    create policy client_case_status_history_select on public.client_case_status_history for select to authenticated
      using (public.is_spiora_case_staff() or public.is_spiora_case_client_owner(case_id));

    drop policy if exists client_case_comments_staff on public.client_case_comments;
    create policy client_case_comments_staff on public.client_case_comments for all to authenticated
      using (public.is_spiora_case_staff()) with check (public.is_spiora_case_staff());

    drop policy if exists client_case_comments_client_select on public.client_case_comments;
    create policy client_case_comments_client_select on public.client_case_comments for select to authenticated
      using (visibility = 'client' and public.is_spiora_case_client_owner(case_id));

    drop policy if exists client_case_activity_select on public.client_case_activity;
    create policy client_case_activity_select on public.client_case_activity for select to authenticated
      using (public.is_spiora_case_staff() or public.is_spiora_case_client_owner(case_id));

    drop policy if exists client_case_documents_staff on public.client_case_documents;
    create policy client_case_documents_staff on public.client_case_documents for all to authenticated
      using (public.is_spiora_case_staff()) with check (public.is_spiora_case_staff());

    drop policy if exists client_case_documents_client_select on public.client_case_documents;
    create policy client_case_documents_client_select on public.client_case_documents for select to authenticated
      using (visibility = 'client' and archived_at is null and public.is_spiora_case_client_owner(case_id));
  end if;
end $$;

grant select on public.client_cases to authenticated;
grant select on public.client_case_status_history to authenticated;
grant select on public.client_case_comments to authenticated;
grant select on public.client_case_activity to authenticated;
grant select on public.client_case_documents to authenticated;
grant insert, update on public.client_cases to authenticated;
grant insert on public.client_case_status_history to authenticated;
grant insert, update on public.client_case_comments to authenticated;
grant insert on public.client_case_activity to authenticated;
grant insert, update on public.client_case_documents to authenticated;
grant all on public.client_cases to service_role;
grant all on public.client_case_status_history to service_role;
grant all on public.client_case_comments to service_role;
grant all on public.client_case_activity to service_role;
grant all on public.client_case_documents to service_role;
