# SPIORA — Runtime Checklist (PR #15)

**Не выполнять без явного подтверждения.**

---

## Pre-flight

- [ ] Backup базы создан
- [ ] `SPIORA_ENABLE_SUPABASE=true` в env
- [ ] Service role key только server-side
- [ ] Migration `023_client_notes_documents.sql` готов к применению
- [ ] Seed файлы обновлены

---

## Apply migration 023

- [ ] Выполнить `supabase/migrations/023_client_notes_documents.sql` в SQL Editor
- [ ] Проверить: колонки `client_notes.client_uuid`, `content` существуют
- [ ] Проверить: таблица `client_documents` создана
- [ ] Проверить backfill:

```sql
SELECT COUNT(*) FROM client_notes WHERE client_uuid IS NULL AND client_id IS NOT NULL;
-- ожидается 0 для demo rows после seed
```

---

## Apply seed

- [ ] Выполнить `SPIORA_DEMO_SEED.sql` (или `supabase/seeds/clients-demo.sql`)
- [ ] `client_notes_count >= 10`
- [ ] `client_documents_count >= 16`

---

## App restart

- [ ] Перезапустить dev/prod app
- [ ] Открыть demo client `DEMO-1001`

---

## Notes CRUD

- [ ] Список заметок загружается из PostgreSQL
- [ ] Создать новую заметку → сохраняется
- [ ] Редактировать заметку → изменения persist
- [ ] Архивировать заметку → исчезает из списка
- [ ] Перезапуск app → данные на месте

---

## Documents metadata

- [ ] Список document metadata отображается (filename, type, status, size, author, date)
- [ ] Badge storage state (Demo / Storage)
- [ ] Empty state + hint «Загрузка файлов будет доступна после настройки Storage»
- [ ] (Owner) PATCH status — optional manual API test
- [ ] (Owner) Archive metadata — optional manual API test

---

## Google / fallback verification

- [ ] Client Card работает при отключённом Google
- [ ] Network tab: нет вызовов Google Drive для notes/documents
- [ ] `.data` fallback не используется (server logs)

---

## AI Workspace

- [ ] AI context содержит note summaries и document type/status
- [ ] AI context **не** содержит storage_path / internal UUID

---

## Security smoke

- [ ] PATCH note другого client → 404/403
- [ ] Unauthorized → 401
- [ ] Manager не может archive document (403)

---

## Post-check

- [ ] `npm test` green
- [ ] `npm run build` green

---

## Sign-off

| Проверка | OK | Дата | Примечание |
|----------|----|------|------------|
| Migration 023 | | | |
| Seed | | | |
| Notes CRUD | | | |
| Documents list | | | |
| No Google dependency | | | |

---

*PR #15 — runtime checklist (do not auto-apply)*
