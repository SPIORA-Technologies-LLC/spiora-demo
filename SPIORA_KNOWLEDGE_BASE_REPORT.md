# SPIORA — PR #19 Knowledge Base Report

**Цель:** перенести 15 demo-статей из кода/i18n в PostgreSQL, сохранив UI, RU/EN, поиск, фильтры, deep links, AI Workspace.

## Deliverables

| Artifact | Path | Status |
| --- | --- | --- |
| Migration | `supabase/migrations/026_knowledge_base.sql` | ✔ |
| Patch SQL | `SPIORA_SUPABASE_PATCH_026_KNOWLEDGE_BASE.sql` | ✔ |
| Seed SQL | `SPIORA_KNOWLEDGE_BASE_SEED_026.sql` | ✔ (15×2 locales) |
| Rollback | `SPIORA_SUPABASE_PATCH_026_KNOWLEDGE_BASE_ROLLBACK.sql` | ✔ |
| Policy matrix | `SPIORA_KNOWLEDGE_BASE_POLICY_MATRIX.md` | ✔ |
| Threat model | `SPIORA_KNOWLEDGE_BASE_THREAT_MODEL.md` | ✔ |
| Runbook | `SPIORA_KNOWLEDGE_BASE_RUNTIME_RUNBOOK.md` | ✔ |
| Validation | `SPIORA_KNOWLEDGE_BASE_RUNTIME_VALIDATION.md` | ✔ |
| Postgres repo | `src/lib/supabase/knowledge-base-repo.ts` | ✔ |
| Service layer | `src/lib/knowledge-base/knowledge-base-service.ts` | ✔ |
| Embedded fallback | `src/lib/knowledge-base/embedded-store.ts` | ✔ |
| GET API | `src/app/api/knowledge-base/route.ts` | ✔ |
| Owner CRUD | `POST /api/knowledge-base`, `PATCH /api/knowledge-base/[slug]` | ✔ |
| AI integration | `src/lib/google-drive/kb-text.ts` → service | ✔ |
| `.data/knowledge-base.json` | Removed from runtime path | ✔ |

## Architecture change

**Before:** `demo-articles.ts` + i18n + optional `.data/knowledge-base.json`  
**After:** PostgreSQL primary → embedded i18n fallback → (legacy Google Drive if neither)

## Env flags

- `SPIORA_KB_POSTGRES` — default `true` when Supabase enabled
- `SPIORA_KB_EMBEDDED_FALLBACK` — default `true` in demo; set `false` on Vercel after validation

## Not done in this PR

- Migration apply on Supabase
- Vercel env change
- UI editor for owner CRUD (API only)
- Google Drive removal (dormant path retained)
