# SPIORA — Supabase Deploy Plan

**Дата:** 13 июля 2026  
**Этап:** Deployment Preparation (без применения)  
**Статус:** Готово к review — **ждёт вашего подтверждения**

---

## 0. Резюме

| Пункт | Статус |
|-------|--------|
| Supabase CLI | **Не установлен** на машине разработки |
| `supabase/config.toml` | ✅ Подготовлен (без секретов) |
| Миграции | **23 файла** (001–021), проверены |
| Storage bucket `meeting-recordings` | ✅ Миграция `021` создана |
| `supabase link` | ⏸ Подготовлено, **не выполнено** |
| `supabase db push` | ⏸ Подготовлено, **не выполнено** |

### Вердикт

```
SAFE TO APPLY  — на пустой новый Supabase-проект, после установки CLI и link,
                 при заполненном .env.local (без production refs)

NOT SAFE TO APPLY — пока:
  • CLI не установлен
  • link не выполнен
  • .env.local не заполнен demo-ключами нового проекта
  • SPIORA_ALLOWED_SUPABASE_PROJECT_REFS не задан
```

---

## 1. Project ref

Project ref берётся из URL нового проекта:

```
https://<NEW_SPIORA_PROJECT_REF>.supabase.co
         ^^^^^^^^^^^^^^^^^^^^^^^^
```

**Заполните вручную** (не коммитить):

| Переменная | Пример формата |
|------------|----------------|
| `<NEW_SPIORA_PROJECT_REF>` | `abcdefghijklmnop` (20 символов) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<NEW_SPIORA_PROJECT_REF>.supabase.co` |

---

## 2. Установка Supabase CLI (Windows)

**Текущее состояние:** `supabase` **не найден** в PATH.

### Рекомендуемый способ — Scoop

```powershell
# Если Scoop не установлен: https://scoop.sh
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex

scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
supabase --version
```

### Альтернатива — npm (локально, без глобального PATH)

```powershell
cd "C:\Users\Nika\Desktop\spiora demo"
npm install supabase --save-dev
npx supabase --version
```

### Альтернатива — прямой бинарник

Скачать релиз с [github.com/supabase/cli/releases](https://github.com/supabase/cli/releases)  
и добавить в PATH.

**Безопасность:** не скачивать CLI из неофициальных источников; access token вводится только интерактивно при `supabase login` / `supabase link` и хранится в `supabase/.temp/` (в `.gitignore`).

---

## 3. Порядок действий (после вашего подтверждения)

### Фаза A — Подготовка (локально)

```powershell
cd "C:\Users\Nika\Desktop\spiora demo"

# 1. Установить CLI (см. раздел 2)
supabase --version

# 2. Авторизация (интерактивно, токен НЕ в репозиторий)
supabase login

# 3. Привязка нового пустого проекта
supabase link --project-ref <NEW_SPIORA_PROJECT_REF>
```

При `supabase link` CLI запросит database password нового проекта.  
Состояние link сохраняется в `supabase/.temp/` — **не коммитить**.

### Фаза B — Dry run (без применения)

```powershell
# Проверка синтаксиса миграций (локальный lint)
supabase db lint

# Сравнение локальных миграций с remote
supabase migration list

# Предпросмотр изменений без apply
supabase db push --dry-run
```

**Если `--dry-run` недоступен** (старая версия CLI):

```powershell
# Альтернатива 1: локальный Postgres через CLI
supabase start
supabase db reset          # применит миграции локально
supabase stop

# Альтернатива 2: diff против linked remote
supabase db diff --linked --schema public

# Альтернатива 3: migration list + ручной review SQL
supabase migration list
```

### Фаза C — Применение (только после явного OK)

```powershell
supabase db push
```

### Фаза D — ENV

Заполнить `.env.local` (не коммитить):

```env
SPIORA_DEMO_MODE=true
SPIORA_ENABLE_SUPABASE=true

NEXT_PUBLIC_SUPABASE_URL=https://<NEW_SPIORA_PROJECT_REF>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key_из_dashboard>

SPIORA_ALLOWED_SUPABASE_PROJECT_REFS=<NEW_SPIORA_PROJECT_REF>
# SPIORA_BLOCKED_SUPABASE_PROJECT_REFS=<старый_prod_ref_если_нужен>
```

Опционально (recordings **не активны** без LiveKit):

```env
SPIORA_ENABLE_LIVEKIT=false
```

### Фаза E — Smoke test

```powershell
npm run build
npm test
npm run dev
```

Чеклист smoke — см. раздел 8.

---

## 4. Аудит миграций (23 файла)

### 4.1 Порядок выполнения (лексикографический)

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
010_011_calendar_notifications_apply.sql
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
021_meeting_recordings_storage.sql
```

### 4.2 Дубли (идемпотентны, не блокируют)

| Файлы | Содержимое |
|-------|------------|
| `002` vs `001` | `tasks.assignees` — `ADD COLUMN IF NOT EXISTS` |
| `010_011` + `010` + `011` | `send_reminders` + `calendar_reminder_deliveries` |

### 4.3 CREATE TABLE — конфликты

| Таблица | Создаётся в | Конфликт |
|---------|-------------|----------|
| Все 16 таблиц | Одна миграция каждая | **Нет** — везде `IF NOT EXISTS` |
| `calendar_reminder_deliveries` | `010_011` и `011` | **Нет** — `IF NOT EXISTS` |

### 4.4 Idempotency

| Паттерн | Использование |
|---------|---------------|
| `CREATE TABLE IF NOT EXISTS` | ✅ Все таблицы |
| `CREATE INDEX IF NOT EXISTS` | ✅ Все индексы |
| `ADD COLUMN IF NOT EXISTS` | ✅ Все ALTER |
| `DROP CONSTRAINT IF EXISTS` | ✅ Перед сменой CHECK |
| `ON CONFLICT DO NOTHING` | ✅ Storage buckets |
| `INSERT ... ON CONFLICT` | ✅ `app_state` seed в 001 |

### 4.5 Destructive changes

| Тип | Найдено | Риск на пустой БД |
|-----|---------|-------------------|
| `DROP TABLE` | **Нет** | — |
| `DROP COLUMN` | **Нет** | — |
| `DROP CONSTRAINT` | 005, 007, 008, 012 | **Безопасно** — только CHECK constraints |
| `TRUNCATE` | **Нет** | — |
| `DELETE` / `UPDATE` data | 017 (`UPDATE` guest_max_count для video_meeting) | **Безопасно** — пустая таблица |

### 4.6 Функции / триггеры

| Элемент | Найдено |
|---------|---------|
| `CREATE FUNCTION` | **Нет** |
| `CREATE TRIGGER` | **Нет** |

### 4.7 Индексы

Все с `IF NOT EXISTS`. Дублирующие индексы на `calendar_reminder_deliveries` (010_011 / 011) — идемпотентны.

### 4.8 Foreign keys

```
calendar_reminder_deliveries.event_id → calendar_events(id) CASCADE
calendar_meeting_audit.event_id → calendar_events(id) CASCADE
calendar_event_participants.event_id → calendar_events(id) CASCADE
calendar_meeting_guest_invites.event_id → calendar_events(id) CASCADE
calendar_meeting_guest_admissions → calendar_events, guest_invites CASCADE
calendar_meeting_recordings.event_id → calendar_events(id) CASCADE
team_chat_messages.reply_to_message_id → team_chat_messages(id) SET NULL
```

Порядок миграций **соблюдает** зависимости FK.

### 4.9 RLS

| Элемент | Статус |
|---------|--------|
| `ENABLE ROW LEVEL SECURITY` | **Нет** |
| `CREATE POLICY` (public tables) | **Нет** |
| Storage policy | **Только 021** — `service_role` на `meeting-recordings` |

Архитектура: доступ через `SUPABASE_SERVICE_ROLE_KEY` на сервере, без anon key.

### 4.10 Grants

`GRANT` / `REVOKE` в миграциях **не найдены**.

### 4.11 Безопасность на пустой базе

| Миграция | Безопасна на empty DB |
|----------|----------------------|
| 001–021 | **Да** — все |

---

## 5. Storage migration — решение

### Выбор: создать bucket (миграция 021) ✅

**Почему не отключать feature через demo guard:**

| Аргумент | Деталь |
|----------|--------|
| Код требует bucket | `meeting-recording-storage.ts` → `storage.from("meeting-recordings")` при `isSupabaseConfigured()` |
| Таблица уже в схеме | `019_calendar_meeting_recordings.sql` |
| UI в demo | `/meeting-recordings` в навигации owner/manager |
| LiveKit уже gated | `SPIORA_ENABLE_LIVEKIT=false` по умолчанию |
| Риск bucket | **Минимальный** — `public=false`, нет anon policies |

**Почему bucket, а не guard:**

Отключение recordings при Supabase без bucket создаёт скрытый runtime-fail при включении LiveKit позже. Пустой private bucket на новом проекте — безопаснее и согласованнее с 004–008.

### Содержимое `021_meeting_recordings_storage.sql`

- Bucket `meeting-recordings`, `public = false`
- Идемпотентный `INSERT ... ON CONFLICT DO UPDATE`
- Policy только для `service_role` (документация + audit)
- Owner/manager RBAC — в `meeting-recording-access.ts`, не в Storage RLS

---

## 6. ENV для нового проекта

Заполнять **только в `.env.local`** (не в tracked-файлах):

```env
# ── Обязательно для Supabase demo ──
SPIORA_DEMO_MODE=true
SPIORA_ENABLE_SUPABASE=true

NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

SPIORA_ALLOWED_SUPABASE_PROJECT_REFS=

# ── Рекомендуется ──
AUTH_SECRET=
CRON_SECRET=
AUTH_PASSWORD_OWNER=
AUTH_PASSWORD_MANAGER_1=
AUTH_PASSWORD_MANAGER_2=
AUTH_PASSWORD_MANAGER_3=
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ── Остаётся выключенным для первого deploy ──
SPIORA_ENABLE_LIVEKIT=false
SPIORA_ENABLE_GOOGLE_INTEGRATIONS=false
SPIORA_ENABLE_EXTERNAL_AI=false
SPIORA_ENABLE_EMIGRANT_DESK=false
```

Где взять ключи:

| Переменная | Источник |
|------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Dashboard → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Dashboard → Settings → API → `service_role` (secret) |
| `SPIORA_ALLOWED_SUPABASE_PROJECT_REFS` | Ref из URL |

---

## 7. Rollback

### Если `db push` ещё не применялся

Откат не нужен — remote пустой.

### Если миграции применены на **новый** demo-проект

**Вариант A — полный сброс (рекомендуется для demo):**

```powershell
# Dashboard → Project Settings → General → Reset database
# или создать новый пустой Supabase project
```

**Вариант B — откат отдельных миграций**

Не поддерживается нативно Supabase CLI для arbitrary down migrations.  
Down-файлы не созданы — **не пытаться** `DROP` вручную без плана.

**Вариант C — unlink**

```powershell
# Удалить supabase/.temp/ локально (сбросит link state)
Remove-Item -Recurse -Force supabase\.temp
```

---

## 8. Проверки после применения

### 8.1 Таблицы (16 шт.)

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

Ожидаются:

- `ai_workspace_chats`
- `app_state`
- `calendar_event_participants`
- `calendar_events`
- `calendar_meeting_audit`
- `calendar_meeting_guest_admissions`
- `calendar_meeting_guest_invites`
- `calendar_meeting_recordings`
- `calendar_reminder_deliveries`
- `client_notes`
- `notifications`
- `tasks`
- `team_chat_last_seen`
- `team_chat_messages`
- `user_presence`

### 8.2 RLS

```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

Ожидание: `rowsecurity = false` на всех public tables (by design).

### 8.3 Storage

```sql
SELECT id, name, public
FROM storage.buckets
ORDER BY id;
```

Ожидаются 5 buckets, все `public = false`:

- `meeting-recordings`
- `task-attachments`
- `team-chat-audio`
- `team-chat-files`
- `team-chat-images`

### 8.4 Smoke test (приложение)

| # | Проверка | Ожидание |
|---|----------|----------|
| 1 | Login demo user | ✅ |
| 2 | Tasks CRUD | ✅ persist в Supabase |
| 3 | Team chat message | ✅ |
| 4 | Calendar event create | ✅ |
| 5 | Notifications | ✅ |
| 6 | AI workspace chat save | ✅ |
| 7 | Client notes | ✅ |
| 8 | Meeting recordings list | ✅ (пустой список OK) |
| 9 | Upload task attachment | ✅ Storage |
| 10 | `npm test` | 495 pass |

---

## 9. Команды (шпаргалка)

```powershell
# Установка
scoop install supabase

# Auth
supabase login

# Link (НЕ ВЫПОЛНЯТЬ без подтверждения)
supabase link --project-ref <NEW_SPIORA_PROJECT_REF>

# Dry run
supabase db lint
supabase migration list
supabase db push --dry-run

# Apply (НЕ ВЫПОЛНЯТЬ без подтверждения)
supabase db push

# Проверка статуса
supabase projects list
supabase migration list
```

---

## 10. Ограничения (соблюдены)

- ❌ `supabase link` — не выполнялся
- ❌ `supabase db push` — не выполнялся
- ❌ SQL Editor — не использовался
- ❌ Deploy / commit / push — не выполнялись

---

## 11. Связанные документы

- `SPIORA_SUPABASE_DEPLOY_CHECK.md` — первичный аудит миграций
- `.env.spiora.example` — шаблон demo ENV
- `src/lib/demo/environment-guard.ts` — защита от production refs

---

*Документ подготовлен на этапе Deployment Preparation. Следующий шаг — ваше подтверждение на `supabase link` и `supabase db push`.*
