# SPIORA CRM PostgreSQL Report

**PR:** #13 — CRM PostgreSQL Foundation  
**Дата:** 15 июля 2026  
**Статус:** реализация без apply migration / deploy / commit

---

## 1. Текущий data flow (до PR)

```
UI → /api/clients → google-sheets/service.ts
  → [Google on] GoogleSheetsClient → Sheets API / public CSV
  → [Google off] demo-data.ts (DEMO_CLIENTS, in-memory notes)
```

**Заметки:** Supabase `client_notes` только при public CSV + Supabase; иначе Sheets или `.data`.

---

## 2. Новый data flow (после PR)

```
UI → /api/clients → clients/store.ts
  → [isSupabaseConfigured()] clients-repo.ts → PostgreSQL clients
  → [!Supabase + SPIORA_CRM_LEGACY_FALLBACK=true, local only] legacy path (logged)
  → [!Supabase, no fallback] demo-data.ts / Google (если включён)
```

**Create/Update/Archive:** только PostgreSQL path (503/ошибка без Supabase).

**Заметки:** при PostgreSQL CRM — `client_notes` через `local-notes.ts` + `client_id = external_id`.

---

## 3. Поля схемы `clients`

| Колонка | API / UI |
|---------|----------|
| `external_id` | `Client.id` (DEMO-1001) |
| `full_name` | `Client.name` |
| `email`, `phone` | карточка, поиск |
| `status` | фильтр, dashboard |
| `pipeline_stage` | pipeline (новое) |
| `assigned_manager_name` | `Client.manager`, фильтр |
| `country`, `citizenship`, `direction` | фильтры, AI context |
| `service_type` | фильтр |
| `passport_number` | таблица, поиск |
| `notes_summary` | краткое описание |
| `legacy_fields` jsonb | Croatia Sheets-only поля |
| `archived_at` | soft delete |

**Gap:** `client_notes` без FK — связь по `external_id` (совместимо с существующей миграцией 001).

---

## 4. API changes

| Route | Изменение |
|-------|-----------|
| `GET /api/clients` | source: `postgresql` |
| `POST /api/clients` | **новый** — create (owner/manager) |
| `GET /api/clients/[id]` | PostgreSQL detail |
| `PATCH /api/clients/[id]` | **новый** — update |
| `DELETE /api/clients/[id]` | **новый** — archive (owner only) |
| `GET /api/clients/filters` | из PostgreSQL |

Контракт `Client`, `ClientsListResult`, `ClientDetail` сохранён; добавлен source `postgresql`.

---

## 5. Demo seed

**Файл:** `supabase/seeds/clients-demo.sql`  
**Клиентов:** 25 (DEMO-1001 … DEMO-1025)  
**Данные:** только @example.com, вымышленные имена  
**Idempotent:** `ON CONFLICT (external_id) DO NOTHING`

---

## 6. Что осталось на Google

| Компонент | Статус |
|-----------|--------|
| CRM read/write primary | **Отключён** при Supabase on |
| Formgrid / Lead Review | без изменений |
| KB Drive | без изменений |
| Google code | сохранён для future import/export |
| `SPIORA_ENABLE_GOOGLE_INTEGRATIONS` | default false в demo |

---

## 7. Что осталось на `.data`

| Компонент | Статус |
|-----------|--------|
| CRM clients | **нет** при Supabase on |
| client_notes fallback | только без Supabase |
| Tasks, Chat, Calendar, … | без изменений (вне scope) |

---

## 8. Security risks

| Риск | Уровень | Комментарий |
|------|---------|-------------|
| Service role без RLS | **High** | Зафиксировано; отдельный PR для RLS |
| ID enumeration | Medium | external_id предсказуем DEMO-* |
| Mass assignment | Low | whitelist в validation |
| Raw Supabase errors | Low | API возвращает i18n messages |
| Legacy fallback | Medium | только `SPIORA_CRM_LEGACY_FALLBACK` + не Vercel |

---

## 9. Test results

Запуск: `npm test`, `npm run build` (см. итоговый отчёт сессии).

Покрытие:
- validation, map, permissions, config
- migration shape, seed idempotency
- duplicate external ID detection
- server-only repo

---

## 10. SAFE / NOT SAFE

| Действие | Вердикт |
|----------|---------|
| **COMMIT** | **SAFE** — только fictional demo, нет production IDs |
| **APPLY MIGRATION** | **SAFE** на **отдельном demo Supabase** после review SQL |
| **APPLY MIGRATION** на prod ref | **NOT SAFE** |
| **ENABLE на Vercel** | **SAFE** только с demo Supabase + seed |

---

*Отчёт подготовлен в рамках PR #13 без apply migration и deploy.*
