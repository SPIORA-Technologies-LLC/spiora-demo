# SPIORA Data Storage Audit

**Проект:** Spiora Demo (`spiora-demo`)  
**Дата аудита:** 15 июля 2026  
**Тип:** read-only технический аудит (код, конфигурация, миграции не изменялись)  
**Главный вопрос:** использует ли Spiora Supabase/PostgreSQL как основное хранилище или фактически зависит от Google Sheets, `.data` и fallback-механизмов?

---

## Краткий вердикт

| Вопрос | Ответ |
|--------|--------|
| PostgreSQL — основное хранилище **сейчас**? | **Нет** (в типичном demo-деплое на Vercel) |
| PostgreSQL — основное хранилище **после** `SPIORA_ENABLE_SUPABASE=true`? | **Частично** (~55–60% модулей по объёму операционных данных) |
| Google Sheets — фактическая CRM-база в prod-конфигурации? | **Да**, если включены Google-интеграции |
| `.data` — фактическое хранилище в default demo? | **Да** |
| Можно продавать как «PostgreSQL-based platform» сегодня? | **Нет** без оговорок и доработок |

---

## 1. Карта всех источников данных

### 1.1 Supabase / PostgreSQL

| Параметр | Значение |
|----------|----------|
| **Включение** | `SPIORA_ENABLE_SUPABASE=true` + URL + `SUPABASE_SERVICE_ROLE_KEY`; в demo mode дополнительно allowlist `SPIORA_ALLOWED_SUPABASE_PROJECT_REFS` |
| **Конфиг** | `src/lib/supabase/config.ts`, `src/lib/demo/integration-policy.ts`, `src/lib/demo/environment-guard.ts` |
| **Клиент** | `src/lib/supabase/server.ts` — только **service_role**, server-only |
| **Миграции** | `supabase/migrations/001`–`021`, консолидация `SPIORA_SUPABASE_BOOTSTRAP.sql` |
| **Таблицы (15)** | `tasks`, `team_chat_messages`, `team_chat_last_seen`, `ai_workspace_chats`, `client_notes`, `notifications`, `app_state`, `user_presence`, `calendar_events`, `calendar_reminder_deliveries`, `calendar_meeting_audit`, `calendar_event_participants`, `calendar_meeting_guest_invites`, `calendar_meeting_guest_admissions`, `calendar_meeting_recordings` |
| **Storage (5 bucket)** | `task-attachments`, `team-chat-audio`, `team-chat-images`, `team-chat-files`, `meeting-recordings` |
| **RLS на таблицах** | **Не включён** |
| **Demo mode** | По умолчанию **выключен** |
| **Production mode** | При `SPIORA_DEMO_MODE=false` — включён автоматически (если есть ключи) |
| **Роль** | Основное хранилище **только когда явно включено**; иначе не используется |
| **Персистентность на Vercel** | **Да** |
| **Риски** | Service role = полный доступ к БД; утечка ключа = компрометация всех данных |

**Отдельный проект Emigrant Desk:** `SPIORA_ENABLE_EMIGRANT_DESK` + `EMIGRANT_SUPABASE_*` → таблицы `profiles`, `cases` (`src/lib/emigrant-desk/`). Миграций в этом репозитории нет.

---

### 1.2 Google Sheets

| Параметр | Значение |
|----------|----------|
| **Включение** | `SPIORA_ENABLE_GOOGLE_INTEGRATIONS=true` (в demo off по умолчанию); при `SPIORA_DEMO_MODE=false` — on если заданы credentials |
| **Конфиг** | `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SHEETS_FORMGRID_SPREADSHEET_ID`, ranges, SA: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` |
| **Код** | `src/lib/google-sheets/*` |
| **Demo mode** | Fallback на `demo-data.ts` |
| **Production mode** | **Primary CRM** при настроенных credentials |
| **Запись** | Заметки (опционально), append клиента из Lead Review (`CRM_WRITE_*`), `updateClientField` (dead code — API не вызывает) |
| **Персистентность Vercel** | **Да** (внешний Google) |
| **Риски** | SA с scope `spreadsheets` (read/write); публичный CSV export без SA |

---

### 1.3 Google Drive

| Параметр | Значение |
|----------|----------|
| **Конфиг** | `GOOGLE_DRIVE_KB_FOLDER_ID`, `GOOGLE_DRIVE_EMIGRANT_FOLDER_ID` |
| **Код** | `src/lib/google-drive/kb-drive.ts`, `kb-text.ts`, `drive-content.ts` |
| **Demo mode** | KB → demo articles в `.data` |
| **Production mode** | KB listing + AI context из Drive |
| **Запись** | **Нет** (readonly scope) |
| **Риски** | Утечка folder ID; AI получает текст документов |

---

### 1.4 Локальная папка `.data/`

| Параметр | Значение |
|----------|----------|
| **Путь** | `process.cwd()/.data/` (gitignored) |
| **Demo mode** | **Primary**, когда Supabase off |
| **Production mode** | Fallback при Supabase off |
| **Персистентность Vercel** | **Нет** — ephemeral filesystem |
| **Риски** | Потеря данных при redeploy/cold start; рассинхрон между serverless-инстансами |

**JSON-файлы:** `tasks.json`, `calendar-events.json`, `calendar-event-participants.json`, `team-chat-messages.json`, `team-chat-last_seen.json`, `notifications.json`, `client-notes.json`, `knowledge-base.json`, `user-presence.json`, `platform-user-passwords.json`, `team-deleted-users.json`, `formgrid-lead-reviews.json`, `formgrid-known-leads.json`, `formgrid-watch-last-run.json`, `analytics-croatia-supplement.json`, `ai-workspace-chats/{userId}.json`

**Бинарные каталоги:** `task-attachments/`, `team-chat-images/`, `team-chat-audio/`, `team-chat-files/`, `meeting-recordings/`

---

### 1.5 TypeScript demo seed (in-memory → `.data`)

| Источник | Потребитель | Запись |
|----------|-------------|--------|
| `demo-tasks.ts` | `tasks/store.ts` | → `.data/tasks.json` |
| `demo-events.ts` | `calendar/store.ts` | → `.data/calendar-events.json` |
| `demo-messages.ts` | `team-chat/store.ts` | → `.data/team-chat-messages.json` |
| `demo-articles.ts` | `knowledge-base/store.ts` | → `.data/knowledge-base.json` |
| `demo-notifications.ts` | `notifications/store.ts` | → `.data/notifications.json` |
| `demo-data.ts` (clients) | `google-sheets/service.ts` | In-memory; notes в `demoNotesExtra[]` |
| `demo-overview.ts` | Analytics API | Без persistence |

---

### 1.6 In-memory store

| Модуль | Назначение | Vercel |
|--------|------------|--------|
| `google-sheets/cache.ts` | TTL-кэш Sheets/Drive | Ephemeral |
| `workspace-demo-rate-limit.ts` | Rate limit AI | Ephemeral |
| `team-chat/demo-rate-limit.ts` | Rate limit чата | Ephemeral |
| `login-rate-limit.ts` | Rate limit login (demo) | Ephemeral |
| `mobile-nav-intro.ts` | Флаг intro nav | Ephemeral (per full load) |

---

### 1.7 localStorage / sessionStorage / cookies

| Хранилище | Ключи | Модули |
|-----------|-------|--------|
| localStorage | `calendar:layers`, `ai-workspace-*`, `ss-notification-sound-enabled` | Calendar UI, AI Workspace, notifications |
| sessionStorage | `spiora-boot-splash-seen`, `ss-meeting-dock-*` | Boot splash, meeting dock |
| Cookie `spiora_session` | JWT сессия (7d, httpOnly) | Auth |
| Cookie `SPIORA_LOCALE` | Локаль UI | i18n |

**На Vercel:** только client-side; не shared между пользователями.

---

### 1.8 Static mock / canned AI

| Источник | Использование |
|----------|---------------|
| `workspace-demo-scenarios.ts` | Canned ответы AI в demo |
| `workspace-demo-safe.ts` | Блокировка diagnostics |
| `workspace-assistant.ts` | Demo path без OpenRouter |
| `TEAM_USERS` в `auth/users.ts` | Статический roster |

---

### 1.9 API fallback / dual-path pattern

Паттерн во всех operational stores:

```
isSupabaseConfigured() ? supabase-repo : read/write .data JSON
```

При ошибке Supabase часть модулей логирует ошибку и возвращает пустой массив (не всегда fallback на file).

---

## 2. Аудит по модулям

| Модуль | Чтение из | Запись в | Demo mode | Supabase ready | Google dependency | Persistent on Vercel |
|--------|-----------|----------|-----------|----------------|-------------------|---------------------|
| **Auth / Users** | TS `users.ts`, env passwords, `.data`/app_state overrides | app_state / `.data` passwords | Demo users + env | Частично (passwords only) | Нет | Cookie да; overrides — только с Supabase |
| **CRM / Clients** | Google Sheets **или** `demo-data.ts` | Sheets append (lead sync) | Demo clients | **Нет** (нет таблицы clients) | **Да** (prod) | Sheets да; demo — нет |
| **Client Notes** | Sheets / local / Supabase | local / Sheets / Supabase | Demo notes | **Да** (`client_notes`) | Опционально | С Supabase да |
| **Tasks** | Supabase **или** `.data` | Supabase **или** `.data` + attachments | Demo seed | **Да** | Нет | С Supabase да |
| **Calendar** | Supabase **или** `.data` | Supabase **или** `.data` | Demo events | **Да** (events + meeting subsystems) | Нет | С Supabase да; guest/recording — **только** Supabase |
| **Notifications** | Supabase **или** `.data` | Supabase **или** `.data` | Demo seed | **Да** | Formgrid watch → Google | С Supabase да |
| **Team Chat** | Supabase **или** `.data` | Supabase **или** `.data` + media dirs | Demo messages | **Да** | Нет | С Supabase да |
| **AI Workspace** | Context: Google/demo; chats: Supabase/`.data` | Chats Supabase/`.data` | Canned AI | Chats **да**; context **нет** | **Да** (context) | Chats с Supabase да |
| **AI chat history** | `ai_workspace_chats` / `.data/ai-workspace-chats/` | То же | Per-user file | **Да** | Нет | С Supabase да |
| **Knowledge Base** | `.data` demo **или** Google Drive | `.data` (demo reset) | Demo articles | **Нет** | **Да** (prod listing) | Drive да; `.data` — нет |
| **Analytics** | CRM clients + demo-overview + app_state supplement | app_state supplement | Demo KPIs | **Нет** | **Да** (Croatia from CRM) | Supplement с Supabase |
| **Team** | Static `users.ts` − app_state deleted | app_state deleted IDs | Static roster | **Нет** (нет users table) | Нет | Deleted IDs с Supabase |
| **Settings** | Env + integration status | Password reset → app_state | Read-only demo | Passwords only | Status only | С Supabase |
| **Meeting recordings** | Supabase + bucket / `.data` | Supabase **required** for prod feature | 503 без Supabase | **Да** (metadata+storage) | Нет | Supabase only |
| **Lead Review** | Formgrid (Google CSV) + app_state reviews | app_state + optional Sheets append | Empty queue | **Нет** (app_state JSON) | **Да** | app_state с Supabase |
| **Formgrid** | Google public CSV | Нет | Empty | **Нет** | **Да** | Google |
| **Emigrant Desk** | External Supabase | External Supabase | Off by default | Отдельный проект | Нет | External Supabase |

### Пути при `SPIORA_ENABLE_SUPABASE=true`

- Tasks, Calendar (events), Team Chat, Notifications, Presence, Client Notes, AI chats → **PostgreSQL**
- Meeting guest/audit/recordings/reminder deliveries → **PostgreSQL** (без file fallback)
- CRM Clients → **по-прежнему Google Sheets** (или demo)
- Knowledge Base → **Drive или `.data`**
- Lead Review → **Formgrid + app_state**
- Auth users → **static TS**

### При недоступности Supabase

- Dual-path модули → fallback на `.data` (локально) или пустые данные / ошибки
- Supabase-only features → **503** («not configured»)
- CRM → Google или demo (не зависит от Supabase)

---

## 3. Google Sheets и Google Drive — сводка

См. отдельный отчёт `SPIORA_GOOGLE_DEPENDENCY_REPORT.md`.

**Ответ:** Spiora **может работать без Google** в default demo (`SPIORA_ENABLE_GOOGLE_INTEGRATIONS=false`). **Не может** полноценно работать как prod CRM без Google или без миграции клиентов в PostgreSQL.

---

## 4. Supabase / PostgreSQL — сводка

См. `SPIORA_SUPABASE_GAP_ANALYSIS.md`.

**Ответ:** После миграций и `SPIORA_ENABLE_SUPABASE=true` PostgreSQL **не станет единственным** хранилищем. Вне Supabase останутся: **CRM clients**, **Knowledge Base**, **Formgrid/Lead pipeline**, **static auth users**, **Emigrant Desk** (отдельный проект), **canned AI**, **browser storage**.

---

## 5. Поведение на Vercel

| Категория | Примеры | Verdict |
|-----------|---------|---------|
| **Блокирует production** | `.data/` как primary; multi-instance file writes; CRM только в Sheets без SLA | Critical для corp client |
| **Допустимо для demo fallback** | Demo seeds при первом read; in-memory rate limits | OK с оговоркой |
| **Безопасно статическим** | i18n JSON, demo TS seeds (read-only), PWA assets | OK |

**Локально «работает», на Vercel «ломается»:** tasks/calendar/chat/notifications/attachments после пользовательских изменений без Supabase; password overrides; lead review state; KB edits.

---

## 6. Потоки данных

См. `SPIORA_DATA_FLOW_MAP.md`.

---

## 7. Безопасность — сводка рисков

| Уровень | Кол-во | Примеры |
|---------|--------|---------|
| **Critical** | 4 | Service role без RLS; CRM PII в Google Sheets; ephemeral `.data` на Vercel как primary; SA private key scope spreadsheets write |
| **High** | 6 | Нет таблицы clients в Postgres; guest meeting tokens; debug diagnostics (скрыты в demo); horizontal access через service role; Formgrid CSV bypass integration flag; public CSV export |
| **Medium** | 8 | Password overrides в app_state JSON; AI context leakage; KB Drive traversal (частично mitigated); logs с client IDs; no backup strategy; team roster static; lead review in JSON blob |
| **Low** | 5 | localStorage prefs; sessionStorage splash; demo rate limits ephemeral; analytics supplement defaults |

Детали: `PLATFORM_SECURITY_AUDIT.md`, `AI_GUARDRAILS_AND_SECURITY_AUDIT.md` (существующие документы репозитория).

---

## 8. Архитектурный вердict

| Вопрос | Ответ |
|--------|--------|
| Где основная база клиентов? | **Google Sheets** (prod) / **`demo-data.ts`** (demo) |
| Где задачи? | **`.data/tasks.json`** (default) / **`tasks` table** (Supabase on) |
| Где календарь? | **`.data/calendar-events.json`** / **`calendar_events`** |
| Где Team Chat? | **`.data/team-chat-*`** / **Supabase** |
| Где Knowledge Base? | **`.data/knowledge-base.json`** (demo) / **Google Drive** (prod) |
| Где AI history? | **`.data/ai-workspace-chats/`** / **`ai_workspace_chats`** |
| Demo без Google? | **Да** |
| Vercel без потери данных? | **Только с Supabase enabled** |
| Готовность к corp client? | **Нет** — dual-path, no RLS, CRM outside Postgres |
| Обязательно до public prod | Supabase mandatory; clients in Postgres; RLS/hardening; убрать `.data` primary on Vercel |

---

## 9. Целевая архитектура

См. `SPIORA_DATA_MIGRATION_ROADMAP.md`.

---

## 10. Метрики готовности (оценка)

| Метрика | Значение |
|---------|----------|
| Данные с Supabase-repo + migration | **~58%** операционных модулей |
| Модули с зависимостью от `.data` (default path) | **~70%** |
| Модули с зависимостью от Google (prod path) | **~35%** (CRM, Formgrid, KB, AI context, Analytics) |
| Production blockers | **7** (см. roadmap) |
| Critical риски | **4** |
| High риски | **6** |
| PostgreSQL-based platform **сейчас**? | **Нет** |
| Рекомендуемый следующий PR | Миграция `clients` + `crm_leads` в Postgres, mandatory Supabase на Vercel |
| Время до отказа от Google as primary | **6–10 недель** (1 FTE backend), см. roadmap |

---

*Аудит выполнен без изменений кода, env, миграций и деплоя.*
