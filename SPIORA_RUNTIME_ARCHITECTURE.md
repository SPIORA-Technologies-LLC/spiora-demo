# SPIORA — Runtime Architecture

**PR:** #14 — Production Foundation  
**Дата:** 15 июля 2026

---

## 1. Общая схема

```
Browser (React)
    │
    ▼
Next.js App Router — Server Components + API Routes
    │
    ├── Auth: JWT cookie (spiora_session) — Spiora Auth, не Supabase Auth
    │
    ├── RBAC: TypeScript permissions (owner | manager)
    │
    ▼
lib/*/store.ts  ──►  isSupabaseConfigured() ?
    │                        │
    │ yes                    │ no
    ▼                        ▼
lib/supabase/*-repo.ts    .data/ JSON  или  demo-data.ts / Google
    │
    ▼
getSupabaseAdmin()  →  SUPABASE_SERVICE_ROLE_KEY  →  PostgreSQL + Storage
```

**Anon key:** не используется.  
**Browser → Supabase:** прямого подключения нет.

---

## 2. Backend Matrix

| Module | Backend (Supabase on) | Auth | API / Store | Status |
|--------|----------------------|------|-------------|--------|
| **CRM Clients** | PostgreSQL `clients`, `client_notes` | Session + RBAC | `/api/clients*` → `clients/store.ts` | ✔ Primary Postgres |
| **Dashboard KPI** | PostgreSQL (clients, tasks, calendar, ai chats) | Session | `getCompanyHealthMetrics()` | ✔ Live (PR #14) |
| **Dashboard UI (priorities/activity)** | Static i18n seed | Session | `first-impression-seed.ts` | Demo narrative |
| **Tasks** | PostgreSQL `tasks` + Storage | Session + RBAC | `/api/tasks*` → `tasks/store.ts` | ✔ Dual-path |
| **Calendar** | PostgreSQL `calendar_*` | Session + RBAC | `/api/calendar/*` | ✔ Dual-path |
| **Team Chat** | PostgreSQL + Storage | Session | `/api/team-chat/*` | ✔ Dual-path |
| **Notifications** | PostgreSQL `notifications` | Session | `/api/notifications/*` | ✔ Dual-path |
| **AI Workspace** | PostgreSQL `ai_workspace_chats` | Session | `/api/ai-workspace/*` | ✔ Dual-path |
| **Presence** | PostgreSQL `user_presence` | Session | `/api/presence/*` | ✔ Dual-path |
| **Analytics Croatia** | PostgreSQL clients + `app_state` | Session owner | `/api/analytics/croatia` | ✔ Partial |
| **Formgrid / Leads** | Google Sheets | Session | `/api/formgrid-leads`, `/api/crm/leads` | Google off → empty |
| **Knowledge Base** | `.data` / Google Drive | Session | `/api/knowledge-base` | ✗ Not Postgres |
| **Documents** | Google Drive | — | — | ✗ Out of scope |
| **Emigrant Desk** | Separate Supabase | Session | emigrant-desk lib | Disabled in demo |
| **System Health** | Probes PostgreSQL/Storage | **Owner only** | `GET /api/system/health` | ✔ New (PR #14) |
| **Cron reminders** | PostgreSQL | `CRON_SECRET` | `/api/cron/calendar-reminders` | No session |
| **LiveKit webhook** | PostgreSQL | Webhook signature | `/api/webhooks/livekit` | No session |
| **Guest meet** | PostgreSQL guest tables | Guest token | `/api/meet/*` | No team session |

---

## 3. Service role vs anon

| Компонент | service_role | anon |
|-----------|--------------|------|
| `src/lib/supabase/server.ts` | ✔ единственный клиент | ✗ |
| API routes | ✗ (через store/repo) | ✗ |
| React components | ✗ | ✗ |
| Client bundle | ✗ (server-only) | ✗ |
| Supabase Dashboard SQL | ✔ (manual) | — |

---

## 4. Auth: Supabase vs Spiora

| Функция | Supabase Auth | Spiora Auth |
|---------|---------------|-------------|
| Login | ✗ | ✔ `signInAction` + bcrypt/env passwords |
| Session | ✗ | ✔ JWT `spiora_session` (jose) |
| Roles | ✗ | ✔ owner, manager |
| Consultant | ✗ | ✗ (запланировано) |
| RLS `auth.uid()` | ✗ | N/A до RLS PR |

---

## 5. Dashboard KPI sources (PR #14)

| KPI | Источник | Запрос / функция |
|-----|----------|------------------|
| **Clients** | PostgreSQL / legacy | `listAllClients()` → `clients` table |
| **Meetings (today)** | PostgreSQL | `calendar_events` range today UTC |
| **Tasks completed %** | PostgreSQL / `.data` | `getTaskStats()` |
| **AI conversations** | PostgreSQL / `.data` | `ai_workspace_chats` (30 days) |
| **Documents** | — | `0` (модуль вне Postgres scope) |
| **Empty state** | — | statusKey `empty` when no data |

При `SPIORA_ENABLE_SUPABASE=false` — fallback на `.data`/demo; KPI показывают **0** или file counts.

---

## 6. Health API

```
GET /api/system/health
Authorization: owner session cookie
```

```json
{
  "postgresql": "ok|degraded|error|disabled|unavailable",
  "storage": "ok|degraded|error|disabled|unavailable",
  "auth": "ok|error",
  "google": "ok|degraded|disabled|unavailable",
  "ai": "ok|disabled|unavailable",
  "version": "0.1.0"
}
```

Без URL, project ref, ключей.

---

## 7. ENV gates

| Flag | Эффект |
|------|--------|
| `SPIORA_DEMO_MODE=true` | Интеграции off by default |
| `SPIORA_ENABLE_SUPABASE=true` | PostgreSQL primary для store modules |
| `SPIORA_ENABLE_GOOGLE_INTEGRATIONS` | Sheets/Drive/Formgrid |
| `SPIORA_ENABLE_EXTERNAL_AI` | OpenRouter/OpenAI |
| `SPIORA_ALLOWED_SUPABASE_PROJECT_REFS` | Allowlist demo ref |

Подробнее: `.env.spiora.example`, `SPIORA_PRODUCTION_FOUNDATION_REPORT.md`.

---

## 8. Файлы PR #14

| Файл | Назначение |
|------|------------|
| `src/lib/system/system-health.ts` | Backend health probes |
| `src/lib/dashboard/company-health.ts` | Live Dashboard KPI |
| `src/app/api/system/health/route.ts` | Health API |
| `src/app/(app)/dashboard/page.tsx` | Wiring live metrics |
| `src/components/dashboard/FirstImpressionView.tsx` | Render live KPI |

RLS, Storage, UI redesign, deploy — **не изменялись**.
