# SPIORA — План Row Level Security (RLS)

**PR:** #14 — Production Foundation  
**Статус:** Планирование — **RLS не применяется** в этом PR  
**Дата:** 15 июля 2026

---

## 1. Текущая модель доступа

| Слой | Механизм |
|------|----------|
| **PostgreSQL** | `SUPABASE_SERVICE_ROLE_KEY` на сервере — **обходит RLS** |
| **Приложение** | JWT-сессия (`spiora_session`) + RBAC в TypeScript |
| **Supabase Auth** | **Не используется** для команды Spiora demo |
| **Anon key** | **Не используется** в коде |

RLS станет defense-in-depth **после** миграции на user-scoped Supabase Auth или PostgREST с anon + policies.

---

## 2. Роли (целевая модель)

| Роль | Spiora сейчас | RLS (будущее) |
|------|---------------|---------------|
| **owner** | ✔ `olivia@spiora.demo` | Полный доступ ко всем строкам компании |
| **manager** | ✔ 3 demo-аккаунта | CRM read/write; archive — только owner |
| **consultant** | ✗ **нет в коде** | Запланировано: read clients assigned; no archive |
| **guest** | LiveKit/calendar guest flows | Только guest invite/admission таблицы |

**Дублирование:** Supabase Auth roles **отсутствуют**. Вся авторизация — Spiora JWT + `src/lib/auth/users.ts`.

---

## 3. Политики по таблицам

### 3.1 CRM

| Таблица | SELECT | INSERT | UPDATE | DELETE | Примечание |
|---------|--------|--------|--------|--------|------------|
| `clients` | owner, manager, consultant (assigned) | owner, manager | owner, manager | owner (soft archive) | Фильтр `archived_at IS NULL` для list |
| `client_notes` | по доступу к client_id | owner, manager | author или owner | owner | `client_id` = `external_id` |

### 3.2 Операционные модули

| Таблица | SELECT | INSERT | UPDATE | DELETE |
|---------|--------|--------|--------|--------|
| `tasks` | creator, assignees, owner | owner, manager | по permissions matrix | creator или owner |
| `calendar_events` | company + personal visibility | authenticated team | creator или owner | creator или owner |
| `calendar_event_participants` | event viewers | event editor | event editor | event editor |
| `calendar_reminder_deliveries` | system/cron only | service role | service role | service role |
| `calendar_meeting_*` | meeting participants + owner | API handlers | API handlers | owner |
| `team_chat_messages` | all team | authenticated | pin: owner/manager | clear: owner |
| `team_chat_last_seen` | own row | own row | own row | — |
| `notifications` | `user_id = auth.uid()` | system emit | own row | own row |
| `user_presence` | all team | own row | own row | — |
| `ai_workspace_chats` | `user_id = auth.uid()` | own | own | own |
| `app_state` | owner read; keys scoped | owner/service | owner/service | owner |

### 3.3 Storage buckets

| Bucket | Политика (будущее) |
|--------|-------------------|
| `task-attachments` | assignees + owner |
| `team-chat-*` | team members |
| `meeting-recordings` | event participants + owner |

**Текущее состояние:** RLS на storage минимальный; доступ через service role на сервере (`021_meeting_recordings_storage.sql`).

### 3.4 Вне scope PostgreSQL (пока)

| Модуль | Хранилище | RLS |
|--------|-----------|-----|
| Knowledge Base | `.data` / Google Drive | Отдельный этап |
| Documents | Google Drive | Отдельный этап |
| Formgrid | Google Sheets | N/A |

---

## 4. Ограничения и принципы

1. **Service role** остаётся для cron, webhooks, миграций, admin ops — но не для browser.
2. **Anon key** — только после audit всех API paths.
3. **Consultant role** — добавить в Spiora Auth **до** RLS policies с consultant scope.
4. **Soft delete** (`archived_at`) — политики SELECT по умолчанию скрывают archived.
5. **Demo rows** (`is_demo = true`) — в production отдельный project; политики не смешивают demo/prod.

---

## 5. Порядок миграции (будущие PR)

| Этап | Действие |
|------|----------|
| **RLS-0** | Включить RLS на таблицах **без** policies (deny all для anon/authenticated) — только service role |
| **RLS-1** | `notifications`, `user_presence`, `ai_workspace_chats` — user-scoped |
| **RLS-2** | `clients`, `client_notes` — team RBAC |
| **RLS-3** | `tasks`, `calendar_*`, `team_chat_*` |
| **RLS-4** | Storage policies per bucket |
| **RLS-5** | Опционально: Supabase Auth sync с Spiora users |

---

## 6. Связанные файлы

- Миграции: `supabase/migrations/001`–`022`
- RBAC: `src/lib/auth/permissions.ts`, `src/lib/clients/permissions.ts`, `src/lib/tasks/permissions.ts`, `src/lib/calendar/permissions.ts`
- Server client: `src/lib/supabase/server.ts`

**RLS в этом PR не применялся.**
