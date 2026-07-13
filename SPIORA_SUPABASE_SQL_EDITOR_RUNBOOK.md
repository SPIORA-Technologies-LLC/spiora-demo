# SPIORA — SQL Editor Bootstrap Runbook

**Дата:** 13 июля 2026  
**Файл bootstrap:** `SPIORA_SUPABASE_BOOTSTRAP.sql`  
**Причина:** Supabase CLI недоступен (timeout к `api.supabase.com`)

---

## 1. Что делает bootstrap

Один SQL-скрипт объединяет **22 исходных файла миграций** (номера 001–021, включая `010_011`, `010`, `011`) в правильном порядке:

- создаёт 15 таблиц в `public`
- создаёт 5 private Storage buckets
- добавляет 1 storage policy (`meeting-recordings`)
- **не** включает demo seed из `001_platform.sql`
- **не** содержит секретов, URL и project ref

В конце файла — **read-only** verification queries.

---

## 2. Как открыть SQL Editor

1. Войти в [Supabase Dashboard](https://supabase.com/dashboard)
2. Выбрать **новый пустой** проект Spiora
3. В левом меню: **SQL Editor**
4. Нажать **New query**

---

## 3. Как вставить bootstrap

1. Открыть локальный файл `SPIORA_SUPABASE_BOOTSTRAP.sql`
2. Скопировать **весь** файл (Ctrl+A → Ctrl+C)
3. Вставить в SQL Editor (Ctrl+V)
4. **Не** разбивать на части при первом запуске

---

## 4. Что проверить перед Run

| # | Проверка |
|---|----------|
| 1 | Проект **новый и пустой** (нет старых таблиц Spiora) |
| 2 | В Dashboard → Table Editor **нет** `tasks`, `calendar_events` и т.д. |
| 3 | Вы в **правильном** проекте (не production) |
| 4 | Скрипт скопирован **целиком**, включая verification в конце |
| 5 | `.env.local` **ещё не** указывает на старый production ref |

Если таблицы уже существуют — **не нажимать Run**. См. раздел 8.

---

## 5. Запуск

1. Нажать **Run** (или Ctrl+Enter)
2. Дождаться завершения (обычно 5–30 секунд)
3. В панели Results пролистать вывод **verification queries** внизу

---

## 6. Ожидаемый результат

### DDL (основная часть)

- Сообщение **Success** без ошибок
- Нет `ERROR:` в выводе

### Verification (read-only)

| Query | Ожидание |
|-------|----------|
| Таблицы | **15** строк: `ai_workspace_chats`, `app_state`, `calendar_event_participants`, `calendar_events`, `calendar_meeting_audit`, `calendar_meeting_guest_admissions`, `calendar_meeting_guest_invites`, `calendar_meeting_recordings`, `calendar_reminder_deliveries`, `client_notes`, `notifications`, `tasks`, `team_chat_last_seen`, `team_chat_messages`, `user_presence` |
| Индексы | Список `*_idx` на всех таблицах |
| Storage buckets | **5** строк, все `public = false` |
| `meeting-recordings` | 1 строка, `public = false` |
| Policy | 1 строка `meeting_recordings_service_role_all` |
| `tasks` колонки | `assignees`, `review_history`, `attachments`, `progress_reports`, `status` |
| `tasks_status_check` | 5 статусов workflow |
| `calendar_events` колонки | `send_reminders`, `video_invite_mode`, `guest_*`, `linked_client_*`, `event_type` |
| `event_type` check | `general`, `video_meeting` |
| FK recordings | `calendar_meeting_recordings` → `calendar_events` |
| `team_chat_messages` | `reply_to_*`, `is_pinned`, `message_type` |

---

## 7. Что делать при ошибке

### `relation "calendar_events" does not exist`

Миграции выполнились не по порядку или скрипт обрезан.  
**Действие:** на пустом проекте — Reset database (Settings → General) и повторить с полным файлом.

### `constraint ... already exists`

Скрипт уже запускался частично или повторно.  
**Действие:** не запускать снова вслепую — см. раздел 8.

### `permission denied` на `storage.buckets`

Редко на free tier при первом запуске.  
**Действие:** убедиться, что Storage включён (Dashboard → Storage). Повторить Run.

### `must be owner of table storage.objects` (policy)

**Действие:** выполнить bootstrap от имени postgres через SQL Editor (по умолчанию так и есть). Если ошибка сохраняется — создать bucket вручную в Storage UI, затем выполнить только блок `021` из bootstrap.

### Любая другая ERROR

1. Скопировать **полный текст ошибки**
2. Записать **номер секции** из комментария (`-- 0XX_...`)
3. **Не** запускать скрипт повторно до анализа

---

## 8. Как не запускать скрипт второй раз без проверки

Перед повторным Run выполните:

```sql
SELECT COUNT(*) AS table_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';
```

| `table_count` | Действие |
|---------------|----------|
| `0` | Безопасно запустить bootstrap |
| `1–14` | Частичное применение — **Reset database** или ручной repair |
| `15` | Bootstrap уже применён — **не запускать** DDL повторно; только verification queries |
| `>15` | Проект не пустой — остановиться, проверить вручную |

Для повторной проверки скопируйте **только** секцию `VERIFICATION` из конца `SPIORA_SUPABASE_BOOTSTRAP.sql`.

---

## 9. После успешного bootstrap

### ENV (`.env.local`, не коммитить)

```env
SPIORA_DEMO_MODE=true
SPIORA_ENABLE_SUPABASE=true
NEXT_PUBLIC_SUPABASE_URL=https://<NEW_SPIORA_PROJECT_REF>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<из Dashboard → Settings → API>
SPIORA_ALLOWED_SUPABASE_PROJECT_REFS=<NEW_SPIORA_PROJECT_REF>
```

### Smoke test приложения

```powershell
npm run build
npm run dev
```

- Login → Tasks CRUD
- Team chat message
- Calendar event create

---

## 10. Синхронизация migration history (когда CLI заработает)

Когда `supabase link` и `supabase db push` станут доступны:

### Вариант A — baseline (рекомендуется)

Схема уже применена через SQL Editor. Пометить миграции как применённые:

```powershell
supabase login
supabase link --project-ref <NEW_SPIORA_PROJECT_REF>

# Для каждой миграции 001–021 — repair/baseline
# (точная команда зависит от версии CLI)
supabase migration repair --status applied 001
# ... повторить для всех версий
```

Или одной операцией после `supabase db pull` сравнить diff — если пусто, history синхронизирована.

### Вариант B — не трогать history

Продолжать использовать SQL Editor для будущих изменений.  
Новые миграции добавлять в `supabase/migrations/` и применять вручную.

### Вариант C — сверка

```powershell
supabase migration list
supabase db diff --linked
```

Пустой diff = локальные миграции совпадают с remote.

---

## 11. Ограничения SQL Editor

| Команда | В bootstrap | SQL Editor |
|---------|-------------|------------|
| `CREATE EXTENSION` | ✅ pgcrypto | ✅ |
| `CREATE TABLE IF NOT EXISTS` | ✅ | ✅ |
| `ALTER TABLE` | ✅ | ✅ |
| `INSERT INTO storage.buckets` | ✅ | ✅ |
| `CREATE POLICY` on storage | ✅ | ✅ |
| `\i`, `\copy` (psql) | ❌ не используется | ❌ |
| `CREATE ROLE` / superuser | ❌ не используется | ❌ |

---

## 12. Связанные документы

- `SPIORA_SUPABASE_DEPLOY_PLAN.md` — общий план деплоя
- `SPIORA_SUPABASE_DEPLOY_CHECK.md` — аудит миграций
- `SPIORA_SUPABASE_BOOTSTRAP.sql` — исполняемый скрипт

---

*Runbook подготовлен без выполнения SQL, commit, push и deploy.*
