# SPIORA — Supabase Deploy Check

**Дата:** 13 июля 2026  
**Статус:** Аудит завершён (ничего не применялось, ничего не менялось)  
**Контекст:** новый пустой проект Supabase для Spiora demo

---

## 1. Краткий вердикт

| Критерий | Результат |
|----------|-----------|
| Полный набор миграций для схемы с нуля | **Почти да** — 16 таблиц покрыты, 1 пробел в Storage |
| Порядок выполнения | **Корректен** (лексикографический), есть дубли — идемпотентны |
| Ссылки на старый Supabase project | **Не найдены** в `supabase/` |
| Production URL / project refs | **Не найдены** в миграциях |
| Готовность к `supabase db push` | **Нет** — отсутствует `supabase/config.toml` и link к проекту |
| Альтернатива | **SQL Editor** — все файлы готовы к ручному прогону по порядку |

**Итог:** схему можно развернуть на новом проекте **без изменения существующих миграций**, кроме одного рекомендуемого дополнения (Storage bucket `meeting-recordings`). CLI-путь потребует инициализации Supabase в репозитории.

---

## 2. Инвентаризация `supabase/migrations/`

Всего **22 SQL-файла** (номера 001–020, плюс объединённый `010_011`).

| # | Файл | Назначение |
|---|------|------------|
| 001 | `001_platform.sql` | Extension `pgcrypto`, 7 базовых таблиц, demo seed в `app_state` |
| 002 | `002_task_assignees.sql` | Колонка `tasks.assignees` *(дубль — уже есть в 001)* |
| 003 | `003_user_presence.sql` | Таблица `user_presence` |
| 004 | `004_team_chat_voice.sql` | Voice-поля в `team_chat_messages`, bucket `team-chat-audio` |
| 005 | `005_task_approval_workflow.sql` | Расширение статусов задач, `review_history` |
| 006 | `006_task_attachments.sql` | `tasks.attachments`, bucket `task-attachments` |
| 007 | `007_team_chat_images.sql` | Image-поля, bucket `team-chat-images` |
| 008 | `008_team_chat_files.sql` | File-поля, bucket `team-chat-files` |
| 009 | `009_calendar.sql` | Таблица `calendar_events` + индексы |
| 010a | `010_011_calendar_notifications_apply.sql` | `send_reminders` + `calendar_reminder_deliveries` *(объединённый)* |
| 010b | `010_calendar_send_reminders.sql` | `send_reminders` *(дубль 010a)* |
| 011 | `011_calendar_reminder_deliveries.sql` | `calendar_reminder_deliveries` *(дубль 010a)* |
| 012 | `012_calendar_video_meetings.sql` | Video meeting type, `calendar_meeting_audit` |
| 013 | `013_calendar_event_participants.sql` | `video_invite_mode`, `calendar_event_participants` |
| 014 | `014_task_progress_reports.sql` | `tasks.progress_reports` |
| 015 | `015_calendar_meeting_guest_invites.sql` | `calendar_meeting_guest_invites`, `participant_type` в audit |
| 016 | `016_calendar_meeting_guest_waiting_room.sql` | `guest_waiting_room`, `calendar_meeting_guest_admissions` |
| 017 | `017_calendar_meeting_guest_access.sql` | `guest_max_count`, `guest_access_password_hash` |
| 018 | `018_calendar_meeting_client_link.sql` | `linked_client_id`, `linked_client_name` |
| 019 | `019_calendar_meeting_recordings.sql` | Таблица `calendar_meeting_recordings` |
| 020 | `020_team_chat_reply_pin.sql` | Reply/pin поля в `team_chat_messages` |

### Отсутствует в репозитории

| Файл | Статус |
|------|--------|
| `supabase/config.toml` | **Нет** — CLI не инициализирован |
| `supabase/seed.sql` | **Нет** (не требуется — seed в 001) |
| RLS-политики | **Нет** — by design (доступ только через `service_role` на сервере) |

---

## 3. Порядок выполнения

Supabase CLI и большинство migration runners сортируют файлы **лексикографически по имени**.

Фактический порядок:

```
001_platform.sql
002_task_assignees.sql
003_user_presence.sql
004_team_chat_voice.sql
005_task_approval_workflow.sql
006_task_attachments.sql
007_team_chat_images.sql
008_team_chat_files.sql
009_calendar.sql
010_011_calendar_notifications_apply.sql   ← раньше 010_calendar (символ '0' < 'c')
010_calendar_send_reminders.sql
011_calendar_reminder_deliveries.sql
012_calendar_video_meetings.sql
013_calendar_event_participants.sql
014_task_progress_reports.sql
015_calendar_meeting_guest_invites.sql
016_calendar_meeting_guest_waiting_room.sql
017_calendar_meeting_guest_access.sql
018_calendar_meeting_client_link.sql
019_calendar_meeting_recordings.sql
020_team_chat_reply_pin.sql
```

### Зависимости (критический путь)

```
001 (base tables)
  → 003 (presence)
  → 004–008 (team chat + storage)
  → 005, 006, 014 (tasks extensions)
  → 009 (calendar_events)
  → 010–011 (reminders — нужен calendar_events)
  → 012–019 (meetings — FK на calendar_events)
  → 020 (team chat reply/pin — FK на team_chat_messages)
```

**Вывод:** порядок **корректен**. FK-цепочки не нарушены.

### Дублирующие миграции

| Дубль | Риск |
|-------|------|
| `002` vs `001.assignees` | Нет — `ADD COLUMN IF NOT EXISTS` |
| `010_011` + `010` + `011` | Нет — `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` |
| `010_011` содержит `SELECT` для верификации | Низкий — не ломает DDL, только выводит строки в SQL Editor |

---

## 4. Покрытие схемы vs код приложения

### Таблицы (`src/lib/supabase/*`)

| Таблица | Миграция | Используется в коде |
|---------|----------|---------------------|
| `tasks` | 001, 002, 005, 006, 014 | ✅ `tasks-repo.ts` |
| `team_chat_messages` | 001, 004, 007, 008, 020 | ✅ `team-chat-repo.ts` |
| `team_chat_last_seen` | 001 | ✅ `team-chat-repo.ts` |
| `ai_workspace_chats` | 001 | ✅ `workspace-chats-repo.ts` |
| `client_notes` | 001 | ✅ `client-notes-repo.ts` |
| `notifications` | 001 | ✅ `notifications-repo.ts` |
| `app_state` | 001 | ✅ `app-state.ts` |
| `user_presence` | 003 | ✅ `presence-repo.ts` |
| `calendar_events` | 009 + 010–018 | ✅ `calendar-events-repo.ts` |
| `calendar_reminder_deliveries` | 010_011 / 011 | ✅ `calendar-reminder-deliveries-repo.ts` |
| `calendar_meeting_audit` | 012, 015 | ✅ `calendar-meeting-audit-repo.ts` |
| `calendar_event_participants` | 013 | ✅ `calendar-event-participants-repo.ts` |
| `calendar_meeting_guest_invites` | 015 | ✅ `calendar-meeting-guest-invites-repo.ts` |
| `calendar_meeting_guest_admissions` | 016 | ✅ `calendar-meeting-guest-admissions-repo.ts` |
| `calendar_meeting_recordings` | 019 | ✅ `calendar-meeting-recordings-repo.ts` |

**Все 16 таблиц, используемых кодом, покрыты миграциями.**

### Storage buckets

| Bucket | Миграция | Используется в коде |
|--------|----------|---------------------|
| `team-chat-audio` | 004 | ✅ `audio-storage.ts` |
| `task-attachments` | 006 | ✅ `attachment-storage.ts` |
| `team-chat-images` | 007 | ✅ `image-storage.ts` |
| `team-chat-files` | 008 | ✅ `file-storage.ts` |
| `meeting-recordings` | ❌ **нет миграции** | ✅ `meeting-recording-storage.ts` |

### Пробел: bucket `meeting-recordings`

Код (`src/lib/calendar/meeting-recording-storage.ts`) при включённом Supabase выполняет:

- `storage.from("meeting-recordings").upload(...)`
- `storage.from("meeting-recordings").createSignedUrl(...)`

В миграциях bucket **не создаётся**. На пустом проекте запись/воспроизведение meeting recordings **упадёт**, если bucket не создать вручную.

**Почему понадобится новая миграция (не создана по инструкции):**

```sql
-- Предлагаемое содержимое 021_meeting_recordings_storage.sql
insert into storage.buckets (id, name, public)
values ('meeting-recordings', 'meeting-recordings', false)
on conflict (id) do nothing;
```

Аналогично существующим миграциям 004/006/007/008. Без этого файла схема **неполная** для функции video recordings.

---

## 5. Проверка на старый / production Supabase

### Скан `supabase/` (миграции + содержимое папки)

| Паттерн | Результат |
|---------|-----------|
| `*.supabase.co` URL | **Не найдено** |
| `project_ref` / project ID | **Не найдено** |
| `sharp-spice`, `legacy-prod`, `prodref` | **Не найдено** |
| `vercel.app` | **Не найдено** |
| Hardcoded service role / JWT | **Не найдено** |

Миграции содержат только:

- DDL (CREATE/ALTER TABLE, INDEX, CHECK)
- Demo seed в `app_state` (аналитика Visa D — вымышленные консульства)
- `company_id` default `'northstar-mobility'` — demo tenant, не production ref

### Отдельный проект Emigrant Desk

`EMIGRANT_SUPABASE_URL` — **другой** Supabase-проект, не описан в `supabase/migrations/`. Для Spiora demo по умолчанию отключён (`SPIORA_ENABLE_EMIGRANT_DESK=false`).

---

## 6. Подготовка к деплою схемы

### Вариант A — Supabase CLI (`supabase db push`) — рекомендуемый для CI

**Текущее состояние:** CLI **не готов** — нет `supabase/config.toml`.

Перед первым push (выполнять вручную, не в этом PR):

```bash
# 1. Установить Supabase CLI (если нет)
# https://supabase.com/docs/guides/cli

# 2. Инициализировать (создаст config.toml)
supabase init

# 3. Привязать новый пустой проект
supabase link --project-ref <НОВЫЙ_PROJECT_REF>

# 4. Применить миграции
supabase db push
```

После `supabase init` проверить, что `supabase/migrations/` не перезаписана — существующие 22 файла должны остаться на месте.

### Вариант B — Supabase Dashboard SQL Editor

Исторически использовался в проекте (комментарии в миграциях: «SQL Editor → Run»).

1. Открыть **новый** проект → SQL Editor  
2. Выполнить файлы **строго по порядку** из раздела 3  
3. Для `010_011` — можно пропустить `010` и `011` (содержимое уже включено)  
4. Вручную создать bucket `meeting-recordings` (Storage → New bucket, private) **или** выполнить SQL из раздела 4

### Вариант C — Один объединённый скрипт

Допустим для первого развёртывания, но **не рекомендуется** для поддержки — потеряется история миграций. Лучше A или B.

---

## 7. Pre-flight checklist (перед подключением приложения)

### В Supabase (новый проект)

- [ ] Все 22 миграции применены без ошибок
- [ ] Bucket `meeting-recordings` создан (private)
- [ ] Buckets `team-chat-audio`, `task-attachments`, `team-chat-images`, `team-chat-files` существуют
- [ ] В Table Editor видны 16 таблиц из раздела 4
- [ ] RLS: таблицы без политик — **ожидаемо** (server-only `service_role`)

### В `.env.local` (локально, не в Git)

```env
SPIORA_DEMO_MODE=true
SPIORA_ENABLE_SUPABASE=true

NEXT_PUBLIC_SUPABASE_URL=https://<НОВЫЙ_REF>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role из нового проекта>

# Опционально — заблокировать старый prod ref
# SPIORA_BLOCKED_SUPABASE_PROJECT_REFS=<старый_ref>
# SPIORA_ALLOWED_SUPABASE_PROJECT_REFS=<новый_ref>
```

### В приложении

- [ ] `npm run build` — без ошибок
- [ ] Smoke: tasks, team chat, calendar CRUD
- [ ] Smoke: upload вложения / голосовое / изображение (Storage)
- [ ] Smoke: meeting recording playback (после создания bucket)

---

## 8. Замечания по качеству миграций (не блокеры)

| Замечание | Серьёзность | Действие |
|-----------|-------------|----------|
| Дубли 010/011 | Низкая | Можно оставить; идемпотентно |
| `002` дублирует `001.assignees` | Низкая | Можно оставить |
| Нет `supabase/config.toml` | Средняя | `supabase init` перед CLI push |
| Нет bucket `meeting-recordings` | **Средняя** | Новая миграция `021` или ручное создание |
| Нет RLS | Информационно | Соответствует архитектуре (service role only) |
| Seed в `001` | Информационно | Demo analytics — ок для пустого проекта |

---

## 9. Нужны ли новые миграции?

| # | Нужна? | Почему |
|---|--------|--------|
| `021_meeting_recordings_storage.sql` | **Да, рекомендуется** | Код использует bucket `meeting-recordings`, миграции его не создают |
| Консолидация 010/011 | Нет | Идемпотентные дубли не мешают |
| RLS policies | Нет | Не используются в текущей архитектуре |
| `supabase/config.toml` | **Да, для CLI** | Не миграция — инфраструктура CLI |

**Новые миграции в этом аудите не создавались** — только зафиксирована рекомендация.

---

## 10. Итоговый вердикт

```
ГОТОВНОСТЬ СХЕМЫ:     95%  (1 пробел — Storage bucket)
ГОТОВНОСТЬ CLI:       40%  (нет config.toml / link)
БЕЗОПАСНОСТЬ MIGRATIONS: ✅  (нет production refs, нет секретов)
ПОРЯДОК MIGRATIONS:   ✅  (корректен, дубли безопасны)
```

**Можно разворачивать** новый Supabase проект на существующих миграциях через SQL Editor или после `supabase init` + `supabase link` + `supabase db push`.

**Обязательно после деплоя:** создать bucket `meeting-recordings` (миграцией `021` или вручную в Dashboard).

---

*Аудит выполнен без применения миграций, без изменений в репозитории и без деплоя.*
