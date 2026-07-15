# SPIORA Data Migration Roadmap

**Дата:** 15 июля 2026  
**Статус:** план без реализации  
**Целевая модель:** PostgreSQL/Supabase — primary; Storage — documents; Google — import/export only; `.data` — local dev only.

---

## Целевая архитектура по модулям

| Модуль | Сейчас (primary) | Целевое хранилище |
|--------|------------------|-------------------|
| Auth / Users | TS static + env + app_state | Supabase Auth **или** `users` + bcrypt + JWT claims |
| CRM / Clients | Google Sheets / demo | `clients`, `client_contacts` (Postgres) |
| Client Notes | Dual: notes table / Sheets / file | `client_notes` (уже есть) — единственный path |
| Tasks | Dual | `tasks` + Storage (готово) |
| Calendar | Dual + Supabase-only meetings | `calendar_*` (готово) |
| Notifications | Dual | `notifications` (готово) |
| Team Chat | Dual | `team_chat_*` + Storage (готово) |
| AI Workspace | Canned / OpenRouter | LLM external; context **только** из Postgres |
| AI chat history | Dual | `ai_workspace_chats` (готово) |
| Knowledge Base | Drive / `.data` | `kb_articles` + Storage bucket `kb-documents` |
| Analytics | Computed + static demo | Materialized views / `analytics_snapshots` |
| Team | Static TS | `users` + `team_memberships` |
| Settings | app_state KV | `app_settings` / app_state (structured keys) |
| Meeting recordings | Supabase-only | Без изменений (готово) |
| Lead Review | Formgrid + app_state | `crm_leads` + webhook ingest |
| Formgrid | Google CSV | Webhook → Postgres (Sheets optional export) |
| Emigrant Desk | External Supabase | Оставить isolated или merge с org_id |

---

## Production Blockers (7)

1. **Default Vercel demo использует ephemeral `.data`** — пользовательские изменения не сохраняются.
2. **CRM clients отсутствуют в PostgreSQL** — Google Sheets de facto primary.
3. **RLS не включён** — service role + API-only ACL недостаточно для corp.
4. **Supabase off by default в demo** — production deploy без явного enable = file storage.
5. **Knowledge Base вне Postgres** — нет corp-grade CMS/audit.
6. **Formgrid public CSV** — unauthenticated lead PII source.
7. **No backup/DR strategy** — ни Postgres, ни Sheets versioning в app.

---

## Phase 1 — Обязательное до public production deploy

**Scope:** включить персистентность на Vercel; запретить `.data` primary в production; минимальный CRM schema.

| Задача | Файлы / артефакты |
|--------|-------------------|
| Mandatory Supabase на Vercel prod | `integration-policy.ts`, Vercel env docs |
| Fail-fast если Supabase unavailable in prod | `environment-guard.ts`, store layer |
| Migration `clients`, `crm_leads` | `supabase/migrations/022_clients.sql` |
| `clients-repo.ts` + refactor `google-sheets/service.ts` | `src/lib/supabase/clients-repo.ts`, CRM API routes |
| Read path: Postgres first, Sheets optional sync | `src/lib/crm/store.ts` (new) |
| Disable `.data` writes when `VERCEL=1` && !local | store files guard |
| Document required env | `.env.spiora.example`, deploy runbook |

**Миграции:** `022_clients`, `023_crm_leads`, indexes on `org_id`, `email`.

**Риски:**
- Downtime при cutover CRM read path
- Duplicate clients if Sheets+Postgres both write
- Existing Vercel demo users lose tasks if Supabase not provisioned

**Критерии готовности:**
- [ ] Vercel prod: `SPIORA_ENABLE_SUPABASE=true` enforced
- [ ] Create/read client → Postgres roundtrip
- [ ] `.data` not written on Vercel
- [ ] Smoke: tasks, calendar, chat persist 24h+ across redeploy

**Оценка:** **2–3 недели** (1 FTE backend + 0.5 DevOps)

---

## Phase 2 — Перенос данных

**Scope:** migrate existing CRM from Sheets; migrate `.data` blobs to Storage; seed prod.

| Задача | Детали |
|--------|--------|
| One-time Sheets → Postgres import script | Server script, idempotent by email/ID |
| `.data` JSON import | tasks, chat, calendar, notifications |
| Attachment migration | Local files → Supabase Storage |
| app_state consolidation | Structured keys, deprecate duplicate `.data` files |
| Validation report | Row counts, checksum, orphan detection |

**Файлы:** `scripts/migrate-sheets-to-supabase.ts`, `scripts/migrate-local-data.ts`

**Миграции:** возможно `024_import_audit_log`

**Риски:**
- PII exposure during import logs
- Schema mismatch in legacy Sheets columns
- Large attachments timeout on Vercel (run locally/CI)

**Критерии готовности:**
- [ ] 100% CRM rows in Postgres match Sheets snapshot
- [ ] Zero critical orphans in FK relations
- [ ] Rollback plan documented (Sheets remains read-only backup 30d)

**Оценка:** **1–2 недели**

---

## Phase 3 — Отключение Google как primary source

**Scope:** Google Sheets/Drive → optional integration layer only.

| Задача | Детали |
|--------|--------|
| CRM read/write **only** Postgres | Remove Sheets primary path |
| Sheets export cron (optional) | One-way Postgres → Sheets for ops |
| KB: `kb_articles` + Storage | Replace Drive listing |
| Drive optional: import tool | Admin UI one-way sync |
| Formgrid: webhook → `crm_leads` | Deprecate public CSV |
| AI context: Postgres only | Remove Sheets/Drive from workspace-assistant |
| Update integration-policy | Google off by default everywhere |

**Файлы:** `google-sheets/service.ts` (reduce), `knowledge-base/store.ts`, `formgrid/*`, `workspace-assistant.ts`

**Миграции:** `025_kb_articles`, Storage bucket `kb-documents`

**Риски:**
- Ops team workflow change (Sheets users)
- KB content migration gaps
- Lead webhook reliability

**Критерии готовности:**
- [ ] App fully functional with `SPIORA_ENABLE_GOOGLE_INTEGRATIONS=false`
- [ ] CRM CRUD with zero Google API calls
- [ ] KB served from Postgres/Storage

**Оценка:** **2–3 недели**

---

## Phase 4 — RLS и security hardening

**Scope:** defense in depth for corporate client.

| Задача | Детали |
|--------|--------|
| Add `org_id` to all tenant tables | Migration + backfill |
| Enable RLS policies | owner/manager/user roles |
| Evaluate Supabase Auth vs custom JWT | Map roles to claims |
| Replace service role with user-scoped client where possible | Server routes only |
| Storage RLS on all buckets | Signed URLs |
| Remove/debug lock down diagnostic endpoints | AI diagnostic, debug routes |
| Audit logging | `audit_log` table |
| Secrets rotation runbook | SA, service role, JWT secret |
| Pen test / review | Horizontal access tests |

**Миграции:** `026_org_id`, `027_rls_policies`, `028_audit_log`

**Риски:**
- Breaking existing API if RLS misconfigured
- Performance on complex policies
- Auth migration user disruption

**Критерии готовности:**
- [ ] User A cannot read User B data via direct API manipulation
- [ ] Service role not exposed to client
- [ ] Security audit passes (0 Critical)

**Оценка:** **2–4 недели**

---

## Phase 5 — Verification и smoke test

**Scope:** production readiness validation.

| Задача | Детали |
|--------|--------|
| E2E smoke suite | Playwright: CRM, tasks, calendar, chat, AI, KB |
| Load test | Chat + calendar concurrent writes |
| DR drill | Postgres backup restore |
| Vercel redeploy test | Data survives 3 redeploys |
| Google-off staging | Full regression |
| Documentation | Admin runbook, data retention policy |

**Критерии готовности:**
- [ ] All E2E green on staging
- [ ] RTO/RPO documented and tested
- [ ] Sales collateral accurate: «PostgreSQL-based platform»

**Оценка:** **1 неделя**

---

## Сводный timeline

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Phase 1 | 2–3 weeks | 2–3 weeks |
| Phase 2 | 1–2 weeks | 3–5 weeks |
| Phase 3 | 2–3 weeks | 5–8 weeks |
| Phase 4 | 2–4 weeks | 7–12 weeks |
| Phase 5 | 1 week | **8–13 weeks** |

**До полного отказа от Google as primary storage:** **6–10 недель** (Phases 1–3 parallelized partially).

**Calendar estimate with 1 FTE:** **~10 weeks** to corp-ready PostgreSQL platform.

---

## Рекомендуемый следующий PR

**Title:** `feat(crm): add clients table and Postgres-primary CRM read path`

**Scope:**
- Migration `022_clients.sql`
- `clients-repo.ts`
- CRM API reads from Postgres when Supabase configured
- Sheets becomes read-only fallback behind flag `SPIORA_CRM_SHEETS_SYNC=true`
- Tests for create client roundtrip
- Update `.env.spiora.example`

**Не включать в первый PR:** RLS (Phase 4), KB migration (Phase 3), Google removal.

---

## Checklist: можно ли продавать как PostgreSQL-based platform?

| Требование | Сейчас | После Phase 3 |
|------------|--------|---------------|
| CRM in Postgres | ❌ | ✅ |
| Operational data persistent on Vercel | ⚠️ optional | ✅ |
| No Google required | ❌ demo only | ✅ |
| RLS / tenant isolation | ❌ | ⚠️ Phase 4 |
| Supabase Auth or equivalent | ❌ | ⚠️ Phase 4 |
| KB in Postgres | ❌ | ✅ |
| Marketing claim safe | **Нет** | **Условно да** (после Phase 4 — полностью) |

---

## Risk register (migration-specific)

| ID | Risk | Phase | Mitigation |
|----|------|-------|------------|
| M1 | Data loss on Vercel during Phase 1 cutover | 1 | Enable Supabase before disabling `.data` |
| M2 | CRM duplicate records | 2 | Idempotent import keys |
| M3 | Ops resistance to leave Sheets | 3 | Export sync + training |
| M4 | RLS breaks admin views | 4 | Service role admin routes isolated |
| M5 | LLM still receives stale Google context | 3 | Feature flag kill switch |

---

*Roadmap подготовлен без реализации, commit, deploy и изменений env.*
