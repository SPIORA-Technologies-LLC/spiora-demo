# PR #21 — Knowledge Base Editable Tables Phase 1A (Report)

## Architecture
- Article remains primary entity (text EN/RU + optional files).
- Tables are first-class child entities: Postgres `knowledge_base_tables` with JSONB `columns` + `rows`.
- Stable column/row UUIDs; rename does not change ids.
- Visibility mirrors attachments: draft → owner; published → readers; archived hidden.
- UI: custom editable grid (no TanStack/AG Grid/Handsontable).
- Auto Draft reused; empty open+leave does not create article until first table action.

## Deliverables (repo only — not applied)
- `supabase/migrations/028_knowledge_base_tables.sql`
- `SPIORA_SUPABASE_PATCH_028_KNOWLEDGE_BASE_TABLES.sql`
- `SPIORA_SUPABASE_PATCH_028_KNOWLEDGE_BASE_TABLES_ROLLBACK.sql`
- API: list/create, get/patch, archive, import-csv, export.csv
- UI: `KbTableGrid`, `KbTablesPanel`; menu **Таблица** enabled
- Tests: `kb-tables.test.ts`
- Docs: threat model + runtime checklist

## JSON format
See architecture audit. Types: text | number | date | boolean | url.

## Limits
- ≤ 1000 rows, ≤ 50 columns, ≤ 50 000 cells
- ≤ 2000 chars/cell, ≤ 2000 chars description, CSV ≤ 5 MB, JSON ≤ ~2 MB
- ≤ 10 tables / article

## Audit notes (pre-commit)
- Shared limits via `table-limits.ts` (client + server)
- Stable `column.id` / `row.id`; rename preserves cells
- CSV export escapes `= + - @` and leading tab/CR/whitespace formula forms
- CSV import shows client-side preview (headers + types) before create
- Autosave debounce 900ms; 409 → reload (no blind overwrite)
- Empty open / cancelled CSV preview does not create draft until Create or Confirm import
- Migration 028 **not applied**

## Deferred to Phase 1B
- XLSX import/export, sheet picker
- Richer sort/filter UI polish
- Dual-locale column labels
- PREFLIGHT_028 / VALIDATE_028 cutover scripts (before apply)

## Deferred to Phase 2
- Formulas, merged cells, collab, version history, AI indexing

## SAFE / NOT SAFE
| Action | Status |
|--------|--------|
| Commit | **SAFE TO COMMIT** (code + SQL files) |
| Push / deploy | **NOT SAFE** until after migration apply + smoke |
| Apply migration 028 | **NOT SAFE TO APPLY** until backup + PREFLIGHT/VALIDATE 028 |
