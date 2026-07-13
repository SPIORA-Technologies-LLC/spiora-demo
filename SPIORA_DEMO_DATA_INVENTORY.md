# SPIORA — Demo Data Inventory

**Дата:** 11 июля 2026  
**PR:** #10 Full Demo Readiness Audit

---

## Архитектура хранения

| Слой | Путь / механизм | Когда используется |
|------|-----------------|-------------------|
| **Static TypeScript seeds** | `src/lib/**/demo-*.ts`, `demo-data.ts` | Demo mode, in-memory |
| **`.data/*.json`** | `process.cwd()/.data/` (gitignored) | Supabase off |
| **Supabase** | `src/lib/supabase/*-repo.ts` | `SPIORA_ENABLE_SUPABASE=true` |
| **i18n dictionaries** | `en.json` / `ru.json` | Локализация demo-контента |
| **localStorage** | UI prefs only | Client-side |
| **Cookie** | `SPIORA_LOCALE` | Locale |
| **In-memory runtime** | `demoNotesExtra[]`, rate limits | Ephemeral |

**Центральный флаг:** `SPIORA_DEMO_MODE=true` + `integration-policy.ts`.

**Global reset:** ❌ не реализован. Только `resetDemoKnowledgeBaseStore()` для KB.

---

## Карта `.data/` stores

| Файл | Модуль |
|------|--------|
| `.data/tasks.json` | Tasks |
| `.data/calendar-events.json` | Calendar |
| `.data/calendar-event-participants.json` | Calendar participants |
| `.data/notifications.json` | Notifications |
| `.data/team-chat-messages.json` | Team chat |
| `.data/team-chat-last-seen.json` | Team chat unread |
| `.data/team-chat-{images,audio,files}/` | Chat media |
| `.data/ai-workspace-chats/{userId}.json` | AI chats |
| `.data/knowledge-base.json` | Knowledge Base |
| `.data/client-notes.json` | Notes (Sheets fallback) |
| `.data/platform-user-passwords.json` | Settings passwords |
| `.data/team-deleted-users.json` | Team soft-delete |
| `.data/user-presence.json` | Presence |
| `.data/analytics-croatia-supplement.json` | Analytics Croatia |
| `.data/task-attachments/` | Task files |
| `.data/meeting-recordings/` | Recordings |
| `.data/formgrid-lead-reviews.json` | Lead Review |
| `.data/formgrid-known-leads.json` | Formgrid watcher |

**Vercel:** `.data/` эфемерен — теряется при redeploy.

---

## Модульная матрица

### Users

| | |
|--|--|
| **Источник** | `src/lib/auth/users.ts` — 4 fictional users |
| **Auto-seed** | Нет (compile-time) |
| **i18n** | Roles via `roles.ts` |
| **Mutability** | Password override → `.data/platform-user-passwords.json` (blocked in demo) |
| **Persistence** | Password hashes only |
| **Reset** | Delete password store → env defaults |
| **Pollution risk** | 🟢 Low |

### Clients (CRM)

| | |
|--|--|
| **Источник** | `src/lib/google-sheets/demo-data.ts` — **12 clients** DEMO-1001…1012 |
| **Auto-seed** | Нет — static TS |
| **i18n** | EN field values |
| **Mutability** | Read-only |
| **Persistence** | None |
| **Reset** | N/A |
| **Pollution risk** | 🟢 Low · 🔴 High if Google Sheets enabled |

### Notes

| | |
|--|--|
| **Источник** | 2 static in `demo-data.ts` + `demoNotesExtra[]` in-memory |
| **Auto-seed** | 2 static notes |
| **i18n** | EN text |
| **Mutability** | Append supported |
| **Persistence** | **Demo: in-memory only** — lost on restart |
| **Reset** | Restart clears user notes |
| **Pollution risk** | 🟡 Medium — user notes ephemeral |

### Tasks

| | |
|--|--|
| **Источник** | **No demo seed** |
| **Auto-seed** | ❌ |
| **i18n** | User content; UI not localized |
| **Mutability** | Full CRUD + attachments |
| **Persistence** | `.data/tasks.json` |
| **Reset** | Delete file |
| **Pollution risk** | 🟡 Medium — accumulates user data; **empty on fresh demo** |

### Calendar

| | |
|--|--|
| **Источник** | `demo-events.ts` — **28 templates** |
| **Auto-seed** | ✅ empty/missing JSON + no Supabase (**не требует demo flag!**) |
| **i18n** | `demo:{key}` → `calendar.demoEvents.*` |
| **Mutability** | Full CRUD persisted |
| **Persistence** | `.data/calendar-events.json` |
| **Reset** | Delete file → reseed with new UUIDs |
| **Pollution risk** | 🟡 Stale file blocks reseed; seeds outside demo flag |

### Notifications

| | |
|--|--|
| **Источник** | `demo-notifications.ts` — **13 templates/user** |
| **Auto-seed** | ✅ demo mode + no Supabase + no rows for user |
| **i18n** | Full EN/RU via emit-messages |
| **Mutability** | Read/delete + runtime creates |
| **Persistence** | `.data/notifications.json` |
| **Reset** | Delete file |
| **Pollution risk** | 🟢 Per-user idempotent |

### Team Chat

| | |
|--|--|
| **Источник** | `demo-messages.ts` — **27 messages** |
| **Auto-seed** | ✅ demo + empty store |
| **i18n** | `demo:{key}` → teamChat.demoMessages |
| **Mutability** | Send/upload/delete + rate limits |
| **Persistence** | `.data/team-chat-messages.json` + media dirs |
| **Reset** | Delete messages file |
| **Pollution risk** | 🟡 User messages persist |

### AI Chats

| | |
|--|--|
| **Источник** | User sessions only; responses from `workspace-demo-scenarios.ts` |
| **Auto-seed** | ❌ no pre-built sessions |
| **i18n** | Canned EN/RU |
| **Mutability** | Create/delete chats |
| **Persistence** | `.data/ai-workspace-chats/{userId}.json` |
| **Reset** | Delete user files |
| **Pollution risk** | 🟡 User history accumulates |

### Knowledge Base

| | |
|--|--|
| **Источник** | `demo-articles.ts` — **15 slugs**; content in i18n |
| **Auto-seed** | ✅ demo + empty store |
| **i18n** | Full EN/RU (149 keys) |
| **Mutability** | 🔒 Read-only in demo |
| **Persistence** | `.data/knowledge-base.json` |
| **Reset** | `resetDemoKnowledgeBaseStore()` |
| **Pollution risk** | 🟢 Low — read-only |

### Analytics

| | |
|--|--|
| **Overview** | `demo-overview.ts` — synthetic KPIs (demo-only API) |
| **Croatia** | Live from CRM + supplement file |
| **Auto-seed** | Overview: per-request; supplement: default JSON |
| **i18n** | Overview ✅; supplement consulate names **hardcoded RU** |
| **Mutability** | Read-only |
| **Persistence** | Supplement file only |
| **Reset** | N/A overview; delete supplement file |
| **Pollution risk** | 🟡 Croatia filter `"Хорватия"` vs demo `"Croatia"` → sparse charts |

### Team

| | |
|--|--|
| **Источник** | `users.ts` minus soft-deletes |
| **Presence** | Runtime timestamps, no seed |
| **Auto-seed** | None |
| **i18n** | Names EN; roles i18n |
| **Mutability** | Soft-delete blocked in demo |
| **Persistence** | `.data/team-deleted-users.json`, presence |
| **Reset** | Delete deleted-users file |
| **Pollution risk** | 🟢 Low |

### Settings

| | |
|--|--|
| **Источник** | branding, integrations status, passwords |
| **Auto-seed** | None |
| **i18n** | ✅ Full |
| **Mutability** | Password reset blocked; locale via cookie |
| **Persistence** | Password hashes, cookie, localStorage sound |
| **Reset** | Demo guards |
| **Pollution risk** | 🟢 Low |

---

## Demo seed files (TypeScript)

| Файл | Записей |
|------|---------|
| `demo-data.ts` | 12 clients + docs/surveys |
| `demo-events.ts` | 28 calendar events |
| `demo-messages.ts` | 27 chat messages |
| `demo-notifications.ts` | 13 notification templates |
| `demo-articles.ts` | 15 KB articles |
| `demo-overview.ts` | 7 KPIs + charts |

---

## Auto-seed summary

| Модуль | Auto-seed | Условие |
|--------|-----------|---------|
| Users | ❌ | Static |
| Clients | ❌ | Static TS |
| Notes | Partial | 2 static |
| Tasks | ❌ | **Empty — блокер UX** |
| Calendar | ✅ | Empty JSON |
| Notifications | ✅ | Demo + empty per user |
| Team chat | ✅ | Demo + empty |
| AI chats | ❌ | User-driven |
| KB | ✅ | Demo + empty |
| Analytics overview | N/A | Computed |
| Team/Settings | ❌ | — |

---

## Риски загрязнения demo

| # | Риск | Severity | Mitigation (planned) |
|---|------|----------|---------------------|
| 1 | `.data/` persists между сессиями — накопление user edits | Medium | PR #13 reset |
| 2 | Vercel redeploy wipes `.data/` — inconsistent UX | High | PR #14 demo Supabase |
| 3 | Tasks empty on first visit | High | PR #12 unified seed |
| 4 | Calendar seeds without demo flag | Medium | PR #11 guard |
| 5 | Client notes in-memory only | Low | Document / seed |
| 6 | Stale `.data/` blocks reseed | Medium | Reset API |
| 7 | Google Sheets enable → prod data leak | Critical | Keep integrations off |
| 8 | Croatia analytics direction mismatch | Low | Fix filter or seed |

---

## Связь с `SPIORA_DEMO_DATA_PLAN.md`

| Planned | Status |
|---------|--------|
| Unified seed runner | ❌ |
| Supabase SQL seeds | ❌ |
| `/api/demo/reset` | ❌ |
| 8–12 KB articles | ✅ 15 |
| Demo AI sessions (2 saved) | ❌ |
| Demo tasks seed | ❌ |
