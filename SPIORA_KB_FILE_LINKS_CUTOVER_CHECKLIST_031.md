# KB File Links — Cutover checklist 031

Do **not** auto-apply. Apply manually in Supabase SQL editor after backup.

## Prerequisites
- Patch **026** (articles) already applied

## Steps
1. Backup
2. Run `SPIORA_SUPABASE_PATCH_031_KNOWLEDGE_BASE_FILE_LINKS.sql`
3. Smoke test: Files → **Добавить ссылку** → save → open from list; reader can open on published material
4. Optional rollback: `SPIORA_SUPABASE_PATCH_031_KNOWLEDGE_BASE_FILE_LINKS_ROLLBACK.sql`

## Note
Patch **030** (`external_url` on the article) remains available for legacy single-URL materials.
New links live in `knowledge_base_links` and appear in the **Files** panel.
