# SPIORA — Route Inventory

**Дата:** 11 июля 2026  
**PR:** #10 Full Demo Readiness Audit  
**Ветка:** `main` @ `ba7ce4b`

---

## Сводка

| Категория | Количество |
|-----------|------------|
| Страницы (pages) | **23** |
| API routes | **61** |
| Cron | **1** |
| Webhooks | **1** |
| Debug / diagnostic | **2** |
| PWA manifest | **1** |
| Server actions (login) | **2** |
| **Итого HTTP-маршрутов** | **88** |

**Auth:** cookie JWT `spiora_session`, роли `owner` / `manager`.  
**Middleware:** защищает **страницы**, не `/api/*`. API — per-route `getSession()`.  
**Demo:** `SPIORA_DEMO_MODE=true` → интеграции off по умолчанию (`integration-policy.ts`).

---

## Легенда

| Колонка | Значения |
|---------|----------|
| **i18n** | ✅ полностью · ⚠️ частично · ❌ нет |
| **Demo** | ✅ работает · ⚠️ ограничено · ❌ требует prod · 🔒 read-only |
| **Ext** | внешний сервис |
| **Public demo** | безопасен для публичного demo |
| **Рекомендация** | ✅ оставить · ⚠️ скрыть · ❌ отключить · 🛠 dev-only |

---

## 1. Страницы (23)

| Route | Файл | Назначение | RBAC | i18n | Demo | Ext | Public demo | Рекомендация |
|-------|------|------------|------|------|------|-----|-------------|--------------|
| `/` | `src/app/page.tsx` | Redirect → dashboard/login | Public | — | ✅ | — | ✅ | ✅ |
| `/login` | `src/app/login/page.tsx` | Вход | Public | ✅ | ✅ | — | ✅ | ✅ |
| `/join/[token]` | `src/app/join/[token]/page.tsx` | Guest video join | Public | ⚠️ | ⚠️ LiveKit off | LiveKit | ⚠️ | ⚠️ скрыть без LiveKit |
| `/dashboard` | `(app)/dashboard/page.tsx` | Главная | Manager+ | ✅ | ✅ demo stats | Sheets* | ✅ | ✅ |
| `/clients` | `(app)/clients/page.tsx` | CRM список | Manager+ | ✅ | ✅ static 12 clients | Sheets* | ✅ | ✅ |
| `/clients/[id]` | `(app)/clients/[id]/page.tsx` | Карточка клиента | Manager+ | ✅ | ✅ | Sheets* | ✅ | ✅ |
| `/new-formgrid-clients` | `(app)/new-formgrid-clients/page.tsx` | Formgrid таблица | Manager+ | ❌ | ⚠️ empty без Sheets | Sheets* | ⚠️ mixed lang | ⚠️ скрыть или i18n |
| `/crm` | `(app)/crm/page.tsx` | Redirect → `/clients` | Manager+ | — | ✅ | — | ✅ | ✅ |
| `/crm/leads` | `(app)/crm/leads/page.tsx` | Lead Review queue | Manager+ | ❌ | ⚠️ | Sheets* | ⚠️ | ⚠️ скрыть в public demo |
| `/crm/leads/[id]` | `(app)/crm/leads/[id]/page.tsx` | Lead detail | Manager+ | ❌ | ⚠️ | Sheets* | ⚠️ | ⚠️ скрыть в public demo |
| `/ai-workspace` | `(app)/ai-workspace/page.tsx` | AI assistant | Manager+ | ✅ | ✅ canned AI | AI* | ✅ | ✅ |
| `/knowledge-base` | `(app)/knowledge-base/page.tsx` | База знаний | Manager+ | ✅ | 🔒 15 demo articles | — | ✅ | ✅ |
| `/tasks` | `(app)/tasks/page.tsx` | Задачи | Manager+ | ❌ | ⚠️ empty seed | Supabase/local | ⚠️ empty + RU | ⚠️ i18n + seed |
| `/tasks/new` | `(app)/tasks/new/page.tsx` | Создание задачи | Manager+ | ❌ | ✅ CRUD | local | ⚠️ | ⚠️ i18n |
| `/calendar` | `(app)/calendar/page.tsx` | Календарь | Manager+ | ✅ | ✅ 28 demo events | local | ✅ | ✅ |
| `/calendar/meet/[eventId]` | `(app)/calendar/meet/[eventId]/page.tsx` | Staff video room | Session | ⚠️ | ⚠️ LiveKit off | LiveKit | ⚠️ | ⚠️ demo gate |
| `/meeting-recordings` | `(app)/meeting-recordings/page.tsx` | Записи встреч | Manager+ | ❌ | ⚠️ empty | LiveKit* | ⚠️ | ⚠️ скрыть без LiveKit |
| `/team-chat` | `(app)/team-chat/page.tsx` | Team Chat | Manager+ | ✅ | ✅ 27 messages | local | ✅ | ✅ |
| `/relocation` | `(app)/relocation/page.tsx` | Emigration links | Manager+ | ⚠️ | ✅ static | — | ⚠️ RU chrome | ⚠️ i18n chrome |
| `/checkups-erevan` | `(app)/checkups-erevan/page.tsx` | Checkups links | Manager+ | ⚠️ | ✅ static | — | ⚠️ RU chrome | ⚠️ i18n / скрыть |
| `/analytics` | `(app)/analytics/page.tsx` | Analytics | **Owner** | ✅ | ✅ demo overview | Sheets* | ✅ owner demo | ✅ |
| `/team` | `(app)/team/page.tsx` | Команда | Manager+ | ✅ | ✅ | presence | ✅ | ✅ |
| `/settings` | `(app)/settings/page.tsx` | Настройки | **Owner** | ✅ | 🔒 preview | — | ✅ | ✅ |

\* Sheets / Supabase / LiveKit / AI — только при явном `SPIORA_ENABLE_*=true`.

---

## 2. API routes (61)

### 2.1 Служебные

| Route | Methods | Auth | Demo | Ext | Public demo | Рекомендация |
|-------|---------|------|------|-----|-------------|--------------|
| `/api/locale` | POST | **None** | ✅ | — | ✅ low risk | ✅ |
| `/api/presence` | GET | Session | ✅ | local | ✅ | ✅ |
| `/api/presence/heartbeat` | POST | Session | ✅ | local | ✅ | ✅ |

### 2.2 Notifications (4)

| Route | Methods | Auth | Demo | Ext | Public demo | Рекомендация |
|-------|---------|------|------|-----|-------------|--------------|
| `/api/notifications` | GET | Session | ✅ 13 seed/user | formgrid watch* | ✅ | ✅ |
| `/api/notifications/[id]` | PATCH, DELETE | Session (own) | ✅ | — | ✅ | ✅ |
| `/api/notifications/read-all` | POST, DELETE | Session | ✅ | — | ✅ | ✅ |

### 2.3 Clients & CRM (9)

| Route | Methods | Auth | Role | Demo | Ext | Public demo | Рекомендация |
|-------|---------|------|------|------|-----|-------------|--------------|
| `/api/clients` | GET | Session | — | ✅ demo-data.ts | Sheets* | ✅ | ✅ |
| `/api/clients/filters` | GET | Session | — | ✅ | Sheets* | ✅ | ✅ |
| `/api/clients/[id]` | GET | Session | — | ✅ | Sheets* | ✅ | ✅ |
| `/api/clients/[id]/notes` | POST | Session | — | ⚠️ mem-only | Sheets/local | ✅ | ✅ |
| `/api/clients/[id]/ai` | POST | Session | — | ✅ demo AI | AI* | ✅ | ✅ |
| `/api/formgrid-leads` | GET | Session | — | ⚠️ | Sheets* | ⚠️ | ⚠️ |
| `/api/crm/leads` | GET | Session | — | ⚠️ | Sheets+local | ⚠️ | ⚠️ dev/internal |
| `/api/crm/leads/[id]` | GET, PATCH | Session | — | ⚠️ write | Sheets | ❌ RBAC gap | ⚠️ guard in demo |

### 2.4 Tasks (6)

| Route | Methods | Auth | RBAC | Demo | Public demo | Рекомендация |
|-------|---------|------|------|------|-------------|--------------|
| `/api/tasks` | GET, POST | Session | partial | ✅ local | ✅ | ✅ |
| `/api/tasks/[id]` | GET,PUT,PATCH,DELETE | Session | task ACL | ✅ | ✅ | ✅ |
| `/api/tasks/[id]/attachments` | POST | Session | ACL | ✅ local fs | ⚠️ upload | ✅ + limits |
| `/api/tasks/[id]/attachments/[attachmentId]` | GET, DELETE | Session | ACL | ✅ | ✅ | ✅ |
| `/api/tasks/[id]/progress-reports` | POST | Session | assignee | ✅ | ✅ | ✅ |
| `/api/tasks/[id]/progress-reports/[reportId]` | DELETE | Session | ACL | ✅ | ✅ | ✅ |

### 2.5 Calendar & meetings (14)

| Route | Methods | Auth | Demo | Ext | Public demo | Рекомендация |
|-------|---------|------|------|-----|-------------|--------------|
| `/api/calendar/events` | GET, POST | Session | ✅ seed | local | ✅ | ✅ |
| `/api/calendar/events/[id]` | GET,PATCH,DELETE | Session | ✅ | local | ✅ | ✅ |
| `/api/calendar/events/[id]/meeting-token` | POST | Session+access | ⚠️ | LiveKit* | ⚠️ | ⚠️ |
| `/api/calendar/events/[id]/meeting-audit` | POST | Session | ✅ | — | ✅ | ✅ |
| `/api/calendar/events/[id]/guest-invite` | GET | Session | ✅ | — | ✅ | ✅ |
| `/api/calendar/events/[id]/guest-invite/regenerate` | POST | Session | ✅ | — | ✅ | ✅ |
| `/api/calendar/events/[id]/guest-admissions` | GET | Session host | ✅ | — | ✅ | ✅ |
| `/api/calendar/events/[id]/guest-admissions/[admissionId]` | POST | Session host | ✅ | — | ✅ | ✅ |
| `/api/calendar/events/[id]/meeting-recording` | GET,POST,DELETE | Session | ⚠️ | LiveKit* | ⚠️ | ⚠️ |
| `/api/meeting-recordings` | GET | Session | ⚠️ | LiveKit* | ⚠️ | ⚠️ |
| `/api/meeting-recordings/[id]/playback` | GET | Session | ⚠️ | LiveKit* | ⚠️ | ⚠️ |

### 2.6 Guest meet — public (4)

| Route | Methods | Auth | Demo | Public demo | Рекомендация |
|-------|---------|------|------|-------------|--------------|
| `/api/meet/guest-admission` | POST | Invite token | ⚠️ | ⚠️ attack surface | ⚠️ disable без LiveKit |
| `/api/meet/guest-admission/[id]` | GET | Invite token | ⚠️ | ⚠️ | ⚠️ |
| `/api/meet/guest-token` | POST | Invite token | ⚠️ | ⚠️ | ⚠️ |
| `/api/meet/guest-audit` | POST | Invite token | ✅ | ✅ | ✅ |

### 2.7 Team chat (13)

| Route | Methods | Auth | Demo | Public demo | Рекомендация |
|-------|---------|------|------|-------------|--------------|
| `/api/team-chat` | GET, POST | Session | ✅ seed + rate limit | ✅ | ✅ |
| `/api/team-chat/[id]` | DELETE | Session owner/author | rate limit | ✅ | ✅ |
| `/api/team-chat/clear` | POST | **Owner** | — | ⚠️ | ✅ |
| `/api/team-chat/pinned` | GET | Session | ✅ | ✅ | ✅ |
| `/api/team-chat/unread` | GET | Session | ✅ | ✅ | ✅ |
| `/api/team-chat/media` | GET | Session | ✅ | ✅ | ✅ |
| `/api/team-chat/image` | POST | Session | rate limit | ✅ | ✅ |
| `/api/team-chat/image/[id]` | GET | Session | ✅ | ✅ | ✅ |
| `/api/meet/guest-audit` | POST | token | ✅ | ✅ | ✅ |
| `/api/team-chat/voice` | POST | Session | rate limit | ✅ | ✅ |
| `/api/team-chat/audio/[id]` | GET | Session | ✅ | ✅ | ✅ |
| `/api/team-chat/file` | POST | Session | rate limit | ✅ | ✅ |
| `/api/team-chat/file/[id]` | GET | Session | ✅ | ✅ | ✅ |
| `/api/team-chat/[id]/pin` | POST, DELETE | Session | ✅ | ✅ | ✅ |

### 2.8 Team & settings (3)

| Route | Methods | Auth | Role | Demo | Public demo | Рекомендация |
|-------|---------|------|------|------|-------------|--------------|
| `/api/team` | GET | Session | — | ✅ demo flag | ✅ | ✅ |
| `/api/team/[id]` | DELETE | Session | delete ACL | 🔒 demo guard | ✅ | ✅ |
| `/api/settings/passwords` | GET, POST | Session | **Owner** | 🔒 demo guard | ✅ | ✅ |

### 2.9 Knowledge base (1)

| Route | Methods | Auth | Demo | Public demo | Рекомендация |
|-------|---------|------|------|-------------|--------------|
| `/api/knowledge-base` | GET, POST | Session | 🔒 demo articles | ✅ F-08 fixed | ✅ |

### 2.10 AI workspace (4)

| Route | Methods | Auth | Demo | Public demo | Рекомендация |
|-------|---------|------|------|-------------|--------------|
| `/api/ai-workspace` | POST | Session | ✅ canned + rate limit | ✅ | ✅ |
| `/api/ai-workspace/chats` | GET, POST | Session | ✅ | ✅ | ✅ |
| `/api/ai-workspace/chats/[id]` | GET,PUT,DELETE | Session own | ✅ | ✅ | ✅ |

### 2.11 Analytics (2)

| Route | Methods | Auth | Role | Demo | Public demo | Рекомендация |
|-------|---------|------|------|------|-------------|--------------|
| `/api/analytics/overview` | GET | Session | **Owner** | ✅ demo only | ✅ | ✅ |
| `/api/analytics/croatia` | GET | Session | **Owner** | ⚠️ sparse | ⚠️ | ⚠️ |

---

## 3. Cron (1)

| Route | Auth | Demo | Public demo | Рекомендация |
|-------|------|------|-------------|--------------|
| `/api/cron/calendar-reminders` | `Bearer CRON_SECRET` | 503 unless `SPIORA_ENABLE_CRON` | ✅ off by default | ✅ |

---

## 4. Webhooks (1)

| Route | Auth | Demo | Public demo | Рекомендация |
|-------|------|------|-------------|--------------|
| `/api/webhooks/livekit` | LiveKit signature | 503 unless `SPIORA_ENABLE_WEBHOOKS` | ✅ off by default | ✅ |

---

## 5. Debug / diagnostic (2)

| Route | Auth | Demo gate | Public demo | Рекомендация |
|-------|------|-----------|-------------|--------------|
| `/api/ai-workspace/clients-diagnostic` | Session | Hidden unless `SPIORA_AI_WORKSPACE_DEBUG=true` | ❌ if enabled | ❌ 🛠 dev-only |
| `/api/ai-workspace/sheets-health` | Session | Same gate | ⚠️ | 🛠 dev-only |

**Chat debug:** команда `/debug_client` в AI Workspace (см. `PLATFORM_SECURITY_AUDIT.md` F-10).

---

## 6. Маршруты — рекомендации по действиям

### Отключить / скрыть в публичном demo

| Route | Причина |
|-------|---------|
| `/crm/leads`, `/crm/leads/[id]` | Не локализовано, internal Lead Review |
| `/new-formgrid-clients` | Не локализовано, зависит от Sheets |
| `/meeting-recordings` | Не локализовано, LiveKit off |
| `/calendar/meet/[eventId]` | LiveKit off — показать gate |
| `/join/[token]` | LiveKit off — guest flow не нужен |
| Debug APIs | Только при explicit DEBUG flag |

### Удалить (не сейчас — рекомендация на будущее)

| Route | Причина |
|-------|---------|
| `/api/ai-workspace/clients-diagnostic` | High risk if misconfigured |
| `/checkups-erevan`, `/relocation` | Вне core demo path, niche |

### Dev-only

| Route | Причина |
|-------|---------|
| `/api/ai-workspace/sheets-health` | Ops diagnostic |
| `/api/ai-workspace/clients-diagnostic` | PII samples |
| Guest meet APIs | Только с LiveKit staging |

### Оставить в Spiora public demo

Dashboard, Clients, Client Card, Calendar, AI Workspace, Team Chat, Knowledge Base, Analytics (owner), Team, Settings (owner), Tasks (после i18n+seed), Login, Notifications API.

---

## 7. Пробелы middleware

- `/api/*` **не в matcher** — новый route без `getSession()` не блокируется автоматически (F-14).
- Guest routes `/join`, `/api/meet/*`, `/api/webhooks` — намеренно public с token/signature auth.
