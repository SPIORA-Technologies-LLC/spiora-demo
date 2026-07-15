# SPIORA Supabase Gap Analysis

**Дата:** 15 июля 2026  
**Цель:** оценка готовности Supabase/PostgreSQL как основного хранилища.

---

## 1. Конфигурация и включение

| Компонент | Путь |
|-----------|------|
| Feature flag | `SPIORA_ENABLE_SUPABASE` |
| Demo policy | Off по умолчанию; allowlist project refs |
| Non-demo | Auto-enable при наличии URL + service role key |
| Client | `@supabase/supabase-js` via `createServerClient()` |
| Key used | **`SUPABASE_SERVICE_ROLE_KEY` only** — no anon key in app |
| Browser exposure | **None** — server-only imports |

**Файлы:**
- `src/lib/supabase/config.ts`
- `src/lib/supabase/server.ts`
- `src/lib/demo/integration-policy.ts`
- `src/lib/demo/environment-guard.ts`

---

## 2. SQL Migrations (21 файл)

| # | Migration | Таблицы / объекты |
|---|-----------|-------------------|
| 001 | bootstrap | `tasks`, indexes |
| 002 | team chat | `team_chat_messages`, `team_chat_last_seen` |
| 003 | AI workspace | `ai_workspace_chats` |
| 004 | client notes | `client_notes` |
| 005 | notifications | `notifications` |
| 006 | app state | `app_state` (KV JSON) |
| 007 | user presence | `user_presence` |
| 008 | calendar events | `calendar_events` |
| 009 | calendar reminders | `calendar_reminder_deliveries` |
| 010 | meeting audit | `calendar_meeting_audit` |
| 011 | event participants | `calendar_event_participants` |
| 012 | guest invites | `calendar_meeting_guest_invites` |
| 013 | guest admissions | `calendar_meeting_guest_admissions` |
| 014 | meeting recordings | `calendar_meeting_recordings` |
| 015–021 | storage policies, fixes | buckets, RLS on storage |

**Консолидация:** `SPIORA_SUPABASE_BOOTSTRAP.sql` (ручной bootstrap).

**Покрытие модулей миграциями:**

| Модуль | Таблица | Статус |
|--------|---------|--------|
| Tasks | `tasks` | ✅ |
| Team Chat | `team_chat_messages`, `team_chat_last_seen` | ✅ |
| AI chats | `ai_workspace_chats` | ✅ |
| Client Notes | `client_notes` | ✅ |
| Notifications | `notifications` | ✅ |
| Settings/passwords | `app_state` | ✅ (KV) |
| Presence | `user_presence` | ✅ |
| Calendar | `calendar_*` (6 tables) | ✅ |
| **CRM Clients** | — | ❌ **GAP** |
| **Knowledge Base** | — | ❌ **GAP** |
| **Auth Users** | — | ❌ **GAP** |
| **Lead Review** | — | ❌ (app_state only) |
| **Formgrid state** | — | ❌ (app_state only) |
| **Analytics** | — | ❌ |
| **Team roster** | — | ❌ (static TS) |

**Покрытие миграциями:** ~**58%** функциональных модулей (11 из 19).

---

## 3. Supabase Repositories

| Repo file | Table(s) | Dual-path store |
|-----------|----------|-----------------|
| `tasks-repo.ts` | tasks | `tasks/store.ts` |
| `team-chat-messages-repo.ts` | team_chat_messages | `team-chat/store.ts` |
| `team-chat-last-seen-repo.ts` | team_chat_last_seen | `team-chat/store.ts` |
| `ai-workspace-chats-repo.ts` | ai_workspace_chats | `ai/workspace-chats/store.ts` |
| `client-notes-repo.ts` | client_notes | `client-notes/store.ts` |
| `notifications-repo.ts` | notifications | `notifications/store.ts` |
| `app-state-repo.ts` | app_state | multiple consumers |
| `user-presence-repo.ts` | user_presence | `presence/store.ts` |
| `calendar-events-repo.ts` | calendar_events | `calendar/store.ts` |
| `calendar-event-participants-repo.ts` | calendar_event_participants | `calendar/store.ts` |
| `calendar-reminder-deliveries-repo.ts` | calendar_reminder_deliveries | Supabase-only |
| `calendar-meeting-audit-repo.ts` | calendar_meeting_audit | Supabase-only |
| `calendar-meeting-guest-*-repo.ts` | guest tables | Supabase-only |
| `calendar-meeting-recordings-repo.ts` | calendar_meeting_recordings | Supabase-only |

**Pattern:** `isSupabaseConfigured()` in store → repo or `.data`.

---

## 4. Storage Buckets

| Bucket | Назначение | File fallback |
|--------|------------|---------------|
| `task-attachments` | Task files | `.data/task-attachments/` |
| `team-chat-audio` | Voice messages | `.data/team-chat-audio/` |
| `team-chat-images` | Images | `.data/team-chat-images/` |
| `team-chat-files` | File attachments | `.data/team-chat-files/` |
| `meeting-recordings` | Meeting audio/video | `.data/meeting-recordings/` |

**RLS on storage:** partial — `meeting-recordings` has policy; others rely on server-side service role.

---

## 5. Auth: Supabase Auth vs Custom

| Аспект | Реализация |
|--------|------------|
| User identity | Static `TEAM_USERS` in `src/lib/auth/users.ts` |
| Session | Custom JWT in httpOnly cookie `spiora_session` |
| Passwords | Env vars + overrides in `app_state` / `.data` |
| Supabase Auth | **Не используется** |
| RLS with auth.uid() | **N/A** — no Supabase Auth |

**Server-only boundary:** API routes use `getSession()` from cookie; repos use service role (bypasses any future RLS unless using user-scoped client).

---

## 6. RLS и Access Control

| Объект | RLS |
|--------|-----|
| All public tables | **DISABLED** |
| Storage buckets | Partial (meeting-recordings) |
| App-level ACL | Role check in API (owner/manager/user) |
| Service role | **Full DB access** on every request |

**Риск обхода прав:**
- Service role in server = horizontal access if API route skips session check
- No org_id / tenant_id columns
- No RLS defense in depth

---

## 7. Supabase-only features (503 without config)

- Calendar meeting guest invites
- Guest admissions
- Meeting audit log
- Meeting recordings metadata + upload
- Calendar reminder deliveries

These **cannot** fall back to `.data` in current code.

---

## 8. Функции при `SPIORA_ENABLE_SUPABASE=true`

| Поведение | Изменение |
|-----------|-----------|
| Tasks, chat, notifications, notes, calendar events | Read/write Postgres |
| Attachments | Supabase Storage |
| Password overrides | `app_state` table |
| Deleted team users | `app_state` key |
| Lead review queue | Still `app_state` JSON |
| CRM clients | **Unchanged** — still Google/demo |
| Knowledge Base | **Unchanged** — Drive/`.data` |
| Auth | **Unchanged** — custom JWT |
| Analytics KPIs | **Unchanged** — demo-overview + CRM source |

---

## 9. Fallback на file

| Scenario | Behavior |
|----------|----------|
| Supabase off | All dual-path → `.data` |
| Supabase on, query error | Often empty array + console.error (inconsistent fallback) |
| Supabase-only routes | 503 |

---

## 10. Emigrant Desk (отдельный Supabase)

| Env | `SPIORA_ENABLE_EMIGRANT_DESK`, `EMIGRANT_SUPABASE_URL`, `EMIGRANT_SUPABASE_SERVICE_ROLE_KEY` |
| Tables | `profiles`, `cases` (inferred from repos) |
| Migrations in repo | **None** |
| Isolation | Separate project — good |

---

## 11. Gap Summary

### Critical Gaps

1. **No `clients` / `crm_leads` table** — CRM outside Postgres
2. **No RLS** on any application table
3. **Service role only** — no user-scoped Supabase client
4. **No Supabase Auth** — JWT custom, users in TS
5. **Knowledge Base** not in database

### High Gaps

6. Lead review in JSON blob (`app_state`)
7. Formgrid watch state not relational
8. No backup/restore documented
9. No multi-tenant org model
10. Analytics not persisted properly

### Medium Gaps

11. Inconsistent error handling (Supabase fail → empty vs throw)
12. Storage buckets without uniform RLS
13. No migration for Emigrant Desk in monorepo
14. `app_state` as catch-all KV (schema drift risk)

---

## 12. Ответ: станет ли PostgreSQL единственным основным хранилищем?

### После применения существующих миграций + `SPIORA_ENABLE_SUPABASE=true`

**Нет.**

### Что останется вне Supabase

| Данные | Текущее место |
|--------|---------------|
| CRM clients | Google Sheets / demo-data.ts |
| Knowledge Base content | Google Drive / `.data` JSON |
| Lead pipeline | Formgrid CSV + app_state |
| User roster | TypeScript static |
| Session/auth | Cookie JWT (not Supabase Auth) |
| Analytics overview KPIs | demo-overview.ts (static) |
| AI canned responses | TS scenarios |
| Browser prefs | localStorage |
| Emigrant Desk | External Supabase project |
| Optional Google export | Sheets (if kept for sync) |

### Что станет primary в Postgres

Tasks, calendar (core events), team chat, notifications, client notes (app copy), AI chat history, presence, meeting advanced features, password overrides, various KV in app_state.

---

## 13. Readiness Score

| Критерий | Оценка |
|----------|--------|
| Schema for operational data | 70% |
| Repos implemented | 65% |
| Production security (RLS, auth) | 15% |
| CRM in Postgres | 0% |
| KB in Postgres | 0% |
| Vercel-safe persistence (when enabled) | 85% for covered modules |
| **Overall Supabase readiness** | **~40%** for corp production |
| **Data layer ready for Supabase** | **~58%** modules have repo+migration |

---

## 14. Required additions (design only)

```sql
-- Not implemented — design reference
-- clients (id, org_id, name, email, phone, status, manager_id, ...)
-- crm_leads (id, source, payload, review_status, ...)
-- kb_articles (id, org_id, title, body, storage_path, ...)
-- users (id, org_id, email, role, password_hash, ...)
-- organizations (id, name, ...)
-- RLS policies per org_id
-- Supabase Auth or sync users table with JWT claims
```

---

*Анализ выполнен без применения миграций и без изменения кода.*
