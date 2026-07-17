-- =============================================================================
-- SPIORA_KNOWLEDGE_BASE_SEED_026.sql
-- PR #19 — 15 demo articles (EN + RU). Idempotent. No secrets.
-- Apply after migration 026. Do NOT auto-apply.
-- =============================================================================

insert into public.knowledge_base_articles (
  slug, category_id, tag_keys, author_key, status, updated_at, published_at
) values
  ('client-onboarding-checklist', 'client-workflow', array['onboarding', 'clients', 'workflow']::text[], 'daniel-cooper', 'published', '2026-06-15T10:00:00.000Z', '2026-06-15T10:00:00.000Z'),
  ('document-naming-rules', 'document-management', array['documents', 'templates']::text[], 'emma-wilson', 'published', '2026-05-20T14:30:00.000Z', '2026-05-20T14:30:00.000Z'),
  ('internal-communication-guidelines', 'company-policies', array['communication', 'compliance']::text[], 'olivia-bennett', 'published', '2026-04-10T09:00:00.000Z', '2026-04-10T09:00:00.000Z'),
  ('consultation-prep', 'client-workflow', array['clients', 'workflow']::text[], 'lucas-martin', 'published', '2026-06-01T11:15:00.000Z', '2026-06-01T11:15:00.000Z'),
  ('task-management-standards', 'team-onboarding', array['tasks', 'workflow']::text[], 'emma-wilson', 'published', '2026-03-25T16:00:00.000Z', '2026-03-25T16:00:00.000Z'),
  ('calendar-meeting-policy', 'company-policies', array['calendar', 'communication']::text[], 'olivia-bennett', 'published', '2026-02-14T08:45:00.000Z', '2026-02-14T08:45:00.000Z'),
  ('data-security-basics', 'company-policies', array['security', 'compliance']::text[], 'daniel-cooper', 'published', '2026-01-30T13:20:00.000Z', '2026-01-30T13:20:00.000Z'),
  ('working-with-ai-workspace', 'ai-automation', array['ai', 'workflow']::text[], 'daniel-cooper', 'published', '2026-06-20T15:00:00.000Z', '2026-06-20T15:00:00.000Z'),
  ('handling-uploaded-documents', 'document-management', array['documents', 'clients']::text[], 'lucas-martin', 'published', '2026-05-08T10:30:00.000Z', '2026-05-08T10:30:00.000Z'),
  ('escalation-procedure', 'company-policies', array['workflow', 'compliance']::text[], 'olivia-bennett', 'published', '2026-03-12T12:00:00.000Z', '2026-03-12T12:00:00.000Z'),
  ('team-member-onboarding', 'team-onboarding', array['onboarding', 'workflow']::text[], 'emma-wilson', 'published', '2026-02-28T09:30:00.000Z', '2026-02-28T09:30:00.000Z'),
  ('monthly-reporting-guide', 'document-management', array['reporting', 'templates']::text[], 'daniel-cooper', 'published', '2026-04-22T17:45:00.000Z', '2026-04-22T17:45:00.000Z'),
  ('client-intake-workflow', 'client-workflow', array['clients', 'workflow']::text[], 'lucas-martin', 'published', '2026-05-15T14:00:00.000Z', '2026-05-15T14:00:00.000Z'),
  ('standard-document-checklist', 'document-management', array['documents', 'clients', 'templates']::text[], 'emma-wilson', 'published', '2026-06-10T11:00:00.000Z', '2026-06-10T11:00:00.000Z'),
  ('quality-review-process', 'ai-automation', array['ai', 'compliance', 'workflow']::text[], 'olivia-bennett', 'published', '2026-06-05T10:15:00.000Z', '2026-06-05T10:15:00.000Z')
on conflict (slug) do update set
  category_id = excluded.category_id,
  tag_keys = excluded.tag_keys,
  author_key = excluded.author_key,
  status = excluded.status,
  updated_at = excluded.updated_at,
  published_at = excluded.published_at,
  archived_at = null;

insert into public.knowledge_base_article_translations (
  article_id, locale, title, summary, content
) values
  ((select id from knowledge_base_articles where slug = 'client-onboarding-checklist'), 'en', 'Client onboarding checklist', 'Step-by-step checklist for welcoming new mobility clients at Northstar Mobility.', '## Overview

Use this checklist during the first 72 hours after a client is assigned. The goal is consistent intake, clear expectations, and a complete CRM profile.

## Checklist

1. Confirm contact details and preferred language in CRM.
2. Send the welcome email with portal access instructions.
3. Schedule an intake call within 5 business days.
4. Create a task bundle: document collection, consultation prep, and follow-up.
5. Tag the case with direction (country/program) and urgency.

## Handoff

After intake, assign a primary manager and note any family members or dependents in the client file. Escalate missing identity documents within 24 hours.'),
  ((select id from knowledge_base_articles where slug = 'client-onboarding-checklist'), 'ru', 'Чек-лист онбординга клиента', 'Пошаговый чек-лист для приёма новых клиентов Northstar Mobility.', '## Обзор

Используйте этот чек-лист в первые 72 часа после назначения клиента. Цель — единообразный intake, понятные ожидания и полный профиль в CRM.

## Чек-лист

1. Подтвердите контакты и предпочитаемый язык в CRM.
2. Отправьте приветственное письмо с инструкциями по порталу.
3. Назначьте intake-звонок в течение 5 рабочих дней.
4. Создайте набор задач: сбор документов, подготовка к консультации, follow-up.
5. Отметьте направление (страна/программа) и срочность.

## Передача

После intake назначьте основного менеджера и укажите членов семьи в карточке клиента. Эскалируйте отсутствие документов в течение 24 часов.'),
  ((select id from knowledge_base_articles where slug = 'document-naming-rules'), 'en', 'Document naming rules', 'Standard file naming for client folders, scans, and internal templates.', '## Format

Use: `YYYY-MM-DD_ClientLastName_DocumentType_vN.ext`

Examples:
- `2026-06-01_Martins_Passport_v1.pdf`
- `2026-05-20_Rossi_ProofOfAddress_v2.pdf`

## Rules

- Always use ISO dates.
- No spaces — use underscores.
- Increment version suffix when replacing a file.
- Never include national ID numbers in filenames.

## Folders

Client folders follow `ClientLastName_FirstName_DEMO-ID`. Shared templates live under `/Templates` and must not be renamed.'),
  ((select id from knowledge_base_articles where slug = 'document-naming-rules'), 'ru', 'Правила именования документов', 'Стандарт именования файлов для папок клиентов, сканов и внутренних шаблонов.', '## Формат

Используйте: `YYYY-MM-DD_ФамилияКлиента_ТипДокумента_vN.ext`

Примеры:
- `2026-06-01_Martins_Passport_v1.pdf`
- `2026-05-20_Rossi_ProofOfAddress_v2.pdf`

## Правила

- Даты только в формате ISO.
- Без пробелов — используйте подчёркивания.
- Увеличивайте версию при замене файла.
- Не включайте номера удостоверений в имена файлов.

## Папки

Папки клиентов: `Фамилия_Имя_DEMO-ID`. Общие шаблоны — в `/Templates`, без переименования.'),
  ((select id from knowledge_base_articles where slug = 'internal-communication-guidelines'), 'en', 'Internal communication guidelines', 'How the Northstar Mobility team communicates about clients and cases.', '## Channels

- **Team Chat** — day-to-day coordination, quick updates.
- **CRM notes** — official case history; always log decisions here.
- **Email** — client-facing only; copy summaries to CRM.

## Client privacy

Do not share passport numbers, full addresses, or financial details in chat. Use client IDs and last names only.

## Response times

Managers should acknowledge @mentions within 4 business hours. Urgent escalations use the escalation procedure article.'),
  ((select id from knowledge_base_articles where slug = 'internal-communication-guidelines'), 'ru', 'Правила внутренней коммуникации', 'Как команда Northstar Mobility обсуждает клиентов и кейсы.', '## Каналы

- **Team Chat** — ежедневная координация и быстрые обновления.
- **Заметки CRM** — официальная история кейса; фиксируйте решения здесь.
- **Email** — только для клиентов; копируйте итоги в CRM.

## Конфиденциальность

Не передавайте в чате номера паспортов, полные адреса или финансовые данные. Используйте ID клиента и фамилию.

## Время ответа

Менеджеры отвечают на @упоминания в течение 4 рабочих часов. Срочные случаи — по процедуре эскалации.'),
  ((select id from knowledge_base_articles where slug = 'consultation-prep'), 'en', 'How to prepare for a client consultation', 'Pre-call checklist for immigration and mobility consultations.', '## Before the call

1. Review CRM status, open tasks, and uploaded documents.
2. Open the standard document checklist for the client''s direction.
3. Prepare 3 clarifying questions about timeline and dependents.
4. Confirm calendar invite and video link 24 hours ahead.

## During the call

Capture decisions as CRM notes. Assign follow-up tasks before ending the meeting.

## After the call

Send a summary email within one business day and update the client stage if needed.'),
  ((select id from knowledge_base_articles where slug = 'consultation-prep'), 'ru', 'Подготовка к консультации с клиентом', 'Чек-лист перед звонком по иммиграции и mobility.', '## До звонка

1. Проверьте статус в CRM, открытые задачи и загруженные документы.
2. Откройте стандартный чек-лист документов для направления клиента.
3. Подготовьте 3 уточняющих вопроса о сроках и иждивенцах.
4. Подтвердите приглашение и ссылку на видео за 24 часа.

## Во время звонка

Фиксируйте решения в заметках CRM. Назначьте follow-up до завершения.

## После звонка

Отправьте summary в течение одного рабочего дня и обновите этап клиента при необходимости.'),
  ((select id from knowledge_base_articles where slug = 'task-management-standards'), 'en', 'Task management standards', 'How to create, assign, and close tasks consistently across the team.', '## Creating tasks

Every task needs: owner, due date, linked client (if applicable), and a clear outcome.

## Priorities

- **High** — blocks client progress or legal deadline.
- **Medium** — standard workflow step.
- **Low** — internal improvement or optional follow-up.

## Closure

Close tasks only when the outcome is verifiable (document uploaded, call completed, approval received). Overdue tasks appear on the Analytics overview — review weekly.'),
  ((select id from knowledge_base_articles where slug = 'task-management-standards'), 'ru', 'Стандарты управления задачами', 'Как создавать, назначать и закрывать задачи единообразно.', '## Создание задач

У каждой задачи: ответственный, срок, связанный клиент (если есть) и понятный результат.

## Приоритеты

- **Высокий** — блокирует прогресс клиента или дедлайн.
- **Средний** — стандартный шаг процесса.
- **Низкий** — внутреннее улучшение или необязательный follow-up.

## Закрытие

Закрывайте задачи только при проверяемом результате. Просроченные задачи видны в Analytics — проверяйте еженедельно.'),
  ((select id from knowledge_base_articles where slug = 'calendar-meeting-policy'), 'en', 'Calendar and meeting policy', 'Scheduling rules for internal meetings and client consultations.', '## Client meetings

- Default length: 45 minutes for intake, 30 minutes for follow-ups.
- Always attach a video link and agenda in the invite.
- Recordings require client consent — see data security basics.

## Internal meetings

Team standups are Tue/Thu 10:00. Pipeline reviews are weekly; do not double-book client consultations over them.

## Time zones

Display client-local time in CRM notes when scheduling across regions.'),
  ((select id from knowledge_base_articles where slug = 'calendar-meeting-policy'), 'ru', 'Политика календаря и встреч', 'Правила планирования внутренних встреч и консультаций с клиентами.', '## Встречи с клиентами

- Intake: 45 минут, follow-up: 30 минут.
- Всегда добавляйте ссылку на видео и повестку.
- Запись — только с согласия клиента (см. основы безопасности данных).

## Внутренние встречи

Стендапы — вт/чт 10:00. Обзор pipeline — еженедельно; не пересекайте с консультациями.

## Часовые пояса

Указывайте локальное время клиента в заметках CRM.'),
  ((select id from knowledge_base_articles where slug = 'data-security-basics'), 'en', 'Data security basics', 'Minimum security practices for handling client documents and platform access.', '## Access

Use individual accounts only. Never share passwords or session links.

## Documents

Upload only through approved platform channels. Do not store client PDFs on personal drives.

## Demo environment

In public demo mode, all data is fictional. Never paste real client information into demo workspaces.

## Incidents

Report suspected data leaks to the owner immediately using the escalation procedure.'),
  ((select id from knowledge_base_articles where slug = 'data-security-basics'), 'ru', 'Основы безопасности данных', 'Минимальные практики при работе с документами клиентов и доступом к платформе.', '## Доступ

Только личные аккаунты. Не делитесь паролями и ссылками на сессии.

## Документы

Загружайте только через одобренные каналы платформы. Не храните PDF клиентов на личных дисках.

## Демо-среда

В публичном demo все данные вымышленные. Не вставляйте реальную информацию клиентов.

## Инциденты

Сообщайте о подозрительных утечках владельцу по процедуре эскалации.'),
  ((select id from knowledge_base_articles where slug = 'working-with-ai-workspace'), 'en', 'Working with AI Workspace', 'Safe use of AI Workspace with CRM, tasks, calendar, and Knowledge Base context.', '## Purpose

AI Workspace helps summarize cases, draft follow-ups, and answer questions using connected demo sources.

## Good prompts

- "Summarize today''s priorities"
- "Prepare a document checklist for Sofia Martins"
- "What meetings do I have this week?"

## Limits

AI responses in demo mode use canned and Knowledge Base context only — not production Google Drive. Always verify suggestions before sending to clients.'),
  ((select id from knowledge_base_articles where slug = 'working-with-ai-workspace'), 'ru', 'Работа с AI Workspace', 'Безопасное использование AI Workspace с CRM, задачами, календарём и базой знаний.', '## Назначение

AI Workspace помогает суммировать кейсы, готовить follow-up и отвечать на вопросы по подключённым demo-источникам.

## Хорошие запросы

- «Суммируй приоритеты на сегодня»
- «Подготовь чек-лист документов для Sofia Martins»
- «Какие встречи на этой неделе?»

## Ограничения

В demo ответы AI используют только canned-контекст и базу знаний — не production Google Drive. Проверяйте предложения перед отправкой клиенту.'),
  ((select id from knowledge_base_articles where slug = 'handling-uploaded-documents'), 'en', 'Handling uploaded documents', 'Review workflow for client uploads and scan quality checks.', '## Intake review

When a client uploads a document:

1. Verify filename follows naming rules.
2. Check readability (no cut-off edges, minimum 150 DPI for scans).
3. Match document type to checklist requirements.
4. Mark as accepted or request re-upload in CRM.

## Rejected uploads

Explain clearly what is wrong (blur, wrong document type, expired date). Never reject without a note.'),
  ((select id from knowledge_base_articles where slug = 'handling-uploaded-documents'), 'ru', 'Обработка загруженных документов', 'Процесс проверки загрузок клиентов и качества сканов.', '## Проверка intake

При загрузке документа клиентом:

1. Проверьте имя файла по правилам.
2. Оцените читаемость (без обрезанных краёв, минимум 150 DPI).
3. Сопоставьте тип с чек-листом.
4. Отметьте принято или запросите повторную загрузку в CRM.

## Отклонение

Чётко укажите причину (размытость, неверный тип, просроченная дата). Не отклоняйте без комментария.'),
  ((select id from knowledge_base_articles where slug = 'escalation-procedure'), 'en', 'Escalation procedure', 'When and how to escalate blocked cases or compliance concerns.', '## Level 1 — Manager

Blocked client progress for more than 3 business days.

## Level 2 — Owner

Compliance uncertainty, data incident, or client complaint.

## How to escalate

1. Document context in CRM (facts, dates, attempted actions).
2. Notify in Team Chat with @owner for Level 2.
3. Do not promise outcomes to the client until confirmed.

## Response SLA

Level 1: same business day. Level 2: within 4 hours.'),
  ((select id from knowledge_base_articles where slug = 'escalation-procedure'), 'ru', 'Процедура эскалации', 'Когда и как эскалировать заблокированные кейсы или вопросы compliance.', '## Уровень 1 — менеджер

Прогресс клиента заблокирован более 3 рабочих дней.

## Уровень 2 — владелец

Неопределённость по compliance, инцидент с данными или жалоба клиента.

## Как эскалировать

1. Зафиксируйте факты в CRM.
2. Уведомите в Team Chat с @owner для уровня 2.
3. Не обещайте клиенту результат до подтверждения.

## SLA

Уровень 1: в тот же рабочий день. Уровень 2: в течение 4 часов.'),
  ((select id from knowledge_base_articles where slug = 'team-member-onboarding'), 'en', 'Team member onboarding', 'First-week guide for new managers joining Northstar Mobility.', '## Day 1

Platform tour: CRM, Tasks, Calendar, Team Chat, Knowledge Base, AI Workspace.

## Week 1

Shadow two client consultations. Read Company Policies and Client Workflow categories.

## Week 2

Take a demo client case end-to-end with a buddy manager.

## Certification

Complete the data security quiz and confirm understanding of communication guidelines.'),
  ((select id from knowledge_base_articles where slug = 'team-member-onboarding'), 'ru', 'Адаптация нового сотрудника', 'Руководство на первую неделю для новых менеджеров Northstar Mobility.', '## День 1

Тур по платформе: CRM, Tasks, Calendar, Team Chat, база знаний, AI Workspace.

## Неделя 1

Посетите две консультации с наставником. Прочитайте категории «Политики компании» и «Работа с клиентами».

## Неделя 2

Проведите demo-кейс клиента end-to-end с buddy-менеджером.

## Сертификация

Пройдите тест по безопасности данных и подтвердите правила коммуникации.'),
  ((select id from knowledge_base_articles where slug = 'monthly-reporting-guide'), 'en', 'Monthly reporting guide', 'How to compile monthly activity reports for leadership review.', '## Metrics to include

- New clients and conversions by direction
- Consultations held vs scheduled
- Overdue tasks trend
- Document turnaround time (median days)

## Template

Use the monthly report template in Document Management. Export Analytics overview screenshots for the appendix.

## Deadline

Submit by the 3rd business day of the following month to olivia@spiora.demo (demo address).'),
  ((select id from knowledge_base_articles where slug = 'monthly-reporting-guide'), 'ru', 'Руководство по ежемесячной отчётности', 'Как собирать ежемесячные отчёты для руководства.', '## Метрики

- Новые клиенты и конверсии по направлениям
- Проведённые vs запланированные консультации
- Динамика просроченных задач
- Медианное время обработки документов

## Шаблон

Используйте шаблон отчёта из «Управление документами». Добавьте скриншоты Analytics.

## Срок

До 3-го рабочего дня следующего месяца на olivia@spiora.demo (demo-адрес).'),
  ((select id from knowledge_base_articles where slug = 'client-intake-workflow'), 'en', 'Client intake workflow', 'End-to-end flow from lead assignment to active case management.', '## Stages

1. **Lead review** — validate direction fit and budget signals.
2. **Assignment** — owner assigns primary manager.
3. **Intake call** — follow consultation prep checklist.
4. **Document collection** — use standard document checklist.
5. **Active case** — regular task cadence and calendar follow-ups.

## CRM hygiene

Every stage change needs a note explaining why. Missing notes block monthly reporting.'),
  ((select id from knowledge_base_articles where slug = 'client-intake-workflow'), 'ru', 'Процесс intake клиента', 'Путь от назначения лида до активного ведения кейса.', '## Этапы

1. **Обзор лида** — соответствие направлению и бюджету.
2. **Назначение** — владелец назначает менеджера.
3. **Intake-звонок** — по чек-листу подготовки.
4. **Сбор документов** — стандартный чек-лист.
5. **Активный кейс** — регулярные задачи и follow-up в календаре.

## CRM

Каждая смена этапа требует заметки с обоснованием. Без заметок блокируется месячная отчётность.'),
  ((select id from knowledge_base_articles where slug = 'standard-document-checklist'), 'en', 'Standard document checklist', 'Baseline documents requested for most mobility program applications.', '## Core documents

- Passport bio page (valid 6+ months)
- Proof of address (utility bill or bank statement, < 3 months)
- Employment or income proof
- Health insurance confirmation (where required)

## Optional

- Marriage/birth certificates for dependents
- Criminal record certificate (program-specific)

## Tracking

Mark each item in CRM as requested, received, or verified. Use Tasks for outstanding items.'),
  ((select id from knowledge_base_articles where slug = 'standard-document-checklist'), 'ru', 'Стандартный чек-лист документов', 'Базовый набор документов для большинства mobility-программ.', '## Основные документы

- Страница паспорта с данными (срок 6+ месяцев)
- Подтверждение адреса (< 3 месяцев)
- Подтверждение дохода или занятости
- Медстрахование (где требуется)

## Дополнительно

- Свидетельства о браке/рождении для иждивенцев
- Справка о несудимости (по программе)

## Учёт

Отмечайте в CRM: запрошено, получено, проверено. Для просроченного — задачи.'),
  ((select id from knowledge_base_articles where slug = 'quality-review-process'), 'en', 'Quality review process', 'Peer review steps before submitting client packages or AI-generated drafts.', '## When to review

- Before submitting a document package to authorities
- Before sending AI-drafted client emails
- After updating a Knowledge Base article (production only)

## Reviewer checklist

1. Facts match CRM and uploaded documents.
2. No internal jargon or demo placeholders in client text.
3. Dates and names are consistent.

## Demo note

In public demo, edits are read-only — use this process as reference only.'),
  ((select id from knowledge_base_articles where slug = 'quality-review-process'), 'ru', 'Процесс контроля качества', 'Peer review перед отправкой пакетов клиенту или черновиков от AI.', '## Когда проверять

- Перед подачей пакета документов
- Перед отправкой AI-черновиков клиенту
- После обновления статьи базы знаний (только production)

## Чек-лист рецензента

1. Факты совпадают с CRM и загруженными документами.
2. Нет внутреннего жаргона и demo-плейсхолдеров в тексте для клиента.
3. Даты и имена согласованы.

## Demo

В публичном demo редактирование недоступно — используйте процесс как справочник.')
on conflict (article_id, locale) do update set
  title = excluded.title,
  summary = excluded.summary,
  content = excluded.content,
  updated_at = now();

-- verification
select count(*) as articles from public.knowledge_base_articles;
select locale, count(*) as translations from public.knowledge_base_article_translations group by locale order by locale;
