# SPIORA — Client Notes + Documents Metadata → PostgreSQL (PR #15)

**Дата:** 2026-07-15  
**Статус:** реализация завершена в коде; migration и seed **не применялись** в этой сессии.

---

## Цель

PostgreSQL становится primary-источником для карточки клиента: клиенты (PR #13), **заметки**, **метаданные документов**. Google Drive/Sheets не используются как основной источник карточки.

---

## Old flow → New flow

### Заметки (Client Notes)

| Слой | Было | Стало |
|------|------|-------|
| UI | `ClientNotes` — только POST | CRUD + archive через API |
| API | `POST /api/clients/[id]/notes` | GET/POST/PATCH/DELETE |
| Store | `client-notes-repo` + legacy `.data` / Sheets | `client-notes-store.ts` → PostgreSQL |
| DB | `client_notes.client_id` = `external_id` | + `client_uuid` FK → `clients.id` |

### Документы (metadata)

| Слой | Было | Стало |
|------|------|-------|
| UI | Список из detail (часто пустой) | `ClientDocuments` — metadata + empty/hint |
| API | Не было | GET/POST/PATCH/DELETE metadata |
| Store | `documents: []` в Postgres mode | `client-documents-store.ts` |
| DB | Нет таблицы | `client_documents` (metadata only) |

### Общая схема

```
Client Card (UI)
  → API routes (/api/clients/[id]/notes|documents)
  → client-*-store.ts (RBAC, validation)
  → *-repo.ts (service role, server-only)
  → PostgreSQL (clients, client_notes, client_documents)
```

При `SPIORA_ENABLE_SUPABASE=true`: **только PostgreSQL**, без silent fallback в Google / `.data`.

---

## Schema

### client_notes (расширение)

| Поле | Тип | Назначение |
|------|-----|------------|
| `id` | TEXT (legacy) | NT-DEMO-* — **не мигрирован в UUID** (documented gap) |
| `client_id` | TEXT | Legacy `external_id` (deprecated) |
| `client_uuid` | UUID FK | → `clients.id` |
| `author_user_id` | TEXT | ID пользователя |
| `author_name` | TEXT | Отображаемое имя |
| `content` | TEXT | Основной текст |
| `text` | TEXT | Legacy (deprecated) |
| `created_at` / `updated_at` / `archived_at` | TIMESTAMPTZ | |
| `is_demo` | BOOLEAN | |

Индексы: `(client_uuid, created_at)`, `(client_uuid, archived_at)`.

### client_documents (новая)

| Поле | Тип | Назначение |
|------|-----|------------|
| `id` | UUID PK | |
| `client_uuid` | UUID FK | → `clients.id` |
| `external_id` | TEXT UNIQUE | DOC-DEMO-* |
| `file_name` / `original_file_name` | TEXT | |
| `mime_type` / `size_bytes` | | Metadata cap 50 MB |
| `document_type` / `status` | TEXT | Machine keys |
| `storage_provider` / `storage_bucket` / `storage_path` | TEXT | Internal only |
| `uploaded_by_*` / `uploaded_at` | | |
| `archived_at` / `is_demo` / `metadata` | | JSONB |

**Не хранится:** binary, signed URLs, service-role credentials.

---

## Repositories

- `src/lib/supabase/client-notes-repo.ts` — list/create/update/archive by `client_uuid`
- `src/lib/supabase/client-documents-repo.ts` — list/create/update/archive + `toPublicDocument()`

---

## API

| Method | Route | RBAC |
|--------|-------|------|
| GET | `/api/clients/[id]/notes` | authenticated |
| POST | `/api/clients/[id]/notes` | owner, manager |
| PATCH | `/api/clients/[id]/notes/[noteId]` | owner, manager |
| DELETE | `/api/clients/[id]/notes/[noteId]` | owner, manager (archive) |
| GET | `/api/clients/[id]/documents` | authenticated |
| POST | `/api/clients/[id]/documents` | owner, manager (metadata only) |
| PATCH | `/api/clients/[id]/documents/[documentId]` | owner, manager |
| DELETE | `/api/clients/[id]/documents/[documentId]` | owner (archive) |

Locale-aware errors через `translateApiMessage`. Raw Supabase errors не отдаются.

---

## Demo seed

- **10** заметок (`NT-DEMO-1` … `NT-DEMO-10`)
- **16** document metadata (`DOC-DEMO-001` … `DOC-DEMO-016`)
- Файлы: `SPIORA_DEMO_SEED.sql`, `supabase/seeds/clients-demo.sql`
- `ON CONFLICT DO NOTHING`, fictional paths, `@example.com`

---

## UI

- `ClientNotes` — create, edit, archive, loading/error, EN/RU
- `ClientDocuments` — list metadata, badges, empty state, upload hint
- `ClientDetailView` — documents panel always visible

---

## Google dependency

| Модуль | Demo + Supabase mode |
|--------|---------------------|
| Client Notes | ❌ Google |
| Client Documents | ❌ Google Drive |
| Client Card | ✅ работает без Google |

Google остаётся optional integration (Settings) — future import/export.

---

## AI context

`buildClientAiContext` передаёт:
- summaries notes (лимит 8 × 500 символов)
- document name, type, status, upload date (лимит 10)

**Не передаёт:** storage_path, internal UUID, metadata debug.

---

## Security audit

| Риск | Митигация |
|------|-----------|
| Horizontal ID access | client existence + note/document ownership by `client_uuid` |
| ID enumeration | generic 404, no raw errors |
| Mass assignment | explicit validation per field |
| MIME spoofing | regex validation |
| Unsafe filename / path traversal | `sanitizeFileName`, `validateStoragePath` |
| XSS in notes | plain text render (no HTML) |
| Archive vs delete | soft archive only |
| Service role | server-only repos |
| Public API leak | `toPublicDocument()` strips path/bucket |

**RLS:** не применён в PR #15 — см. `SPIORA_CLIENT_DATA_MIGRATION_PLAN.md`.

---

## Known gaps

1. **`client_notes.id` остаётся TEXT** — UUID migration отложена; dual-read по `client_uuid` + legacy `client_id`.
2. **Binary upload / Storage bucket** — out of scope; UI показывает hint.
3. **RLS / Supabase Auth** — future PR.

---

## Test / build results

```bash
npm test   → 547 pass, 0 fail
npm run build → success (Next.js production build)
```

---

## SAFE / NOT SAFE

| Действие | Вердикт |
|----------|---------|
| **COMMIT** | **SAFE TO COMMIT** — код, migration file, seed, tests, docs; без секретов и production IDs |
| **APPLY MIGRATION 023** | **NOT SAFE TO APPLY** без отдельного подтверждения и backup; требует проверки на staging |

---

*PR #15 — Client Notes + Documents Metadata → PostgreSQL*
