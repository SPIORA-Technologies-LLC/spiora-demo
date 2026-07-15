# SPIORA — План миграции Client Notes + Documents (PR #15)

## Порядок применения

1. Backup базы (snapshot / pg_dump).
2. Применить migrations до `022_clients.sql` (если ещё не применены).
3. **Применить `023_client_notes_documents.sql`** в SQL Editor или через migration pipeline.
4. Применить обновлённый seed: `SPIORA_DEMO_SEED.sql` или `supabase/seeds/clients-demo.sql`.
5. Перезапустить приложение с `SPIORA_ENABLE_SUPABASE=true`.
6. Пройти checklist: `SPIORA_CLIENT_DATA_RUNTIME_CHECKLIST.md`.

---

## Migration 023 — что делает

### client_notes

- `ADD COLUMN IF NOT EXISTS` — без destructive DDL
- Backfill `content` ← `text`, `author_name` ← `author`
- Backfill `client_uuid` ← join `clients.external_id = client_notes.client_id`
- FK + индексы
- **Не удаляет** `client_id`, `text`, `author`
- **Не меняет тип** `id` (TEXT → UUID отложено)

### client_documents

- `CREATE TABLE IF NOT EXISTS client_documents`
- Metadata only; `storage_path` — internal fictional paths

---

## Dual-read (временный)

| Сценарий | Поведение |
|----------|-----------|
| Notes с `client_uuid` | Primary read path |
| Notes только с `client_id` | Fallback read by `external_id` после migration backfill |
| Legacy note IDs (NT-DEMO-*) | Сохраняются; API использует string id |

После полной backfill все demo rows должны иметь `client_uuid`.

---

## Rollback strategy

Migration 023 **не destructive** — rollback:

1. Остановить приложение.
2. `DROP TABLE IF EXISTS client_documents;` (если нет production data).
3. `ALTER TABLE client_notes DROP COLUMN IF EXISTS client_uuid, ...` — только если колонки не используются production.
4. Откатить deploy на предыдущую версию приложения.

**Внимание:** после создания notes/documents через новое API rollback потребует сохранения данных.

---

## Future RLS policies (не в PR #15)

```sql
-- Пример будущих policies (draft)
-- client_notes: SELECT для authenticated team members
-- client_notes: INSERT/UPDATE для owner|manager
-- client_notes: DELETE (archive) для owner|manager
-- client_documents: SELECT для authenticated
-- client_documents: INSERT/UPDATE для owner|manager
-- client_documents: archive DELETE для owner only
-- Все policies через clients.team_id или assigned_user_id (TBD)
```

Service role остаётся на server-side до внедрения Supabase Auth + RLS.

---

## Out of scope (следующие PR)

- Storage bucket + binary upload
- OCR
- Google Drive import/export UI
- `client_notes.id` → UUID migration
- Global Demo Reset
- Knowledge Base / Lead Review / Formgrid migration

---

## Environment

```env
SPIORA_ENABLE_SUPABASE=true
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...  # server only, never NEXT_PUBLIC_
```

Optional (local dev only, **не на Vercel**):

```env
SPIORA_CRM_LEGACY_FALLBACK=true  # explicit log; notes/docs не fallback в PR #15
```

---

*PR #15 migration plan*
