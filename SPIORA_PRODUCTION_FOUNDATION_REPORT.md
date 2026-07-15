# SPIORA — Production Foundation Report

**PR:** #14 — Production Foundation (Supabase Security + Runtime)  
**Дата:** 15 июля 2026  
**Push / deploy / RLS:** не выполнялись

---

## Executive Summary

PR #14 укрепляет фундамент Spiora для SaaS-архитектуры **без новых продуктовых функций**:

- ✔ Полный аудит Supabase / Auth / service role
- ✔ Dashboard KPI переведены на **live PostgreSQL** (clients, calendar today, tasks, AI)
- ✔ Backend **System Health** + `GET /api/system/health` (owner-only)
- ✔ План RLS (`SPIORA_RLS_PLAN.md`) — без применения
- ✔ Runtime architecture documented
- ✔ Integration tests для foundation

---

## Этап 1 — Аудит Supabase

### Repositories (15 + core)

Все `*-repo.ts` используют `getSupabaseAdmin()` → **service_role**, `import "server-only"`.

| Repository | Таблица(ы) |
|------------|------------|
| `clients-repo` | clients |
| `client-notes-repo` | client_notes |
| `tasks-repo` | tasks |
| `team-chat-repo` | team_chat_messages, team_chat_last_seen |
| `workspace-chats-repo` | ai_workspace_chats |
| `notifications-repo` | notifications |
| `presence-repo` | user_presence |
| `calendar-events-repo` | calendar_events |
| `calendar-event-participants-repo` | calendar_event_participants |
| `calendar-reminder-deliveries-repo` | calendar_reminder_deliveries |
| `calendar-meeting-audit-repo` | calendar_meeting_audit |
| `calendar-meeting-guest-invites-repo` | calendar_meeting_guest_invites |
| `calendar-meeting-guest-admissions-repo` | calendar_meeting_guest_admissions |
| `calendar-meeting-recordings-repo` | calendar_meeting_recordings |
| `app-state` | app_state |

Storage (не repo, но service role): task-attachments, team-chat-*, meeting-recordings.

### Migrations

23 файла, **16 таблиц** (см. `SPIORA_RUNTIME_ARCHITECTURE.md`).

### API routes (61)

- **54** — `getSession()` (Spiora JWT)
- **7** — альтернативная auth (cron, webhooks, guest meet, locale)
- **0** — прямой import Supabase в routes (всё через `store.ts`)

### Backend Matrix

См. полную таблицу в `SPIORA_RUNTIME_ARCHITECTURE.md`.

---

## Этап 2 — RLS Readiness

Документ: **`SPIORA_RLS_PLAN.md`**

- Политики описаны для всех 16 таблиц + storage
- Роли: owner, manager, consultant (будущее), guest
- Migration order RLS-0 … RLS-5
- **RLS не применялся**

---

## Этап 3 — Service Role Audit

| Проверка | Результат |
|----------|-----------|
| `SUPABASE_SERVICE_ROLE_KEY` только server-side | ✔ PASS |
| `import "server-only"` на repos + health | ✔ PASS |
| React components импортируют repos | ✔ **0 нарушений** |
| Client bundle содержит service role | ✔ **Не найдено** |
| Anon key в коде | ✔ **Не используется** |

---

## Этап 4 — Auth Audit

| Аспект | Supabase | Spiora |
|--------|----------|--------|
| Login | — | `signInAction`, env passwords |
| Session | — | JWT cookie `spiora_session` |
| owner | — | ✔ archive CRM, analytics, settings |
| manager | — | ✔ CRM CRUD, no archive |
| consultant | — | ✗ **не реализован** |

**Дублирования ролей нет** — Supabase Auth не подключён.

---

## Этап 5 — Dashboard Live Metrics

| KPI | До PR #14 | После PR #14 |
|-----|-----------|--------------|
| Clients | hardcoded 126 | `listAllClients()` → PostgreSQL |
| Meetings | hardcoded 84 | `calendar_events` **сегодня** (UTC) |
| Tasks % | hardcoded 98% | `getTaskStats()` completed/total |
| AI dialogs | hardcoded 421 | `ai_workspace_chats` (30d) |
| Documents | hardcoded 3482 | **0** (модуль вне Postgres) |
| Empty state | — | statusKey `empty` + i18n hint |

**UI layout не менялся** — только источники чисел в Company Health block.

Приорities, AI insights, Team Activity — **остаются demo narrative** (static seed).

---

## Этап 6–7 — System Health + API

**Файл:** `src/lib/system/system-health.ts`

| Probe | Логика |
|-------|--------|
| postgresql | HEAD query `app_state` |
| storage | `storage.listBuckets()` |
| auth | `AUTH_SECRET` или dev fallback |
| google | disabled / credentials check |
| ai | disabled / API key check |

**API:** `GET /api/system/health` — **owner only**, JSON без секретов.

---

## Этап 8 — Environment Audit

### Demo (минимум)

| Variable | Обязательно |
|----------|-------------|
| `SPIORA_DEMO_MODE` | ✔ |
| `AUTH_SECRET`, `CRON_SECRET` | ✔ |
| `AUTH_PASSWORD_*` (4) | ✔ |
| `NEXT_PUBLIC_APP_URL` | ✔ |

### Demo + PostgreSQL CRM

| Variable | Обязательно |
|----------|-------------|
| `SPIORA_ENABLE_SUPABASE` | ✔ true |
| `SPIORA_ALLOWED_SUPABASE_PROJECT_REFS` | ✔ demo ref only |
| `NEXT_PUBLIC_SUPABASE_URL` | ✔ |
| `SUPABASE_SERVICE_ROLE_KEY` | ✔ server-only |

### Production (дополнительно)

| Variable | Примечание |
|----------|------------|
| `AUTH_SECRET` | **Обязателен** (no dev fallback) |
| `NODE_ENV=production` | |
| `SPIORA_DEMO_MODE` | false или unset |
| Integration flags | явно включать per module |

### Можно не задавать в demo CRM-only

| Variable | Причина |
|----------|---------|
| `SUPABASE_ANON_KEY` | не используется |
| Google * | `SPIORA_ENABLE_GOOGLE_INTEGRATIONS=false` |
| LiveKit * | off |
| OpenRouter * | off (canned AI) |

Обновлён: **`.env.spiora.example`**

---

## Этап 9 — Security Audit

| Вектор | Статус | Комментарий |
|--------|--------|-------------|
| SQL injection | ✔ Low risk | Supabase client parameterized; ILIKE escaped in clients-repo |
| RBAC | ✔ App layer | Enforced in API + permissions.ts; service role bypasses DB RLS |
| Mass assignment | ✔ | API routes whitelist fields (clients POST/PATCH) |
| Service role leakage | ✔ PASS | server-only, no client imports |
| Anon access | ✔ N/A | anon key unused |
| RLS readiness | ⚠ Planned | `SPIORA_RLS_PLAN.md` |
| JWT | ✔ | HS256, httpOnly cookie, 7d expiry |
| Storage | ✔ | Server-only uploads via API |
| Supabase URL exposure | ✔ | `NEXT_PUBLIC_SUPABASE_URL` only (expected); no keys in public env |
| Raw errors | ⚠ Partial | API returns i18n messages; logs may contain stack server-side |

---

## Этап 10 — Runtime Validation

При `SPIORA_ENABLE_SUPABASE=true`:

| Module | PostgreSQL | Google | .data |
|--------|------------|--------|-------|
| CRM | ✔ primary | ✗ | ✗ |
| Dashboard KPI | ✔ | ✗ | fallback if off |
| Tasks | ✔ | ✗ | fallback |
| Calendar | ✔ | ✗ | fallback |
| Team Chat | ✔ | ✗ | fallback |
| Notifications | ✔ | ✗ | fallback |
| AI Workspace | ✔ | ✗ | fallback |
| Knowledge Base | ✗ | optional | ✔ demo |
| Formgrid | ✗ | optional | — |
| Dashboard narrative | static seed | — | — |

---

## Этап 11 — Tests

| Test file | Покрытие |
|-----------|----------|
| `system-health.test.ts` | probes, no secrets in output |
| `production-foundation.test.ts` | server-only, no repo in components, health route, dashboard wiring, seed parity |
| `clients-postgres.test.ts` | seed consistency (existing) |

Команды: `npm test`, `npm run build` — см. результаты ниже.

---

## Новые файлы

```
src/lib/system/system-health.ts
src/lib/system/system-health.test.ts
src/lib/system/production-foundation.test.ts
src/lib/dashboard/company-health.ts
src/app/api/system/health/route.ts
SPIORA_PRODUCTION_FOUNDATION_REPORT.md
SPIORA_RUNTIME_ARCHITECTURE.md
SPIORA_RLS_PLAN.md
```

## Изменённые файлы

```
src/app/(app)/dashboard/page.tsx
src/components/dashboard/FirstImpressionView.tsx
src/lib/dashboard/stats.ts
src/i18n/dictionaries/en.json
src/i18n/dictionaries/ru.json
.env.spiora.example
package.json
```

---

## SAFE / NOT SAFE TO COMMIT

**SAFE TO COMMIT** — нет `.env.local`, ключей, URL demo project, `.data/`. Только server-side foundation + docs + i18n KPI labels.

**Push не выполнялся** (по инструкции PR).

---

*PR #14 завершён. RLS, Storage, deploy, KB, UI redesign не затронуты.*
