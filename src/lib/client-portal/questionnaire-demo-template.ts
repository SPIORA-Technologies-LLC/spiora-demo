import type { QuestionnaireSchema } from "./questionnaire-types";

/** Published demo template v1 — general_client_onboarding (PR #31). */
export const GENERAL_CLIENT_ONBOARDING_SCHEMA: QuestionnaireSchema = {
  schemaVersion: 1,
  templateKey: "general_client_onboarding",
  title: {
    en: "Client questionnaire",
    ru: "Анкета клиента",
  },
  description: {
    en: "Complete the information below. You can save and continue later.",
    ru: "Заполните информацию ниже. Вы можете сохранить и продолжить позже.",
  },
  sections: [
    {
      id: "welcome",
      order: 5,
      title: { en: "Welcome", ru: "Добро пожаловать" },
      description: {
        en: "Please complete all sections. You can save and continue later.",
        ru: "Пожалуйста, заполните все разделы. Можно сохранять и продолжить позже.",
      },
      questions: [
        {
          id: "welcome_info",
          type: "information",
          order: 20,
          label: {
            en: "Your answers are saved automatically. You can return anytime.",
            ru: "Ответы сохраняются автоматически. Вы можете вернуться в любое время.",
          },
        },
      ],
    },
    {
      id: "personal_information",
      order: 10,
      title: { en: "Personal information", ru: "Личные данные" },
      questions: [
        { id: "first_name", type: "text", order: 10, label: { en: "First name", ru: "Имя" }, required: true, validation: { minLength: 1, maxLength: 100 } },
        { id: "last_name", type: "text", order: 20, label: { en: "Last name", ru: "Фамилия" }, required: true, validation: { minLength: 1, maxLength: 100 } },
        { id: "patronymic", type: "text", order: 25, label: { en: "Patronymic (if applicable)", ru: "Отчество" }, validation: { maxLength: 100 } },
        { id: "previous_names", type: "text", order: 30, label: { en: "Previous surname", ru: "Прежняя фамилия" }, validation: { maxLength: 200 } },
        { id: "date_of_birth", type: "date", order: 40, label: { en: "Date of birth", ru: "Дата рождения" }, required: true },
        { id: "place_of_birth", type: "text", order: 50, label: { en: "Place of birth", ru: "Место рождения" }, validation: { maxLength: 200 } },
        { id: "passport_number", type: "text", order: 52, label: { en: "Passport number", ru: "Номер паспорта" }, required: true, validation: { minLength: 1, maxLength: 40 } },
        { id: "passport_issue_date", type: "date", order: 54, label: { en: "Date of passport issue", ru: "Дата выдачи паспорта" }, required: true },
        { id: "citizenship", type: "country", order: 60, label: { en: "Citizenship", ru: "Гражданство" }, required: true },
        { id: "other_citizenships", type: "text", order: 70, label: { en: "Other citizenships", ru: "Другие гражданства" }, validation: { maxLength: 200 } },
        {
          id: "gender",
          type: "select",
          order: 80,
          label: { en: "Gender", ru: "Пол" },
          options: [
            { value: "female", label: { en: "Female", ru: "Женский" } },
            { value: "male", label: { en: "Male", ru: "Мужской" } },
            { value: "other", label: { en: "Other", ru: "Другое" } },
            { value: "prefer_not", label: { en: "Prefer not to say", ru: "Предпочитаю не указывать" } },
          ],
        },
        {
          id: "marital_status",
          type: "select",
          order: 90,
          label: { en: "Marital status", ru: "Семейное положение" },
          options: [
            { value: "single", label: { en: "Single", ru: "Холост/не замужем" } },
            { value: "married", label: { en: "Married", ru: "В браке" } },
            { value: "divorced", label: { en: "Divorced", ru: "В разводе" } },
            { value: "widowed", label: { en: "Widowed", ru: "Вдовец/вдова" } },
          ],
        },
      ],
    },
    {
      id: "contact_information",
      order: 20,
      title: { en: "Contact information", ru: "Контактные данные" },
      questions: [
        {
          id: "email",
          type: "email",
          order: 10,
          label: { en: "Email", ru: "Email" },
          required: true,
          readOnly: true,
          derivedFrom: "portal_email",
        },
        { id: "phone", type: "phone", order: 20, label: { en: "Phone", ru: "Телефон" }, required: true },
        { id: "country_of_residence", type: "country", order: 30, label: { en: "Country of residence", ru: "Страна проживания" }, required: true },
        { id: "postal_code", type: "text", order: 40, label: { en: "Postal code", ru: "Почтовый индекс" }, required: true, validation: { maxLength: 20 } },
        { id: "city", type: "text", order: 50, label: { en: "City", ru: "Город" }, required: true, validation: { maxLength: 120 } },
        { id: "address", type: "textarea", order: 60, label: { en: "Address", ru: "Адрес" }, required: true, validation: { maxLength: 500 } },
        {
          id: "preferred_contact_method",
          type: "select",
          order: 70,
          label: { en: "Preferred contact method", ru: "Предпочтительный способ связи" },
          options: [
            { value: "email", label: { en: "Email", ru: "Email" } },
            { value: "phone", label: { en: "Phone", ru: "Телефон" } },
          ],
        },
        {
          id: "preferred_language",
          type: "select",
          order: 80,
          label: { en: "Preferred language", ru: "Предпочтительный язык" },
          options: [
            { value: "en", label: { en: "English", ru: "Английский" } },
            { value: "ru", label: { en: "Russian", ru: "Русский" } },
          ],
        },
      ],
    },
    {
      id: "family",
      order: 30,
      title: { en: "Family", ru: "Семья" },
      description: {
        en: "If you do not have a spouse, partner, or children, you can skip this section and continue.",
        ru: "Если у вас нет супруга, партнёра или детей — этот раздел можно пропустить и перейти дальше.",
      },
      questions: [
        {
          id: "spouse_or_partner",
          type: "boolean",
          order: 10,
          label: { en: "Spouse or partner", ru: "Супруг/партнёр" },
        },
        {
          id: "spouse_name",
          type: "text",
          order: 20,
          label: { en: "Spouse name", ru: "Имя супруга/партнёра" },
          visibleWhen: { questionId: "spouse_or_partner", operator: "equals", value: true },
          validation: { maxLength: 200 },
        },
        {
          id: "has_children",
          type: "boolean",
          order: 30,
          label: { en: "Has children", ru: "Есть дети" },
        },
        {
          id: "number_of_children",
          type: "number",
          order: 40,
          label: { en: "Number of children", ru: "Количество детей" },
          visibleWhen: { questionId: "has_children", operator: "equals", value: true },
          validation: { min: 0, max: 20, integer: true },
        },
        {
          id: "dependants_notes",
          type: "textarea",
          order: 50,
          label: { en: "Dependants notes", ru: "Примечания об иждивенцах" },
          validation: { maxLength: 2000 },
        },
      ],
    },
    {
      id: "education",
      order: 40,
      title: { en: "Education", ru: "Образование" },
      questions: [
        {
          id: "highest_education",
          type: "select",
          order: 10,
          label: { en: "Highest education", ru: "Высшее образование" },
          options: [
            { value: "secondary", label: { en: "Secondary", ru: "Среднее" } },
            { value: "bachelor", label: { en: "Bachelor", ru: "Бакалавр" } },
            { value: "master", label: { en: "Master", ru: "Магистр" } },
            { value: "doctorate", label: { en: "Doctorate", ru: "Докторантура" } },
            { value: "other", label: { en: "Other", ru: "Другое" } },
          ],
        },
      ],
    },
    {
      id: "employment",
      order: 50,
      title: { en: "Employment", ru: "Работа" },
      questions: [
        {
          id: "employment_status",
          type: "select",
          order: 10,
          label: { en: "Employment status", ru: "Статус занятости" },
          required: true,
          options: [
            { value: "employed", label: { en: "Employed", ru: "Работаю" } },
            { value: "self_employed", label: { en: "Self-employed", ru: "Самозанятый" } },
            { value: "unemployed", label: { en: "Unemployed", ru: "Безработный" } },
            { value: "student", label: { en: "Student", ru: "Студент" } },
            { value: "retired", label: { en: "Retired", ru: "Пенсионер" } },
          ],
        },
        {
          id: "employer_name",
          type: "text",
          order: 20,
          label: { en: "Employer name", ru: "Название работодателя" },
          visibleWhen: { questionId: "employment_status", operator: "equals", value: "employed" },
          validation: { maxLength: 200 },
        },
        { id: "occupation", type: "text", order: 30, label: { en: "Occupation", ru: "Профессия" }, validation: { maxLength: 200 } },
        { id: "monthly_income", type: "number", order: 40, label: { en: "Monthly income", ru: "Ежемесячный доход" }, validation: { min: 0 } },
        {
          id: "income_currency",
          type: "select",
          order: 50,
          label: { en: "Income currency", ru: "Валюта дохода" },
          options: [
            { value: "EUR", label: { en: "€ Euro", ru: "€ Евро" } },
            { value: "USD", label: { en: "$ US Dollar", ru: "$ Доллар США" } },
            { value: "RUB", label: { en: "₽ Ruble", ru: "₽ Рубль" } },
            { value: "KZT", label: { en: "₸ Tenge", ru: "₸ Тенге" } },
            { value: "OTHER", label: { en: "Other", ru: "Другое" } },
          ],
        },
      ],
    },
    {
      id: "service_information",
      order: 60,
      title: { en: "Service goal", ru: "Цель обращения" },
      questions: [
        {
          id: "service_goal",
          type: "select",
          order: 10,
          label: { en: "Type of service", ru: "Тип услуги" },
          required: true,
          options: [
            { value: "residence_permit", label: { en: "Residence permit", ru: "ВНЖ" } },
            { value: "digital_nomad", label: { en: "Digital nomad", ru: "Цифровой кочевник" } },
            { value: "citizenship", label: { en: "Citizenship", ru: "Гражданство" } },
            { value: "company_registration", label: { en: "Company registration", ru: "Регистрация компании" } },
            { value: "consultation", label: { en: "Consultation", ru: "Консультация" } },
            { value: "other", label: { en: "Other", ru: "Другое" } },
          ],
        },
        { id: "target_country", type: "country", order: 20, label: { en: "Target country", ru: "Целевая страна" }, required: true },
        { id: "planned_arrival_date", type: "date", order: 30, label: { en: "Planned arrival date", ru: "Планируемая дата приезда" } },
        {
          id: "previous_applications",
          type: "boolean",
          order: 40,
          label: { en: "Previous applications", ru: "Предыдущие заявки" },
        },
        {
          id: "previous_refusal",
          type: "boolean",
          order: 50,
          label: { en: "Previous refusal", ru: "Был отказ" },
        },
        {
          id: "refusal_details",
          type: "textarea",
          order: 60,
          label: { en: "Refusal details", ru: "Детали отказа" },
          visibleWhen: { questionId: "previous_refusal", operator: "equals", value: true },
          validation: { maxLength: 2000 },
        },
      ],
    },
    {
      id: "document_copies",
      order: 65,
      title: { en: "Document copies", ru: "Копии документов" },
      description: {
        en: "Attach scans or photos of supporting documents. PDF and images are preferred.",
        ru: "Прикрепите сканы или фото документов. Предпочтительны PDF и изображения.",
      },
      questions: [
        {
          id: "documents_intro",
          type: "information",
          order: 5,
          label: {
            en: "Please upload copies where available: passport biodata page, employment contract, and a recent bank statement.",
            ru: "По возможности загрузите копии: разворот паспорта, трудовой договор и свежую банковскую выписку.",
          },
        },
        {
          id: "doc_passport_page",
          type: "file",
          order: 10,
          label: {
            en: "Passport biodata page",
            ru: "Первая страница / разворот паспорта",
          },
          description: {
            en: "PDF or photo of the passport page with your photo and personal data.",
            ru: "PDF или фото страницы паспорта с фото и личными данными.",
          },
        },
        {
          id: "doc_employment_contract",
          type: "file",
          order: 20,
          label: {
            en: "Employment contract",
            ru: "Трудовой / рабочий контракт",
          },
          description: {
            en: "PDF or photo of your current employment or service contract.",
            ru: "PDF или фото действующего трудового или сервисного договора.",
          },
        },
        {
          id: "doc_bank_statement",
          type: "file",
          order: 30,
          label: {
            en: "Bank statement",
            ru: "Выписка из банковского счёта",
          },
          description: {
            en: "A recent account statement (PDF or clear photo).",
            ru: "Недавняя выписка по счёту (PDF или чёткое фото).",
          },
        },
        {
          id: "doc_other",
          type: "file",
          order: 40,
          label: {
            en: "Other supporting document",
            ru: "Другой подтверждающий документ",
          },
          description: {
            en: "Optional: any other PDF, photo, or Office file that helps your case.",
            ru: "По желанию: любой другой PDF, фото или файл Office по вашему делу.",
          },
        },
      ],
    },
    {
      id: "additional_information",
      order: 70,
      title: { en: "Additional information", ru: "Дополнительные сведения" },
      questions: [
        {
          id: "how_did_you_hear_about_us",
          type: "select",
          order: 10,
          label: { en: "How did you hear about us", ru: "Как вы узнали о нас" },
          options: [
            { value: "referral", label: { en: "Referral", ru: "Рекомендация" } },
            { value: "search", label: { en: "Search", ru: "Поиск" } },
            { value: "social", label: { en: "Social media", ru: "Соцсети" } },
            { value: "other", label: { en: "Other", ru: "Другое" } },
          ],
        },
        { id: "additional_notes", type: "textarea", order: 20, label: { en: "Additional notes", ru: "Дополнительные заметки" }, validation: { maxLength: 5000 } },
        {
          id: "data_accuracy_confirmation",
          type: "boolean",
          order: 30,
          label: { en: "I confirm the data is accurate", ru: "Подтверждаю точность данных" },
          required: true,
        },
        {
          id: "privacy_acknowledgement",
          type: "boolean",
          order: 40,
          label: { en: "I acknowledge the privacy policy", ru: "Ознакомлен(а) с политикой конфиденциальности" },
          required: true,
        },
      ],
    },
    {
      id: "consulting_agreement",
      order: 80,
      title: {
        en: "Consulting services agreement",
        ru: "Договор о консультационных услугах",
      },
      description: {
        en: "Open the agreement, review the terms, and confirm your consent. Your personal details are filled in from the questionnaire.",
        ru: "Откройте договор, ознакомьтесь с условиями и подтвердите согласие. Ваши данные подставляются из анкеты автоматически.",
      },
      questions: [
        {
          id: "consulting_agreement_intro",
          type: "information",
          order: 10,
          label: {
            en: "The agreement below is filled in from your answers. You do not need to type anything in the contract — only confirm the terms.",
            ru: "Договор ниже заполняется из ваших ответов. В самом договоре ничего вводить не нужно — достаточно подтвердить условия.",
          },
        },
        {
          id: "consulting_agreement_acknowledgement",
          type: "boolean",
          order: 20,
          label: {
            en: "I confirm all terms of the consulting services agreement",
            ru: "Подтверждаю все пункты договора о консультационных услугах",
          },
          required: true,
          validation: { mustBeTrue: true },
        },
      ],
    },
  ],
};

export const GENERAL_CLIENT_ONBOARDING_TEMPLATE_KEY = "general_client_onboarding";
