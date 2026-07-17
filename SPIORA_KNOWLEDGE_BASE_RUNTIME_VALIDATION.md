# SPIORA — Knowledge Base Runtime Validation

**PR #19 / #19.3.** Статус: **awaiting manual cutover** — migration 026 **не** применена агентом.

**HEAD (required):**
- `0fcab21` — production baseline  
- `243d276` — Supabase Knowledge Base with owner editor (`243d276…` full)

## Automated (local CI) — code already committed

| Check | Status | Notes |
| --- | --- | --- |
| `npm test` | ✔ 644 pass | kb-policy-shape, api, editor, config |
| `npm run build` | ✔ pass | Next.js 15.5.x |
| Migration / seed shape tests | ✔ | local file audits |

## Cutover artifacts (PR #19.3)

| File | Role |
| --- | --- |
| `SPIORA_KB_CUTOVER_CHECKLIST.md` | Strict manual order |
| `SPIORA_KB_PREFLIGHT_026.sql` | Read-only preflight |
| `SPIORA_KB_VALIDATE_026.sql` | Post-apply SQL validation |
| `SPIORA_SUPABASE_PATCH_026_KNOWLEDGE_BASE.sql` | Apply schema |
| `SPIORA_KNOWLEDGE_BASE_SEED_026.sql` | Seed 15×EN+RU |
| `SPIORA_SUPABASE_PATCH_026_KNOWLEDGE_BASE_ROLLBACK.sql` | Emergency rollback |

## Pre-apply database

| Check | Expected | Actual |
| --- | --- | --- |
| Backup taken | yes | ⏸ awaiting operator |
| Preflight PASS | no FAIL rows | ⏸ |
| Tables before apply | absent or shape_ok | ⏸ |

## Post-apply SQL (operator fills)

| Check | Expected | Actual |
| --- | --- | --- |
| articles_total | 15 | ⏸ |
| translations_total | 30 | ⏸ |
| unique_slugs | 15 | ⏸ |
| missing_locale_pairs | none | ⏸ |
| empty title/summary/content | 0 | ⏸ |
| RLS both tables | enabled | ⏸ |
| kb_policies_count | 7 | ⏸ |
| hard_delete_triggers | both present | ⏸ |
| anon_table_privileges | none | ⏸ |

## Local runtime (operator fills)

| Check | Expected | Actual |
| --- | --- | --- |
| `npm.cmd run dev` | starts | ⏸ |
| `GET /api/knowledge-base` `source` | `postgresql` | ⏸ |
| `canManage` (Olivia) | `true` | ⏸ |
| Embedded fallback still on | yes (not disabled) | ⏸ |
| `GET /api/system/health` | ok / no secret leak | ⏸ |

## Owner Olivia E2E

| Step | Result |
| --- | --- |
| Open KB + owner controls | ⏸ |
| Create draft RU+EN | ⏸ |
| Save + reopen + edit | ⏸ |
| Preview | ⏸ |
| Publish + deep link | ⏸ |
| Search / category / tag | ⏸ |
| Archive | ⏸ |

## Daniel manager E2E

| Step | Result |
| --- | --- |
| Sees published | ⏸ |
| No draft / archive in default list | ⏸ |
| No owner controls | ⏸ |
| `/new` and `/edit/...` redirected | ⏸ |
| POST create → 403 | ⏸ |

## AI Workspace

| Step | Result |
| --- | --- |
| Published article in KB context | ⏸ |
| Draft / archived excluded | ⏸ |
| Context from PostgreSQL (not Drive) | ⏸ |
| Demo AI draft without external API | ⏸ |

## Fallback policy

| Scenario | Expected |
| --- | --- |
| First cutover deploy | `SPIORA_KB_EMBEDDED_FALLBACK` **remains enabled** |
| After stable `source: "postgresql"` in production | separate tiny change → `false` |

## Verdicts (fill after operator results)

| Verdict | Status |
| --- | --- |
| **SAFE / NOT SAFE TO PUSH** | ⏸ **NOT EVALUATED** — awaiting preflight + SQL + UI E2E |
| **SAFE / NOT SAFE TO DEPLOY** | ⏸ **NOT EVALUATED** — awaiting runtime validation |
| **SAFE / NOT SAFE TO DISABLE FALLBACK** | ⏸ **NOT SAFE** until production/demo runs stably on PostgreSQL with fallback still on |

**Current standing (before operator cutover):**

- **NOT SAFE TO APPLY** until backup + preflight PASS  
- **NOT SAFE TO PUSH / DEPLOY** until checklist §1–9 PASS and this file updated with Actuals  
- **NOT SAFE TO DISABLE FALLBACK** until after successful deployed cutover with fallback still enabled
