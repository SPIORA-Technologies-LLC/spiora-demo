# PR #21 — Knowledge Base Editable Tables Cutover Checklist (028)

Manual cutover only. **Do not** auto-apply migration, push, or deploy until the steps below pass.

## Facts (Phase 1A)

| Item | Value |
|------|--------|
| Table | `public.knowledge_base_tables` |
| Document storage | JSONB `columns` + `rows` (stable IDs) |
| Limits | ≤1000 rows, ≤50 columns, ≤50 000 cells, ≤2000 chars/cell, description ≤2000 |
| Optimistic concurrency | `revision` (default 1); API returns **409** on conflict |
| Hard delete | Blocked (`spiora_block_hard_delete` trigger) + `REVOKE DELETE` |
| RLS | Owner insert/select/update; readers select **active** tables on **published** parent only |
| Anonymous | Denied |
| Storage bucket | **Not required** for tables (unlike attachments 027) |
| SQL source of truth | `SPIORA_SUPABASE_PATCH_028_KNOWLEDGE_BASE_TABLES.sql` |
| Migration twin | `supabase/migrations/028_knowledge_base_tables.sql` |
| Rollback (destructive metadata) | `SPIORA_SUPABASE_PATCH_028_KNOWLEDGE_BASE_TABLES_ROLLBACK.sql` |

**Prerequisite:** migration **027** (attachments) must already be applied and validated. If `knowledge_base_attachments` is missing, preflight returns **`NOT_READY`** and backup of attachments cannot complete.

---

## Backup SQL (export before apply)

Run in Supabase SQL Editor and export results (CSV / spreadsheet / snapshot). Do this **before** preflight verdict is acted on.

```sql
-- 1) Articles
select * from public.knowledge_base_articles order by created_at;

-- 2) Translations
select * from public.knowledge_base_article_translations order by article_id, locale;

-- 3) Attachments (BLOCKER if table missing)
select * from public.knowledge_base_attachments order by created_at;
```

| Backup target | Status |
|---------------|--------|
| `knowledge_base_articles` | Required |
| `knowledge_base_article_translations` | Required |
| `knowledge_base_attachments` | **Required.** If table is absent → **blocker**; preflight must be `NOT_READY`; **do not apply 028** until 027 is applied + validated + this export succeeds |

Also take a Supabase project backup / confirm PITR if available.

---

## Exact manual order

### 1. Backup
- [ ] Project snapshot / PITR confirmed
- [ ] Export `knowledge_base_articles` (SQL above)
- [ ] Export `knowledge_base_article_translations`
- [ ] Export `knowledge_base_attachments` — if missing, **STOP** (027 incomplete)

### 2. Preflight (read-only)
- [ ] Open Supabase SQL Editor
- [ ] Run `SPIORA_KB_TABLES_PREFLIGHT_028.sql`
- [ ] Confirm `FINAL_VERDICT` is one of:
  - **`READY_TO_APPLY`** → continue to apply
  - **`ALREADY_APPLIED`** → skip apply (or optional idempotent refresh), go to validation
  - **`NOT_READY`** → fix listed blocking reasons; **do not apply 028**

### 3. Apply patch 028
- [ ] Paste/run `SPIORA_SUPABASE_PATCH_028_KNOWLEDGE_BASE_TABLES.sql` in SQL Editor
- [ ] Expect: table + indexes + `updated_at` trigger + hard-delete trigger + privileges + 4 RLS policies
- [ ] Do **not** change Vercel env for this patch

### 4. Validation (post-apply)
- [ ] Run `SPIORA_KB_TABLES_VALIDATE_028.sql`
- [ ] Confirm `FINAL_VERDICT` = **`VALIDATED_OK`**
- [ ] If `VALIDATION_FAILED` → read failed keys; do **not** push/deploy

### 5. Local runtime — owner create empty table
- [ ] Local app, Postgres KB enabled, **owner** session (Olivia)
- [ ] Knowledge Base → Add material → **Таблица** (or open editor → Tables)
- [ ] Confirm empty open alone does **not** create a draft; create table via **Create table**
- [ ] Empty 3×3 (or similar) grid appears; autosave settles to **Saved**

### 6. Add / delete row and column
- [ ] Add row → delete row
- [ ] Add column → delete column
- [ ] No duplicate table entities created

### 7. Rename column — data preserved
- [ ] Put a value in a cell
- [ ] Rename the column header
- [ ] Confirm cell value remains (stable `column.id`)

### 8. Paste from Excel / Google Sheets
- [ ] Copy a small range → paste into grid
- [ ] Rows/columns expand within limits
- [ ] Undo last paste works (if offered)
- [ ] Oversized paste shows a clear error (do not exceed 50k cells)

### 9. CSV import preview + confirm
- [ ] Import CSV → **preview** shows headers, suggested types, sample rows
- [ ] Toggle “first row is headers”; adjust a column type
- [ ] Cancel does **not** create a table (and does not orphan a draft if nothing else was saved)
- [ ] Confirm import → one table created

### 10. Edit cells + autosave
- [ ] Edit text / number / date / boolean / URL cells
- [ ] States: Saving… → Saved; failure → retry; 409 → reload (no blind overwrite)
- [ ] Unsafe URL rejected on save; XSS text stays plain text

### 11. Publish
- [ ] Publish article (save table → save material → publish sequence)
- [ ] Draft no longer hides the table from readers after publish

### 12. Daniel (manager) read-only
- [ ] As Daniel: **no** create / import / archive / column type controls
- [ ] Published article: can see table, horizontal scroll, search/sort, CSV export if allowed
- [ ] Draft article: tables **hidden**
- [ ] Archived table: **hidden**

### 13. CSV export
- [ ] Export CSV as owner and as Daniel (published)
- [ ] Values starting with `= + - @` (and leading tab/space formula forms) are formula-escaped

### 14. Archive table
- [ ] As owner: archive table → disappears for Daniel
- [ ] Hard DELETE not used / blocked

### 15. Only then push / deploy
- [ ] Push commit(s) when operator approves (code already includes SQL files)
- [ ] Deploy app **after** DB cutover is `VALIDATED_OK` + runtime smoke green
- [ ] Smoke on deployed env (subset of steps 5–14)
- [ ] Still do **not** paste service-role into browser / client logs

---

## Stop conditions

| Gate | Proceed only if |
|------|-----------------|
| Backup | Articles + translations + **attachments** exported (attachments missing = stop) |
| Preflight | `READY_TO_APPLY` or `ALREADY_APPLIED` |
| Apply | SQL completed without error (skip if already applied) |
| Validate | `VALIDATED_OK` |
| Runtime | Owner create/edit/paste/CSV/publish OK; Daniel read-only OK; archive + export OK |
| Push/deploy | All above green **and** explicit operator approval |

## Explicitly out of scope for this cutover pack

- Auto-apply migration
- Auto push / deploy
- Vercel env changes
- XLSX, formulas, merged cells, collaborative editing
- Impersonating users via `service_role` in SQL Editor

## Related files

| File | Role |
|------|------|
| `SPIORA_KB_TABLES_PREFLIGHT_028.sql` | Read-only gate before apply |
| `SPIORA_SUPABASE_PATCH_028_KNOWLEDGE_BASE_TABLES.sql` | Apply |
| `SPIORA_KB_TABLES_VALIDATE_028.sql` | Post-apply schema/RLS gate |
| `SPIORA_SUPABASE_PATCH_028_KNOWLEDGE_BASE_TABLES_ROLLBACK.sql` | Emergency rollback (destructive for table rows) |
| `SPIORA_KB_TABLES_PHASE1A_REPORT.md` | Architecture / limits |
| `SPIORA_KB_TABLES_RUNTIME_CHECKLIST.md` | Extra runtime notes |
| `SPIORA_KB_TABLES_THREAT_MODEL.md` | Security notes |
