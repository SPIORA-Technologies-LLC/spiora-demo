# SPIORA PostgreSQL Runtime Validation

**PR:** #13.5 — Connect Demo CRM to PostgreSQL  
**Дата:** 15 июля 2026  
**Окружение:** локальный `npm run dev` → `http://localhost:3000`  
**Supabase:** новый demo-проект (bootstrap 001–022 + demo seed применены)

---

## 1. Проверка `.env.local`

| Переменная | Ожидание | Факт | Статус |
|------------|----------|------|--------|
| `SPIORA_DEMO_MODE` | `true` | `true` | ✔ |
| `SPIORA_ENABLE_SUPABASE` | `true` | `true` | ✔ |
| `SPIORA_ENABLE_GOOGLE_INTEGRATIONS` | `false` | `false` | ✔ |
| `NEXT_PUBLIC_SUPABASE_URL` | новый проект | задан (`*.supabase.co`) | ✔ |
| `SUPABASE_SERVICE_ROLE_KEY` | новый проект | задан | ✔ |
| `SUPABASE_ANON_KEY` | задан (по ТЗ) | **не задан** | ⚠ см. примечание |
| `SPIORA_ALLOWED_SUPABASE_PROJECT_REFS` | demo ref | задан | ✔ |

**Примечания:**

- `SUPABASE_ANON_KEY` для CRM **не обязателен** — приложение использует `SUPABASE_SERVICE_ROLE_KEY` только server-side (`src/lib/supabase/config.ts`). Browser anon key не участвует в `/api/clients`.
- `AUTH_PASSWORD_OWNER` **не задан** — для owner (`olivia@spiora.demo`) в dev используется fallback `demo-owner-local` (`src/lib/auth/users.ts`).
- Google credentials (SA, Spreadsheet ID) **остались в файле**, но при `SPIORA_ENABLE_GOOGLE_INTEGRATIONS=false` **не используются** для CRM.

**Секреты в отчёт не включены.**

---

## 2. Логика маршрутизации CRM

При `SPIORA_ENABLE_SUPABASE=true` + валидных Supabase env:

```
/api/clients* → clients/store.ts → isCrmPostgresPrimary() → clients-repo.ts → PostgreSQL
```

Legacy path (`demo-data.ts`, Google Sheets, `.data/`) **не вызывается**, если:

- Supabase configured ✔
- `SPIORA_CRM_LEGACY_FALLBACK` ≠ `true` ✔

---

## 3. Runtime API — результаты (автоматическая проверка)

Dev server: **запущен**, порт **3000**.

| Запрос | HTTP | Источник (`source`) | Результат |
|--------|------|---------------------|-----------|
| `GET /api/clients?page=1&pageSize=30` | 200 | **postgresql** | total **25**, items 25 |
| `GET /api/clients/filters` | 200 | **postgresql** | managers **4** |
| `GET /api/clients?search=Carter` | 200 | **postgresql** | найден **DEMO-1001** |
| `GET /api/clients/DEMO-1001` | 200 | **postgresql** | client OK, notes **1** |
| `POST /api/clients` (create) | 200 | **postgresql** | создан **DEMO-1026** |
| `PATCH /api/clients/DEMO-1026` | 200 | — | status → `In progress`, notes updated |
| `GET /api/clients/DEMO-1026` (after patch) | 200 | **postgresql** | изменения сохранены |
| `DELETE /api/clients/DEMO-1026` (manager) | **403** | — | RBAC: archive только **owner** |
| `DELETE /api/clients/{temp}` (owner) | 200 | — | archive OK, `archived_at` установлен |

### CRUD

| Операция | PostgreSQL | Комментарий |
|----------|------------|-------------|
| **Create** | ✔ | `DEMO-1026` записан в `clients` |
| **Read** | ✔ | 25 seed + новый клиент |
| **Update** | ✔ | PATCH сохраняется, виден при повторном GET |
| **Archive/Delete** | ✔ | **403 для manager** — ожидаемо. **Owner archive проверен** (см. §9) |

### Персистентность

- Create/Update идут в **PostgreSQL**, не в `.data/` и не в `demo-data.ts`.
- После PATCH клиент **DEMO-1026** остаётся в списке с обновлёнными полями — данные **не ephemeral**.
- Тестовый клиент **DEMO-1026** удалён после validation; demo-база возвращена к seed-состоянию (§9).

---

## 4. UI-модули — источник данных

| Модуль | Источник сейчас | Комментарий |
|--------|-----------------|-------------|
| **CRM List** | **postgresql** | `source: postgresql` в API |
| **Client Card** | **postgresql** | detail + notes из Postgres |
| **Search** | **postgresql** | ILIKE в `clients` table |
| **Filters** | **postgresql** | managers/countries из Postgres |
| **Dashboard (Command Center)** | **demo (static TS seed)** | `FirstImpressionView` → `first-impression-seed.ts`, **не** `getDashboardStats()` |
| **Tasks** | postgresql **или** `.data` | dual-path; при Supabase on → Postgres |
| **Team Chat** | postgresql **или** `.data` | dual-path |
| **Calendar** | postgresql **или** `.data` | dual-path |
| **Notifications** | postgresql **или** `.data` | dual-path |
| **AI Workspace (CRM context)** | **postgresql** | `listAllClients()` → store → Postgres |
| **Analytics Croatia** | **postgresql** (clients part) | `listAllClients()`; supplement из `app_state` |
| **Formgrid / Lead Review** | **google** (если включить) / unavailable | Google off → пустая очередь |
| **Knowledge Base** | **demo** / Google Drive | не в Postgres |

---

## 5. Google / demo / PostgreSQL — сводка

### ✔ Идут в PostgreSQL (CRM path)

- `GET/POST /api/clients`
- `GET/PATCH/DELETE /api/clients/[id]`
- `GET /api/clients/filters`
- `client_notes` (через Supabase при Postgres CRM)
- AI client lookup / structured search (чтение CRM)
- Analytics Croatia (client rows)

### ✔ Ещё используют demo storage (не CRM)

| Модуль | Хранилище |
|--------|-----------|
| Dashboard Command Center UI | static TS seed |
| Knowledge Base (demo mode) | `.data` / demo-articles |
| AI canned responses | TS scenarios |
| Analytics overview KPIs (если отдельная страница) | static / computed |

### ✔ Ещё могут использовать Google (отключено флагом)

| Модуль | При `GOOGLE=false` |
|--------|-------------------|
| CRM Clients | **не вызывается** ✔ |
| Formgrid leads | unavailable / empty |
| KB Drive listing | не используется (demo KB) |
| Google Sheets diagnostic | 404 в demo |

**CRM не обращается к Google Sheets, `demo-data.ts` или `.data/` при текущем `.env.local`.**

---

## 6. Demo clients из PostgreSQL

| Проверка | Результат |
|----------|-----------|
| Количество в API | **25** (seed) |
| `source` в ответе | **postgresql** |
| DEMO-1001 в search | ✔ найден |
| Notes для DEMO-1001 | ✔ 1 заметка (NT-DEMO-1) |

---

## 7. Что осталось перевести (вне scope PR #13.5)

| Приоритет | Модуль | Целевое хранилище |
|-----------|--------|-------------------|
| High | Dashboard live stats | PostgreSQL (`getDashboardStats` уже есть, UI не подключён) |
| High | Knowledge Base | Postgres + Storage |
| Medium | Formgrid / Lead Review | Postgres ingest |
| Medium | `SUPABASE_ANON_KEY` | опционально, если понадобится client-side Supabase |
| Low | Emigrant Desk | отдельный Supabase (off в demo) |

---

## 8. Известные ограничения validation

1. Прямой `@supabase/supabase-js` из standalone Node дал `fetch failed` (TLS/CA); через Next.js API **работает** (`node --use-system-ca` в dev script).
2. Dashboard Command Center UI по-прежнему на static seed (вне scope PR #13.5).

---

## 9. Post-validation cleanup (PR #13.1)

Выполнено под owner (`olivia@spiora.demo`) после runtime validation:

| Шаг | Результат |
|-----|-----------|
| Hard delete `DEMO-1026` (validation artifact) | ✔ HTTP 204 |
| Активных demo-клиентов (`archived_at IS NULL`, `is_demo=true`) | **25** |
| Создан временный клиент для archive-теста | ✔ `POST /api/clients` → 200 |
| Archive (`DELETE /api/clients/{id}`) | ✔ HTTP 200, `ok: true` |
| `archived_at` в PostgreSQL | ✔ установлен (timestamptz) |
| Hard delete временной записи | ✔ HTTP 204 |
| Финальный count активных seed-клиентов | **25** |

**Seed-состояние demo Supabase восстановлено.**

---

## 10. Вердикт PR #13.5

| Критерий | Статус |
|----------|--------|
| CRM читает из PostgreSQL | **✔ PASS** |
| 25 demo clients отображаются | **✔ PASS** |
| Search / filters / card | **✔ PASS** |
| Create / Update в Postgres | **✔ PASS** |
| Google/demo/.data для CRM | **✔ не используются** |
| Archive | **✔ PASS** (owner-only RBAC + archive verified) |
| Dashboard UI → Postgres | **✗ не подключён** (static seed) |

**Общий вердикт:** CRM **подключён к PostgreSQL как primary backend** и работает локально. PR #13.5 **выполнен** для CRM; Dashboard UI остаётся на static demo content.

---

*Validation выполнена без изменений UI, migrations и `.env.local`. Post-validation cleanup вернул demo-базу к 25 seed-клиентам. Секреты не включены.*
