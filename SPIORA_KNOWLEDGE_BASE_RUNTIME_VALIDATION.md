# SPIORA — Knowledge Base Runtime Validation

**PR #19.** Статус: **pre-apply audit** — migration не применена на demo Supabase.

## Automated (local CI)

| Check | Status | Notes |
| --- | --- | --- |
| `npm test` | ✔ pass (619 tests) | includes `kb-policy-shape`, `knowledge-base-config` |
| `npm run build` | ✔ pass | Next.js 15.5.18 |
| Migration shape tests | ✔ local | 7 policies, 2 tables, hard-delete guard |
| Seed shape tests | ✔ local | 15 slugs × EN/RU |

## Pre-apply database (NOT RUN)

| Check | Expected | Actual |
| --- | --- | --- |
| Tables exist | 2 tables | ⏸ not applied |
| Published articles | 15 | ⏸ |
| Translations EN/RU | 15 each | ⏸ |
| RLS enabled | yes | ⏸ |

## Post-apply checklist (manual)

- [ ] Owner: list 15 articles, source `postgresql`
- [ ] Manager: list published, no drafts
- [ ] Search EN + RU tokens
- [ ] Category filter `ai-automation`
- [ ] Tag filter `security`
- [ ] Deep link each of 15 slugs
- [ ] AI Workspace KB excerpt (≤8 articles, 600 char excerpt)
- [ ] Owner POST create draft → PATCH publish → PATCH archive
- [ ] Manager POST → 403
- [ ] Anonymous API → 401
- [ ] Set `SPIORA_KB_EMBEDDED_FALLBACK=false` → still works from Postgres only

## Fallback validation

| Scenario | Expected source |
| --- | --- |
| Postgres empty + fallback on | `embedded` |
| Postgres 15 rows + fallback on | `postgresql` |
| Postgres 15 rows + fallback off | `postgresql` |
| Postgres error + fallback off | `error` |

## Verdict (pre-apply)

- **SAFE TO COMMIT (code review):** after tests + build green
- **NOT SAFE TO APPLY:** until manual preflight + backup + owner sign-off
