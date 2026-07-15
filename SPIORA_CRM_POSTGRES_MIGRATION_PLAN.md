# SPIORA CRM PostgreSQL Migration Plan

**PR:** #13 (foundation) → PR #14 (notes + documents metadata)  
**Дата:** 15 июля 2026

---

## Phase A — PR #13 (этот PR)

### Scope
- Таблица `clients` + индексы
- `clients-repo.ts`, `clients/store.ts`
- API CRUD + search/filters
- Demo seed 25 клиентов
- Переключение primary source на PostgreSQL при `SPIORA_ENABLE_SUPABASE=true`

### Файлы
| Файл | Действие |
|------|----------|
| `supabase/migrations/022_clients.sql` | новый |
| `supabase/seeds/clients-demo.sql` | новый |
| `src/lib/supabase/clients-repo.ts` | новый |
| `src/lib/clients/*` | новый |
| `src/lib/google-sheets/service.ts` | thin re-export |
| `src/app/api/clients/*` | POST/PATCH/DELETE |
| `src/components/clients/*` | source UI |
| `src/lib/clients/clients-postgres.test.ts` | тесты |

### Критерии готовности
- [ ] Миграция 022 применена на demo Supabase
- [ ] Seed выполнен, 25 клиентов
- [ ] `SPIORA_ENABLE_SUPABASE=true` → list/detail из Postgres
- [ ] Google Sheets не вызывается в demo+Supabase mode
- [ ] npm test + build green

### Риски
- Заметки по `client_id` должны использовать `external_id`
- Без seed UI покажет пустой список

---

## Phase B — PR #14 (следующий)

### Scope
- `client_documents` metadata table
- Полная унификация notes с FK на `clients.external_id`
- Documents tab из PostgreSQL
- Удаление зависимости notes от dual local path

### Оценка: 1–2 недели

---

## Phase C — Production cutover

1. Import script Sheets → Postgres (one-time)
2. `SPIORA_ENABLE_GOOGLE_INTEGRATIONS=false` для CRM
3. Google Sheets → export-only cron
4. RLS + `org_id` (отдельный PR)

### Оценка: 2–3 недели после PR #14

---

## Инструкция apply (не выполнять автоматически)

```sql
-- 1. Supabase SQL Editor или psql
\i supabase/migrations/022_clients.sql

-- 2. Seed
\i supabase/seeds/clients-demo.sql
```

```env
SPIORA_DEMO_MODE=true
SPIORA_ENABLE_SUPABASE=true
SPIORA_ALLOWED_SUPABASE_PROJECT_REFS=<demo-ref>
NEXT_PUBLIC_SUPABASE_URL=https://<demo-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<demo-service-role>
SPIORA_ENABLE_GOOGLE_INTEGRATIONS=false
```

---

## Rollback

- Таблица `clients` не удаляет legacy данные
- Отключить `SPIORA_ENABLE_SUPABASE` → возврат к demo-data (локально)
- `DROP TABLE clients` — только вручную на demo project

---

*План без автоматического apply migration.*
