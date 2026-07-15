# SPIORA — SQL Editor Bootstrap Runbook

**Дата:** 15 июля 2026  
**Bootstrap:** `SPIORA_SUPABASE_BOOTSTRAP.sql` (миграции 001–022)  
**Demo seed:** `SPIORA_DEMO_SEED.sql` (отдельно, после bootstrap)  
**Причина:** Supabase CLI недоступен или проект создаётся вручную через Dashboard

---

## 1. Что делает bootstrap

Один SQL-скрипт объединяет **миграции 001–022** (23 исходных файла; 010+011 объединены, без дублирования):

- создаёт **16 таблиц** в `public`
- создаёт **5 private Storage buckets**
- добавляет **1 storage policy** (`meeting-recordings`)
- **не** включает demo seed
- **не** содержит секретов, URL и project ref

В конце bootstrap — **read-only verification queries** (схема, без данных).

---

## 2. Что делает demo seed

Файл `SPIORA_DEMO_SEED.sql` — **отдельный второй шаг**:

| Модуль | Записей | Примечание |
|--------|---------|------------|
| CRM `clients` | 25 | fictional, `@example.com` |
| `client_notes` | 3 | `client_id` = `external_id` |
| `app_state` | 2 | analytics supplement + formgrid watch |

**Не включено в seed:** Tasks, Calendar, Team Chat, Notifications, AI chats — инициализируются из TypeScript demo seeds приложением.

Seed **не меняет структуру** базы (только INSERT / ON CONFLICT DO NOTHING).

---

## 3. Порядок выполнения (обязательно)

```
1. SPIORA_SUPABASE_BOOTSTRAP.sql   → схема
2. Проверить: Success, нет ERROR
3. SPIORA_DEMO_SEED.sql            → demo-данные
4. Verification queries            → counts и связи
5. Настроить .env.local            → не коммитить
6. npm run build && npm run dev    → smoke test
```

**Нельзя** запускать только `022_clients.sql` на пустой базе — нужен полный bootstrap.

---

## 4. Как открыть SQL Editor

1. Войти в [Supabase Dashboard](https://supabase.com/dashboard)
2. Выбрать **новый пустой** demo-проект Spiora
3. **SQL Editor** → **New query**

---

## 5. Шаг A — Bootstrap

1. Открыть `SPIORA_SUPABASE_BOOTSTRAP.sql`
2. Скопировать **весь** файл (Ctrl+A → Ctrl+C)
3. Вставить в SQL Editor
4. **Не** разбивать на части при первом запуске
5. Нажать **Run**

### Перед Run проверить

| # | Проверка |
|---|----------|
| 1 | Проект **новый и пустой** |
| 2 | В Table Editor **нет** `tasks`, `clients`, `calendar_events` |
| 3 | Вы в **demo-проекте**, не production |
| 4 | `.env.local` **ещё не** указывает на старый production ref |

---

## 6. Ожидаемый результат bootstrap

### DDL

- **Success** без `ERROR:`
- Verification: **16 таблиц** в `public`

### Таблицы (16)

`ai_workspace_chats`, `app_state`, `calendar_event_participants`, `calendar_events`, `calendar_meeting_audit`, `calendar_meeting_guest_admissions`, `calendar_meeting_guest_invites`, `calendar_meeting_recordings`, `calendar_reminder_deliveries`, `client_notes`, `clients`, `notifications`, `tasks`, `team_chat_last_seen`, `team_chat_messages`, `user_presence`

### После bootstrap (до seed)

| Query | Ожидание |
|-------|----------|
| `clients_count` | **0** |
| `client_notes_count` | **0** |
| Storage buckets | **5**, все `public = false` |
| `meeting-recordings` policy | **1** строка |
| Repo tables checklist | все `present = true` |

---

## 7. Шаг B — Demo seed

1. **New query** в SQL Editor
2. Скопировать **весь** `SPIORA_DEMO_SEED.sql`
3. Run
4. Проверить verification в конце файла

### Ожидание после seed

| Query | Ожидание |
|-------|----------|
| `clients_count` | **25** |
| `client_notes_count` | **3** |
| `app_state` keys | 2 строки |
| notes → clients join | все `client_exists = true` |

---

## 8. Что делать при ошибке

### `relation "calendar_events" does not exist`

Bootstrap обрезан или выполнен не по порядку.  
**Действие:** Reset database (Settings → General) на пустом demo-проекте → повторить **полный** bootstrap.

### `relation "clients" already exists` / `constraint ... already exists`

Bootstrap уже запускался.  
**Действие:** **не** запускать bootstrap повторно — см. раздел 9.

### Bootstrap завершился частично (ERROR на середине)

1. Записать **номер секции** из комментария (`-- 0XX_...`)
2. Скопировать полный текст ошибки
3. Выполнить проверку:

```sql
SELECT COUNT(*) AS table_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';
```

| `table_count` | Действие |
|---------------|----------|
| `0` | Безопасно повторить полный bootstrap |
| `1–15` | **Reset database** → повторить bootstrap |
| `16` | Bootstrap фактически завершён — только verification; seed отдельно |
| `>16` | Проект не пустой — остановиться, разобрать вручную |

4. **Не** запускать повторно «вслепую»

### Seed: `there is no unique or exclusion constraint matching ON CONFLICT`

Таблица `clients` не создана — bootstrap не применён.  
**Действие:** сначала bootstrap, потом seed.

### `permission denied` на storage

Убедиться, что Storage включён (Dashboard → Storage). Повторить Run bootstrap.

---

## 9. Как не запускать bootstrap второй раз

```sql
SELECT COUNT(*) AS table_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';
```

| `table_count` | Действие |
|---------------|----------|
| `0` | Можно запустить bootstrap |
| `16` | Bootstrap применён — **не** запускать DDL снова |
| другое | См. раздел 8 |

Для повторной проверки скопируйте **только** секцию `VERIFICATION` из конца bootstrap или seed.

**Seed** безопасно перезапускать (idempotent ON CONFLICT).

---

## 10. После успешного bootstrap + seed

### ENV (`.env.local`, не коммитить)

```env
SPIORA_DEMO_MODE=true
SPIORA_ENABLE_SUPABASE=true
NEXT_PUBLIC_SUPABASE_URL=https://<NEW_DEMO_PROJECT_REF>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<Dashboard → Settings → API>
SPIORA_ALLOWED_SUPABASE_PROJECT_REFS=<NEW_DEMO_PROJECT_REF>
SPIORA_ENABLE_GOOGLE_INTEGRATIONS=false
```

### Smoke test

```powershell
npm run build
npm run dev
```

- Login → CRM: 25 clients
- Tasks CRUD
- Team chat message
- Calendar event create

---

## 11. Синхронизация migration history (когда CLI заработает)

Схема уже применена через SQL Editor. Пометить миграции 001–022 как applied:

```powershell
supabase login
supabase link --project-ref <NEW_DEMO_PROJECT_REF>
# supabase migration repair --status applied ... (по версиям CLI)
```

Или `supabase db diff --linked` — пустой diff = синхронизировано.

---

## 12. Ограничения SQL Editor

| Команда | Bootstrap | Seed |
|---------|-----------|------|
| `CREATE TABLE IF NOT EXISTS` | ✅ | ❌ |
| `INSERT ... ON CONFLICT` | ❌ | ✅ |
| `INSERT INTO storage.buckets` | ✅ | ❌ |
| `\i`, `\copy` (psql) | ❌ | ❌ |

---

## 13. Связанные документы

- `SPIORA_SUPABASE_BOOTSTRAP.sql` — схема 001–022
- `SPIORA_DEMO_SEED.sql` — demo-данные
- `SPIORA_CRM_POSTGRES_REPORT.md` — CRM PostgreSQL
- `SPIORA_SUPABASE_GAP_ANALYSIS.md` — gaps и repos

---

*Runbook подготовлен без выполнения SQL, commit, push и deploy.*
