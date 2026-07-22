-- =============================================================================
-- SPIORA patch 033 — Spiora Client Questionnaire Engine (PR #31)
-- Manual SQL Editor apply only. Idempotent. Do NOT auto-apply.
-- =============================================================================

-- This patch intentionally mirrors:
--   supabase/migrations/033_spiora_client_questionnaires.sql
-- Keep both files in sync.

create table if not exists public.questionnaire_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null,
  name text not null,
  description text,
  status text not null default 'draft',
  created_by uuid references public.user_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint questionnaire_templates_key_nonempty
    check (length(trim(template_key)) > 0 and length(template_key) <= 120),
  constraint questionnaire_templates_name_nonempty
    check (length(trim(name)) > 0 and length(name) <= 200),
  constraint questionnaire_templates_status_check
    check (status in ('draft', 'published', 'archived'))
);

create unique index if not exists questionnaire_templates_template_key_uidx
  on public.questionnaire_templates (template_key);

create table if not exists public.questionnaire_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null
    references public.questionnaire_templates (id) on delete restrict,
  version integer not null,
  schema jsonb not null,
  schema_hash text not null,
  status text not null default 'draft',
  published_at timestamptz,
  created_by uuid references public.user_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint questionnaire_template_versions_version_positive
    check (version >= 1),
  constraint questionnaire_template_versions_hash_len
    check (length(schema_hash) = 64),
  constraint questionnaire_template_versions_status_check
    check (status in ('draft', 'published', 'archived'))
);

create unique index if not exists questionnaire_template_versions_template_version_uidx
  on public.questionnaire_template_versions (template_id, version);

create index if not exists questionnaire_template_versions_published_idx
  on public.questionnaire_template_versions (template_id, status, version desc);

create table if not exists public.client_questionnaires (
  id uuid primary key default gen_random_uuid(),
  client_portal_user_id uuid not null
    references public.client_portal_users (id) on delete restrict,
  invitation_id uuid not null
    references public.client_invitations (id) on delete restrict,
  template_version_id uuid not null
    references public.questionnaire_template_versions (id) on delete restrict,
  status text not null default 'draft',
  answers jsonb not null default '{}'::jsonb,
  revision integer not null default 1,
  started_at timestamptz,
  last_saved_at timestamptz,
  reviewed_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint client_questionnaires_status_check
    check (status in ('draft', 'in_review', 'submitted', 'locked', 'archived')),
  constraint client_questionnaires_revision_positive
    check (revision >= 1),
  constraint client_questionnaires_answers_object
    check (jsonb_typeof(answers) = 'object')
);

create unique index if not exists client_questionnaires_invitation_uidx
  on public.client_questionnaires (invitation_id)
  where archived_at is null;

create unique index if not exists client_questionnaires_active_portal_uidx
  on public.client_questionnaires (client_portal_user_id)
  where archived_at is null;

create index if not exists client_questionnaires_status_idx
  on public.client_questionnaires (status, updated_at desc);

create or replace function public.questionnaire_templates_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.client_questionnaires_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.questionnaire_template_versions_guard()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'published' then
    if new.schema <> old.schema then
      raise exception 'published_questionnaire_schema_immutable';
    end if;
    if new.schema_hash <> old.schema_hash then
      raise exception 'published_questionnaire_hash_immutable';
    end if;
    if new.version <> old.version then
      raise exception 'published_questionnaire_version_immutable';
    end if;
    if new.status = 'draft' then
      raise exception 'published_questionnaire_cannot_return_to_draft';
    end if;
  end if;
  if new.version < old.version then
    raise exception 'questionnaire_version_cannot_decrease';
  end if;
  return new;
end;
$$;

drop trigger if exists questionnaire_templates_touch_updated_at on public.questionnaire_templates;
create trigger questionnaire_templates_touch_updated_at
  before update on public.questionnaire_templates
  for each row execute function public.questionnaire_templates_touch_updated_at();

drop trigger if exists client_questionnaires_touch_updated_at on public.client_questionnaires;
create trigger client_questionnaires_touch_updated_at
  before update on public.client_questionnaires
  for each row execute function public.client_questionnaires_touch_updated_at();

drop trigger if exists questionnaire_template_versions_guard on public.questionnaire_template_versions;
create trigger questionnaire_template_versions_guard
  before update on public.questionnaire_template_versions
  for each row execute function public.questionnaire_template_versions_guard();

drop trigger if exists questionnaire_templates_block_hard_delete on public.questionnaire_templates;
create trigger questionnaire_templates_block_hard_delete
  before delete on public.questionnaire_templates
  for each row execute function public.spiora_block_hard_delete();

drop trigger if exists questionnaire_template_versions_block_hard_delete on public.questionnaire_template_versions;
create trigger questionnaire_template_versions_block_hard_delete
  before delete on public.questionnaire_template_versions
  for each row execute function public.spiora_block_hard_delete();

drop trigger if exists client_questionnaires_block_hard_delete on public.client_questionnaires;
create trigger client_questionnaires_block_hard_delete
  before delete on public.client_questionnaires
  for each row execute function public.spiora_block_hard_delete();

revoke all on table public.questionnaire_templates from anon, public;
revoke all on table public.questionnaire_template_versions from anon, public;
revoke all on table public.client_questionnaires from anon, public;

grant select on table public.questionnaire_templates to authenticated;
grant select on table public.questionnaire_template_versions to authenticated;
grant select, insert, update on table public.client_questionnaires to authenticated;
revoke delete on table public.client_questionnaires from authenticated;

alter table public.questionnaire_templates enable row level security;
alter table public.questionnaire_template_versions enable row level security;
alter table public.client_questionnaires enable row level security;

drop policy if exists rls_questionnaire_templates_select_published on public.questionnaire_templates;
create policy rls_questionnaire_templates_select_published
  on public.questionnaire_templates
  for select to authenticated
  using (status = 'published' or public.is_spiora_owner() or public.is_spiora_manager());

drop policy if exists rls_questionnaire_template_versions_select_published on public.questionnaire_template_versions;
create policy rls_questionnaire_template_versions_select_published
  on public.questionnaire_template_versions
  for select to authenticated
  using (
    status = 'published'
    or public.is_spiora_owner()
    or public.is_spiora_manager()
  );

drop policy if exists rls_client_questionnaires_select_own on public.client_questionnaires;
create policy rls_client_questionnaires_select_own
  on public.client_questionnaires
  for select to authenticated
  using (
    exists (
      select 1
      from public.client_portal_users cpu
      where cpu.id = client_questionnaires.client_portal_user_id
        and cpu.auth_user_id = auth.uid()
    )
    or public.is_spiora_owner()
    or public.is_spiora_manager()
  );

drop policy if exists rls_client_questionnaires_insert_own on public.client_questionnaires;
create policy rls_client_questionnaires_insert_own
  on public.client_questionnaires
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.client_portal_users cpu
      where cpu.id = client_questionnaires.client_portal_user_id
        and cpu.auth_user_id = auth.uid()
    )
  );

drop policy if exists rls_client_questionnaires_update_own on public.client_questionnaires;
create policy rls_client_questionnaires_update_own
  on public.client_questionnaires
  for update to authenticated
  using (
    exists (
      select 1
      from public.client_portal_users cpu
      where cpu.id = client_questionnaires.client_portal_user_id
        and cpu.auth_user_id = auth.uid()
    )
    or public.is_spiora_owner()
    or public.is_spiora_manager()
  )
  with check (
    exists (
      select 1
      from public.client_portal_users cpu
      where cpu.id = client_questionnaires.client_portal_user_id
        and cpu.auth_user_id = auth.uid()
    )
  );

do $$
declare
  v_template_id uuid;
  v_existing_hash text;
  v_schema jsonb := $json$
{
  "schemaVersion": 1,
  "templateKey": "general_client_onboarding",
  "title": { "en": "Client questionnaire", "ru": "Анкета клиента" },
  "description": { "en": "Complete the information below. You can save and continue later.", "ru": "Заполните информацию ниже. Вы можете сохранить и продолжить позже." },
  "sections": [
    { "id": "welcome", "order": 5, "title": { "en": "Welcome", "ru": "Добро пожаловать" }, "questions": [
      { "id": "welcome_heading", "type": "heading", "order": 10, "label": { "en": "Welcome to Spiora Client", "ru": "Добро пожаловать в Spiora Client" } },
      { "id": "welcome_info", "type": "information", "order": 20, "label": { "en": "Your answers are saved automatically. You can return anytime.", "ru": "Ответы сохраняются автоматически. Вы можете вернуться в любое время." } }
    ]},
    { "id": "personal_information", "order": 10, "title": { "en": "Personal information", "ru": "Личные данные" }, "questions": [
      { "id": "first_name", "type": "text", "order": 10, "label": { "en": "First name", "ru": "Имя" }, "required": true, "validation": { "minLength": 1, "maxLength": 100 } },
      { "id": "last_name", "type": "text", "order": 20, "label": { "en": "Last name", "ru": "Фамилия" }, "required": true, "validation": { "minLength": 1, "maxLength": 100 } },
      { "id": "previous_names", "type": "text", "order": 30, "label": { "en": "Previous names", "ru": "Прежние имена" }, "validation": { "maxLength": 200 } },
      { "id": "date_of_birth", "type": "date", "order": 40, "label": { "en": "Date of birth", "ru": "Дата рождения" }, "required": true },
      { "id": "place_of_birth", "type": "text", "order": 50, "label": { "en": "Place of birth", "ru": "Место рождения" }, "validation": { "maxLength": 200 } },
      { "id": "citizenship", "type": "country", "order": 60, "label": { "en": "Citizenship", "ru": "Гражданство" }, "required": true },
      { "id": "other_citizenships", "type": "text", "order": 70, "label": { "en": "Other citizenships", "ru": "Другие гражданства" }, "validation": { "maxLength": 200 } },
      { "id": "gender", "type": "select", "order": 80, "label": { "en": "Gender", "ru": "Пол" }, "options": [ { "value": "female", "label": { "en": "Female", "ru": "Женский" } }, { "value": "male", "label": { "en": "Male", "ru": "Мужской" } }, { "value": "other", "label": { "en": "Other", "ru": "Другое" } }, { "value": "prefer_not", "label": { "en": "Prefer not to say", "ru": "Предпочитаю не указывать" } } ] },
      { "id": "marital_status", "type": "select", "order": 90, "label": { "en": "Marital status", "ru": "Семейное положение" }, "options": [ { "value": "single", "label": { "en": "Single", "ru": "Холост/не замужем" } }, { "value": "married", "label": { "en": "Married", "ru": "В браке" } }, { "value": "divorced", "label": { "en": "Divorced", "ru": "В разводе" } }, { "value": "widowed", "label": { "en": "Widowed", "ru": "Вдовец/вдова" } } ] }
    ]},
    { "id": "contact_information", "order": 20, "title": { "en": "Contact information", "ru": "Контактные данные" }, "questions": [
      { "id": "email", "type": "email", "order": 10, "label": { "en": "Email", "ru": "Email" }, "required": true, "readOnly": true, "derivedFrom": "portal_email" },
      { "id": "phone", "type": "phone", "order": 20, "label": { "en": "Phone", "ru": "Телефон" }, "required": true },
      { "id": "country_of_residence", "type": "country", "order": 30, "label": { "en": "Country of residence", "ru": "Страна проживания" }, "required": true },
      { "id": "city", "type": "text", "order": 40, "label": { "en": "City", "ru": "Город" }, "validation": { "maxLength": 120 } },
      { "id": "address", "type": "textarea", "order": 50, "label": { "en": "Address", "ru": "Адрес" }, "validation": { "maxLength": 500 } },
      { "id": "preferred_contact_method", "type": "select", "order": 60, "label": { "en": "Preferred contact method", "ru": "Предпочтительный способ связи" }, "options": [ { "value": "email", "label": { "en": "Email", "ru": "Email" } }, { "value": "phone", "label": { "en": "Phone", "ru": "Телефон" } } ] },
      { "id": "preferred_language", "type": "select", "order": 70, "label": { "en": "Preferred language", "ru": "Предпочтительный язык" }, "options": [ { "value": "en", "label": { "en": "English", "ru": "Английский" } }, { "value": "ru", "label": { "en": "Russian", "ru": "Русский" } } ] }
    ]},
    { "id": "family", "order": 30, "title": { "en": "Family", "ru": "Семья" }, "questions": [
      { "id": "spouse_or_partner", "type": "boolean", "order": 10, "label": { "en": "Spouse or partner", "ru": "Супруг/партнёр" } },
      { "id": "spouse_name", "type": "text", "order": 20, "label": { "en": "Spouse name", "ru": "Имя супруга/партнёра" }, "visibleWhen": { "questionId": "spouse_or_partner", "operator": "equals", "value": true }, "validation": { "maxLength": 200 } },
      { "id": "has_children", "type": "boolean", "order": 30, "label": { "en": "Has children", "ru": "Есть дети" } },
      { "id": "number_of_children", "type": "number", "order": 40, "label": { "en": "Number of children", "ru": "Количество детей" }, "visibleWhen": { "questionId": "has_children", "operator": "equals", "value": true }, "validation": { "min": 0, "max": 20, "integer": true } },
      { "id": "dependants_notes", "type": "textarea", "order": 50, "label": { "en": "Dependants notes", "ru": "Примечания об иждивенцах" }, "validation": { "maxLength": 2000 } }
    ]},
    { "id": "education", "order": 40, "title": { "en": "Education", "ru": "Образование" }, "questions": [
      { "id": "highest_education", "type": "select", "order": 10, "label": { "en": "Highest education", "ru": "Высшее образование" }, "options": [ { "value": "secondary", "label": { "en": "Secondary", "ru": "Среднее" } }, { "value": "bachelor", "label": { "en": "Bachelor", "ru": "Бакалавр" } }, { "value": "master", "label": { "en": "Master", "ru": "Магистр" } }, { "value": "doctorate", "label": { "en": "Doctorate", "ru": "Докторантура" } }, { "value": "other", "label": { "en": "Other", "ru": "Другое" } } ] },
      { "id": "institution_name", "type": "text", "order": 20, "label": { "en": "Institution", "ru": "Учебное заведение" }, "validation": { "maxLength": 200 } },
      { "id": "field_of_study", "type": "text", "order": 30, "label": { "en": "Field of study", "ru": "Специальность" }, "validation": { "maxLength": 200 } },
      { "id": "graduation_year", "type": "number", "order": 40, "label": { "en": "Graduation year", "ru": "Год окончания" }, "validation": { "min": 1950, "max": 2100, "integer": true } }
    ]},
    { "id": "employment", "order": 50, "title": { "en": "Employment", "ru": "Работа" }, "questions": [
      { "id": "employment_status", "type": "select", "order": 10, "label": { "en": "Employment status", "ru": "Статус занятости" }, "required": true, "options": [ { "value": "employed", "label": { "en": "Employed", "ru": "Работает" } }, { "value": "self_employed", "label": { "en": "Self-employed", "ru": "Самозанятый" } }, { "value": "unemployed", "label": { "en": "Unemployed", "ru": "Безработный" } }, { "value": "student", "label": { "en": "Student", "ru": "Студент" } }, { "value": "retired", "label": { "en": "Retired", "ru": "Пенсионер" } } ] },
      { "id": "employer_name", "type": "text", "order": 20, "label": { "en": "Employer name", "ru": "Название работодателя" }, "visibleWhen": { "questionId": "employment_status", "operator": "equals", "value": "employed" }, "validation": { "maxLength": 200 } },
      { "id": "occupation", "type": "text", "order": 30, "label": { "en": "Occupation", "ru": "Профессия" }, "validation": { "maxLength": 200 } },
      { "id": "monthly_income", "type": "number", "order": 40, "label": { "en": "Monthly income", "ru": "Ежемесячный доход" }, "validation": { "min": 0 } },
      { "id": "income_currency", "type": "select", "order": 50, "label": { "en": "Income currency", "ru": "Валюта дохода" }, "options": [ { "value": "EUR", "label": { "en": "EUR", "ru": "EUR" } }, { "value": "USD", "label": { "en": "USD", "ru": "USD" } }, { "value": "HRK", "label": { "en": "HRK", "ru": "HRK" } }, { "value": "OTHER", "label": { "en": "Other", "ru": "Другое" } } ] }
    ]},
    { "id": "service_information", "order": 60, "title": { "en": "Service goal", "ru": "Цель обращения" }, "questions": [
      { "id": "service_goal", "type": "select", "order": 10, "label": { "en": "Service goal", "ru": "Цель обращения" }, "required": true, "options": [ { "value": "residence_permit", "label": { "en": "Residence permit", "ru": "ВНЖ" } }, { "value": "digital_nomad", "label": { "en": "Digital nomad", "ru": "Digital nomad" } }, { "value": "citizenship", "label": { "en": "Citizenship", "ru": "Гражданство" } }, { "value": "company_registration", "label": { "en": "Company registration", "ru": "Регистрация компании" } }, { "value": "consultation", "label": { "en": "Consultation", "ru": "Консультация" } }, { "value": "other", "label": { "en": "Other", "ru": "Другое" } } ] },
      { "id": "target_country", "type": "country", "order": 20, "label": { "en": "Target country", "ru": "Целевая страна" }, "required": true },
      { "id": "planned_arrival_date", "type": "date", "order": 30, "label": { "en": "Planned arrival date", "ru": "Планируемая дата приезда" } },
      { "id": "previous_applications", "type": "boolean", "order": 40, "label": { "en": "Previous applications", "ru": "Предыдущие заявки" } },
      { "id": "previous_refusal", "type": "boolean", "order": 50, "label": { "en": "Previous refusal", "ru": "Был отказ" } },
      { "id": "refusal_details", "type": "textarea", "order": 60, "label": { "en": "Refusal details", "ru": "Детали отказа" }, "visibleWhen": { "questionId": "previous_refusal", "operator": "equals", "value": true }, "validation": { "maxLength": 2000 } }
    ]},
    { "id": "additional_information", "order": 70, "title": { "en": "Additional information", "ru": "Дополнительные сведения" }, "questions": [
      { "id": "how_did_you_hear_about_us", "type": "select", "order": 10, "label": { "en": "How did you hear about us", "ru": "Как вы узнали о нас" }, "options": [ { "value": "referral", "label": { "en": "Referral", "ru": "Рекомендация" } }, { "value": "search", "label": { "en": "Search", "ru": "Поиск" } }, { "value": "social", "label": { "en": "Social media", "ru": "Соцсети" } }, { "value": "other", "label": { "en": "Other", "ru": "Другое" } } ] },
      { "id": "additional_notes", "type": "textarea", "order": 20, "label": { "en": "Additional notes", "ru": "Дополнительные заметки" }, "validation": { "maxLength": 5000 } },
      { "id": "data_accuracy_confirmation", "type": "boolean", "order": 30, "label": { "en": "I confirm the data is accurate", "ru": "Подтверждаю точность данных" }, "required": true },
      { "id": "privacy_acknowledgement", "type": "boolean", "order": 40, "label": { "en": "I acknowledge the privacy policy", "ru": "Ознакомлен(а) с политикой конфиденциальности" }, "required": true }
    ]}
  ]
}
$json$::jsonb;
  -- Canonical SHA-256 from TypeScript hashQuestionnaireSchema (deep-sorted keys).
  -- Do NOT derive from jsonb::text — that is not the shared contract.
  v_expected_schema_hash constant text :=
    '222a220a4f8ef5ddbdca34849ef57145208425060a9dfc12b5668132d40a24ac';
  v_existing_schema jsonb;
begin
  insert into public.questionnaire_templates (template_key, name, description, status)
  values ('general_client_onboarding', 'General client onboarding', 'Demo onboarding questionnaire', 'published')
  on conflict (template_key) do update
    set name = excluded.name,
        description = excluded.description,
        status = 'published',
        updated_at = now()
  returning id into v_template_id;

  select schema_hash, schema
    into v_existing_hash, v_existing_schema
  from public.questionnaire_template_versions
  where template_id = v_template_id and version = 1
  limit 1;

  if v_existing_hash is null then
    insert into public.questionnaire_template_versions (
      template_id, version, schema, schema_hash, status, published_at
    ) values (
      v_template_id, 1, v_schema, v_expected_schema_hash, 'published', now()
    );
  else
    if v_existing_schema is distinct from v_schema then
      raise exception 'questionnaire_template_version_schema_mismatch';
    end if;
    if v_existing_hash <> v_expected_schema_hash then
      raise exception 'questionnaire_template_version_hash_mismatch';
    end if;
  end if;
end;
$$;

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'questionnaire_templates',
    'questionnaire_template_versions',
    'client_questionnaires'
  )
order by table_name;
