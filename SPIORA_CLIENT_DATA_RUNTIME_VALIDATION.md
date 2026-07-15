# SPIORA — Client Data Runtime Validation (PR #15.1)

**Дата подготовки:** 2026-07-15  
**Статус:** Migration 023 + seed patch **применены вручную** на Spiora Demo (подтверждено SQL Editor)  
**Commit / push / deploy:** не выполнялись  

### PR #15.3 update

| | |
|--|--|
| Root cause | lexical `ORDER BY external_id DESC` → повтор `DOC-DEMO-0017` |
| Fix | numeric max + retry on 23505 + archive `.select("id")` |
| Runtime IDs | A=`DOC-DEMO-0017`, B=`DOC-DEMO-0018` (затем удалены) |
| Final active documents | **16** seed baseline |
| SAFE TO COMMIT / PUSH | **SAFE** (после явного подтверждения) |

---

## Результаты apply (факт)

| Этап | Статус | Примечание |
|------|--------|------------|
| PRE-FLIGHT / Migration PATCH_023 | ✅ | После фикса PRE-FLIGHT (`archived_at` до 023) |
| POST-MIGRATION C8 orphan documents | ✅ | `0` |
| Seed SEED_PATCH_023 | ✅ | Sample documents: DEMO-1001=2, DEMO-1002=2, DEMO-1025=1 |

Sample documents (POST-SEED, SQL Editor):

| external_id | documents_count |
|-------------|-----------------|
| DEMO-1001 | 2 |
| DEMO-1002 | 2 |
| DEMO-1025 | 1 |

Ожидаемые финальные counts (подтвердить отдельным query при необходимости):

| Метрика | Ожидание |
|---------|----------|
| active clients | 25 |
| active notes | ≥ 10 |
| active documents | 16 |
| notes без client_uuid | 0 |
| orphan documents | 0 |

---

## Цель PR #15.1

Безопасно применить migration 023 и fictional seed patch на **Spiora Demo Supabase**, затем проверить Client Notes и Documents Metadata в реальном runtime.

---

## Подготовленные файлы

| Файл | Назначение |
|------|------------|
| `SPIORA_SUPABASE_PATCH_023.sql` | Migration 023 + PRE/POST read-only verification |
| `SPIORA_DEMO_SEED_PATCH_023.sql` | 10 notes + 16 documents + idempotent backfill |
| `SPIORA_CLIENT_DATA_RUNTIME_VALIDATION.md` | Этот документ |

---

## 1. Проверка перед применением (manual)

Выполните **до** Run в SQL Editor:

| # | Проверка | Как | Ожидание |
|---|----------|-----|----------|
| 1 | Проект = Spiora Demo | Supabase Dashboard → project name / ref | Именно demo-проект, не production |
| 2 | Bootstrap 001–022 применён | Table Editor: `clients`, `client_notes` существуют | ✅ |
| 3 | 25 активных клиентов | PRE-FLIGHT query A1 | `active_clients_count = 25` |
| 4 | Существующие notes сохранены | PRE-FLIGHT query A3–A4 | `>= 3` строк NT-DEMO-* |
| 5 | Нет orphan notes | PRE-FLIGHT query A5 | `orphan_notes_by_external_id = 0` |
| 6 | SQL без destructive DDL | Review patch files | Нет `DROP TABLE`, `DROP COLUMN`, hard `DELETE` |
| 7 | Backfill находит клиентов | Все `client_id` = `DEMO-*` → join `clients.external_id` | 0 orphan после migration |
| 8 | Нет secrets | Review patch files | Нет URL, keys, project ref |

### Подтверждение безопасности patch-файлов

```
SPIORA_SUPABASE_PATCH_023.sql:
  ✅ Только ALTER TABLE … ADD COLUMN IF NOT EXISTS
  ✅ UPDATE backfill (non-destructive)
  ✅ CREATE TABLE IF NOT EXISTS client_documents
  ✅ CREATE INDEX IF NOT EXISTS
  ❌ DROP TABLE / DROP COLUMN / TRUNCATE / DELETE

SPIORA_DEMO_SEED_PATCH_023.sql:
  ✅ INSERT … ON CONFLICT DO NOTHING
  ✅ UPDATE backfill (idempotent)
  ❌ INSERT 25 clients
  ❌ secrets / production IDs
```

---

## 2. Backup (demo snapshot — read-only)

**Не экспортировать реальные данные** — база fictional. Достаточно сохранить результаты PRE-FLIGHT queries в таблицу ниже.

Опционально через Dashboard: **Table Editor → client_notes → Export CSV** (только NT-DEMO-* rows).

### Snapshot ДО migration (заполнить после PRE-FLIGHT Run)

| Метрика | Значение | Дата/время UTC |
|---------|----------|----------------|
| `active_clients_count` | ___ | ___ |
| `demo_clients_count` | ___ | ___ |
| `client_notes_total` | ___ | ___ |
| `client_notes_active` | N/A до 023 (нет `archived_at`) | ___ |
| `orphan_notes_by_external_id` | ___ | ___ |
| `client_documents_table_exists_before` | false | ___ |
| `client_uuid_column_exists_before` | false | ___ |

### Snapshot существующих notes (A4)

| note_id | client_id | author | text_preview |
|---------|-----------|--------|--------------|
| NT-DEMO-1 | DEMO-1001 | Daniel Cooper | Intro call completed… |
| NT-DEMO-2 | DEMO-1002 | Emma Wilson | Document checklist… |
| NT-DEMO-3 | DEMO-1013 | Daniel Cooper | Financial documents… |

*(Обновите после фактического PRE-FLIGHT Run)*

---

## 3. Инструкция для ручного выполнения

> **Ничего не выполнять автоматически.** Дождитесь явного подтверждения, затем следуйте шагам.

### Шаг 0 — App env

```env
SPIORA_ENABLE_SUPABASE=true
SUPABASE_URL=<demo project URL>
SUPABASE_SERVICE_ROLE_KEY=<server-side only>
```

Перезапустить dev-сервер **после** SQL apply.

### Шаг 1 — SQL Editor: Migration patch

1. Открыть **Supabase Dashboard → Spiora Demo → SQL Editor → New query**
2. Скопировать содержимое **`SPIORA_SUPABASE_PATCH_023.sql`**
3. **Run**
4. Проверить результаты **SECTION C — POST-MIGRATION VERIFICATION**

### Шаг 2 — Проверка после migration (до seed)

| Query | Ожидаемо |
|-------|----------|
| `SELECT COUNT(*) FROM clients WHERE archived_at IS NULL` | **25** |
| `SELECT COUNT(*) FROM client_notes WHERE archived_at IS NULL` | **>= 3** (старые notes сохранены) |
| `SELECT COUNT(*) FROM client_documents WHERE archived_at IS NULL` | **0** |
| `SELECT COUNT(*) FROM client_notes WHERE client_uuid IS NULL` | **0** |
| Orphan documents check | **0** |

### Шаг 3 — SQL Editor: Seed patch

1. **New query**
2. Скопировать **`SPIORA_DEMO_SEED_PATCH_023.sql`**
3. **Run**
4. Проверить **POST-SEED VERIFICATION**

### Шаг 4 — Финальные counts

```sql
SELECT COUNT(*) FROM clients WHERE archived_at IS NULL;
-- Ожидаемо: 25

SELECT COUNT(*) FROM client_notes WHERE archived_at IS NULL;
-- Ожидаемо: >= 10

SELECT COUNT(*) FROM client_documents WHERE archived_at IS NULL;
-- Ожидаемо: 16

SELECT COUNT(*) FROM client_notes WHERE client_uuid IS NULL;
-- Ожидаемо: 0

SELECT COUNT(*)
FROM client_documents d
LEFT JOIN clients c ON c.id = d.client_uuid
WHERE c.id IS NULL;
-- Ожидаемо: 0
```

### Шаг 5 — Перезапуск приложения

```bash
npm run dev
```

Открыть: `/clients/DEMO-1001`

---

## 4. Результаты migration (заполнить после apply)

| Этап | Статус | Дата | Примечание |
|------|--------|------|------------|
| PRE-FLIGHT snapshot | ☐ | | |
| Migration 023 (PATCH_023) | ☐ | | |
| POST-MIGRATION verification | ☐ | | |
| Seed patch (SEED_PATCH_023) | ☐ | | |
| POST-SEED verification | ☐ | | |

### Counts до / после

| Метрика | До migration | После migration | После seed |
|---------|--------------|-----------------|------------|
| active clients | 25 | 25 | 25 |
| active notes | ≥3 | ≥3 | **≥10** |
| active documents | 0 | 0 | **16** |
| notes без client_uuid | — | **0** | **0** |
| orphan documents | — | 0 | **0** |

---

## 5. Runtime validation (после ручного apply)

### Notes — owner / manager

| # | Действие | Owner | Manager | Результат |
|---|----------|-------|---------|-----------|
| 1 | Открыть `/clients/DEMO-1001` | ☐ | ☐ | Notes из PostgreSQL |
| 2 | Создать заметку | ☐ | ☐ | POST 200, note в списке |
| 3 | Редактировать заметку | ☐ | ☐ | PATCH 200, текст изменился |
| 4 | Перезагрузить страницу | ☐ | ☐ | Persistence OK |
| 5 | Архивировать заметку | ☐ | ☐ | DELETE 200, note исчез |
| 6 | RBAC: unauthorized | ☐ | — | 401 |

### Documents Metadata — owner / manager

| # | Действие | Owner | Manager | Результат |
|---|----------|-------|---------|-----------|
| 1 | Список на DEMO-1001 | ☐ | ☐ | 2 fictional docs |
| 2 | Всего в БД | — | — | 16 records |
| 3 | POST metadata (no binary) | ☐ | ☐ | 200, только metadata |
| 4 | PATCH status | ☐ | ☐ | 200 |
| 5 | Перезагрузить страницу | ☐ | ☐ | Persistence OK |
| 6 | Archive metadata | ☐ | ☐ (403) | Owner: 200; Manager: 403 |
| 7 | `storage_path` не в API | ☐ | ☐ | Network → JSON без path/bucket |
| 8 | `storage_path` не в UI | ☐ | ☐ | Только filename, type, badge |

### API leak check (DevTools → Network)

```http
GET /api/clients/DEMO-1001/documents
```

Response **не должен** содержать:

- `storage_path`
- `storage_bucket`
- `storageProvider`
- raw `metadata` JSONB
- `clients.id` UUID (internal client uuid)

Допустимо: `id` (document UUID), `clientId` (`DEMO-*`), `externalId` (`DOC-DEMO-*`).

### Integrations

| Проверка | Ожидание | OK |
|----------|----------|-----|
| Google Drive не вызывается | Network: нет drive.google.com для client card | ☐ |
| `.data` не используется | Server logs: нет `[client-notes] .data` | ☐ |
| PostgreSQL primary | `source: "postgresql"` в API response | ☐ |
| AI context sanitized | AI Workspace: notes summary + doc type/status; нет storage_path | ☐ |

---

## 6. RBAC matrix (expected)

| Action | Owner | Manager | Unauthenticated |
|--------|-------|---------|-----------------|
| GET notes/documents | ✅ | ✅ | ❌ 401 |
| POST note | ✅ | ✅ | ❌ 401 |
| PATCH note | ✅ | ✅ | ❌ 401 |
| DELETE (archive) note | ✅ | ✅ | ❌ 401 |
| POST document metadata | ✅ | ✅ | ❌ 401 |
| PATCH document | ✅ | ✅ | ❌ 401 |
| DELETE (archive) document | ✅ | ❌ 403 | ❌ 401 |
| Wrong client note ID | ❌ 404 | ❌ 404 | ❌ 401 |

---

## 7. Google dependency status

| Компонент | После apply |
|-----------|-------------|
| Client Notes source | PostgreSQL only |
| Client Documents source | PostgreSQL only |
| Google Drive для карточки | Не используется |
| Google Sheets для карточки | Не используется (при Supabase mode) |
| `.data` fallback | Не используется |

---

## 8. Отсутствие утечек storage metadata

| Вектор | Защита | Проверено |
|--------|--------|-----------|
| Public API | `toPublicDocument()` strips path/bucket/provider | ☐ |
| UI | `ClientDocuments` не рендерит path | ☐ |
| AI context | `buildClientAiContext` без path/UUID | ☐ |
| Seed | Fictional paths only (`demo/clients/…`) | ✅ (review) |

---

## 9. SAFE / NOT SAFE

| Действие | Вердикт |
|----------|---------|
| **Apply SPIORA_SUPABASE_PATCH_023.sql** на Spiora Demo | **SAFE TO APPLY** после PRE-FLIGHT = 25 clients, 0 orphan notes |
| **Apply SPIORA_DEMO_SEED_PATCH_023.sql** | **SAFE TO APPLY** после успешного migration patch |
| **Runtime validation** | Выполнить вручную по секции 5 |
| **Commit patch files** | **SAFE TO COMMIT** (fictional data, no secrets) — *только после вашего подтверждения* |
| **PUSH** | **SAFE TO PUSH** после commit patch files + успешной runtime validation |
| **Apply на production** | **NOT SAFE** — только Spiora Demo |

---

## 10. Следующий шаг

1. Подтвердите готовность применить patch на Spiora Demo
2. Выполните шаги из раздела 3 вручную
3. Заполните таблицы результатов в этом документе
4. Сообщите результаты — тогда можно commit patch files и push PR #15.1

---

*PR #15.1 — подготовлено, ожидает подтверждения для apply*
