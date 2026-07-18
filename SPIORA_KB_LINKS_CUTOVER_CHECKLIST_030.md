# KB Links — Cutover checklist 030

Do **not** auto-apply. Apply manually in Supabase SQL editor after backup.

## Prerequisites
- Patch **026** (articles) already applied

## Steps
1. Backup / confirm restore is possible
2. Run `SPIORA_SUPABASE_PATCH_030_KNOWLEDGE_BASE_LINKS.sql`
3. Spot-check: `knowledge_base_articles.external_url` exists with http(s) check
4. Smoke test (owner):
   - Add material → **Link** → enter https URL → save draft / publish
   - Reader sees **Open link** and can open in a new tab
   - Invalid URLs (`javascript:`, bare text) are rejected
5. Optional rollback: `SPIORA_SUPABASE_PATCH_030_KNOWLEDGE_BASE_LINKS_ROLLBACK.sql`

## Notes
- URL is article-level (shared for EN/RU)
- Body markdown remains optional notes; publish allows empty body when URL is set
