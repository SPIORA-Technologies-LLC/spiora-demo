# SPIORA KB Tables Phase 1A — Runtime Checklist

## Before apply
- [ ] Backup / PITR
- [ ] Migration 026 applied
- [ ] Review `SPIORA_SUPABASE_PATCH_028_KNOWLEDGE_BASE_TABLES.sql`

## Apply (manual only)
1. Run patch 028 in Supabase SQL Editor
2. Confirm table `knowledge_base_tables`, RLS, hard-delete trigger, revision column

## Smoke
- [ ] Owner: Add material → Table → create empty → edit cell → Saved
- [ ] Paste from Sheets into grid
- [ ] Import CSV (comma + semicolon)
- [ ] Rename column — data remains
- [ ] Change type number/date/boolean/url
- [ ] Export CSV — formula cells escaped
- [ ] Publish article — manager can view read-only + export
- [ ] Draft article — manager cannot see tables
- [ ] Archive table — hidden for readers
- [ ] Concurrent edit → 409 conflict UI
- [ ] Open editor and leave without edits → no orphan draft
- [ ] Reject `javascript:` URL
- [ ] XSS string displays as text

## Rollback
`SPIORA_SUPABASE_PATCH_028_KNOWLEDGE_BASE_TABLES_ROLLBACK.sql` (destructive)
