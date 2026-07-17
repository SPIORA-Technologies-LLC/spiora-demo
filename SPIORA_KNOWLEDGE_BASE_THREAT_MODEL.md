# SPIORA — Knowledge Base Threat Model

**PR #19.** Scope: `knowledge_base_articles`, `knowledge_base_article_translations`, KB API, AI excerpts.

## Assets

- Локализованный контент статей (title, summary, markdown body)
- Метаданные: slug, category, tags, author, status
- Deep links `/knowledge-base?article=<slug>`

## Trust boundaries

| Boundary | Trust level | Controls |
| --- | --- | --- |
| Browser (authenticated) | Medium | Session cookie, app RBAC |
| Supabase Data API (user JWT) | Medium | RLS policies |
| Next.js API (service_role) | High | Owner checks in route handlers |
| Anonymous | Untrusted | Deny all KB tables |
| Google Drive KB path | Legacy | Not primary; dormant in demo |

## Threats & mitigations

### T1 — Anonymous read of internal policies

- **Risk:** High  
- **Mitigation:** `REVOKE ALL` from anon; RLS enabled; API requires session.

### T2 — Manager reads draft before publish

- **Risk:** Medium  
- **Mitigation:** `kb_article_visible_to_reader` requires `status = published`; draft owner-only.

### T3 — Hard delete of audit trail

- **Risk:** Medium  
- **Mitigation:** `spiora_block_hard_delete` trigger; no DELETE grant; archive via UPDATE.

### T4 — Service role bypasses RLS in API

- **Risk:** Medium (accepted Variant B)  
- **Mitigation:** Owner-only mutations in API; document in runbook; future: user-scoped client for reads.

### T5 — XSS via article markdown

- **Risk:** Medium  
- **Mitigation:** Existing `KbArticleMarkdown` sanitization; no raw HTML in seeds.

### T6 — Slug enumeration

- **Risk:** Low  
- **Mitigation:** Authenticated users only; slugs are non-secret internal docs.

### T7 — Embedded fallback serves stale content after DB cutover

- **Risk:** Low (ops)  
- **Mitigation:** `SPIORA_KB_EMBEDDED_FALLBACK=false` after validation; count check prefers Postgres when rows > 0.

### T8 — AI context leakage to wrong tenant

- **Risk:** N/A demo single-tenant  
- **Mitigation:** Single Supabase project; no cross-tenant IDs.

## Out of scope (Phase 1)

- Version history / audit log table
- Per-article ACL beyond owner vs readers
- Google Drive as write path
