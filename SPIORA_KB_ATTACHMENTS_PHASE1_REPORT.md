# PR #20 — Knowledge Base Attachments Phase 1 (Report)

## Architecture
- Article remains the primary entity (text EN/RU).
- Files are attachments: Postgres metadata + private Storage `knowledge-base`.
- Download via authenticated Next.js proxy (same pattern as task attachments).
- UX: **+ Add material** → create text first; attach PDF/images in editor after draft exists.

## Deliverables (repo only — not applied)
- `supabase/migrations/027_knowledge_base_attachments.sql`
- `SPIORA_SUPABASE_PATCH_027_KNOWLEDGE_BASE_ATTACHMENTS.sql`
- `SPIORA_SUPABASE_PATCH_027_KNOWLEDGE_BASE_ATTACHMENTS_ROLLBACK.sql`
- API: `GET/POST .../[slug]/attachments`, `GET/PATCH .../attachments/[id]`
- UI: `KbAttachmentsPanel`, Add material menu
- Tests: `kb-attachments.test.ts`
- Docs: threat model + runtime checklist

## Limits
- PDF ≤ 25 MB; images ≤ 10 MB; ≤ 10 attachments / article
- MIME: `application/pdf`, `image/png`, `image/jpeg`, `image/webp`
- No DOCX/CSV/XLSX/video/OCR/AI file indexing

## SAFE / NOT SAFE
| Action | Status |
|--------|--------|
| Commit to git | **SAFE TO COMMIT** (code + SQL files only) |
| Apply migration / create bucket | **NOT SAFE TO APPLY** until operator checklist + backup |
| Push / deploy | Operator decision after apply + smoke |
| Change Vercel env | Not required for Phase 1 |

## Verdict
Phase 1 is ready as a **prepared PR**: safe to review/commit when asked; not safe to apply Storage/SQL until manual cutover.
