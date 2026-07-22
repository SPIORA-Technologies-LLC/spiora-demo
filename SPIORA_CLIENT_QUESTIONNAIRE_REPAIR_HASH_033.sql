-- =============================================================================
-- SPIORA_CLIENT_QUESTIONNAIRE_REPAIR_HASH_033.sql
-- One-shot staging repair: fix schema_hash for general_client_onboarding / v1 only.
-- Does NOT modify schema JSON. Does NOT bump version.
-- Idempotent. Manual SQL Editor only.
-- =============================================================================

drop table if exists pg_temp.spiora_repair_033_result;
create temporary table pg_temp.spiora_repair_033_result (
  repair_result text not null
);

do $$
declare
  v_expected_schema_hash constant text := '222a220a4f8ef5ddbdca34849ef57145208425060a9dfc12b5668132d40a24ac';
  v_expected_schema jsonb := $json$
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
  v_count integer;
  v_version_id uuid;
  v_status text;
  v_schema jsonb;
  v_hash text;
  v_result text;
  v_updated integer;
begin
  select count(*)
    into v_count
  from public.questionnaire_templates qt
  join public.questionnaire_template_versions qtv
    on qtv.template_id = qt.id
  where qt.template_key = 'general_client_onboarding'
    and qtv.version = 1;

  if v_count = 0 then
    raise exception 'repair_failed_template_version_not_found';
  end if;
  if v_count > 1 then
    raise exception 'repair_failed_multiple_template_versions';
  end if;

  select qtv.id, qtv.status, qtv.schema, qtv.schema_hash
    into v_version_id, v_status, v_schema, v_hash
  from public.questionnaire_templates qt
  join public.questionnaire_template_versions qtv
    on qtv.template_id = qt.id
  where qt.template_key = 'general_client_onboarding'
    and qtv.version = 1;

  if v_status is distinct from 'published' then
    raise exception 'repair_failed_version_not_published';
  end if;

  if v_schema is distinct from v_expected_schema then
    raise exception 'repair_failed_schema_semantic_mismatch';
  end if;

  if v_hash = v_expected_schema_hash then
    v_result := 'ALREADY_REPAIRED';
  else
    -- Published rows are guarded; temporarily disable only this trigger.
    execute 'alter table public.questionnaire_template_versions disable trigger questionnaire_template_versions_guard';

    update public.questionnaire_template_versions
      set schema_hash = v_expected_schema_hash
    where id = v_version_id
      and version = 1
      and status = 'published'
      and schema is not distinct from v_expected_schema;

    get diagnostics v_updated = row_count;

    execute 'alter table public.questionnaire_template_versions enable trigger questionnaire_template_versions_guard';

    if v_updated <> 1 then
      raise exception 'repair_failed_update_did_not_match_row';
    end if;

    v_result := 'REPAIR_APPLIED';
  end if;

  insert into pg_temp.spiora_repair_033_result (repair_result)
  values (v_result);
end;
$$;

select repair_result from pg_temp.spiora_repair_033_result;
