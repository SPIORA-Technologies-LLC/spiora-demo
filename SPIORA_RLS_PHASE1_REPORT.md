# SPIORA — RLS Phase 1 Report

**PR:** #18 — RLS Phase 1: Identity-Aware Data Protection  
**Статус:** подготовлено, **не применено** к demo Supabase  
**Язык:** русский

## Цель

Первый слой Row Level Security для:

- `user_profiles`
- `clients`
- `client_notes`
- `client_documents`

Доступ должен определяться активным Auth user → профилем → ролью, а не знанием UUID / external ID.

## Current access map

| Table | Operation | Current client | Session check | RBAC | RLS impact |
| --- | --- | --- | --- | --- | --- |
| `user_profiles` | SELECT/UPDATE (login, session, health) | **service_role** (`user-profiles-repo`, middleware-session) | Auth session / login | active + role mapping; consultant/viewer → нет сессии | После apply: Data API ограничен policies; app API пока обходит через service_role |
| `user_profiles` | INSERT/DELETE | нет публичного API; provisioning вручную / admin | — | owner (будущее) | authenticated INSERT/DELETE **denied** |
| `clients` | GET list/detail | service_role (`clients-repo`) | `getSession()` на API | read: любой auth (owner/manager) | Data API: только owner/manager |
| `clients` | POST/PATCH | service_role | session | create/update: owner\|manager | то же + manager не archive |
| `clients` | DELETE (archive) | service_role | session | **owner only** | manager UPDATE с `archived_at is null`; hard DELETE denied |
| `client_notes` | GET/POST/PATCH/DELETE | service_role | session | owner\|manager (archive note — manager OK) | доступ через `client_uuid` → `clients` RLS |
| `client_documents` | GET/POST/PATCH | service_role | session | owner\|manager | через `client_uuid` |
| `client_documents` | DELETE (archive) | service_role | session | **owner only** | manager UPDATE запрещает `archived_at` |

**Прямой browser / anon доступ к таблицам:** отсутствует (browser client не используется для CRM).

**Горизонтальный риск сегодня:** любой authenticated owner/manager может открыть любого клиента по `DEMO-*` (нет assignee isolation). Consultant/viewer в runtime не логинятся.

## Что сделано в PR

1. Аудит доступа и матрица политик.
2. Migration `supabase/migrations/025_rls_phase1.sql` (helpers + RLS + policies + triggers).
3. Ручной patch `SPIORA_SUPABASE_PATCH_025_RLS_PHASE1.sql` (preflight + apply + verify).
4. Rollback `SPIORA_SUPABASE_PATCH_025_RLS_ROLLBACK.sql`.
5. Health: `rls` + `rlsPhase: "phase1"`.
6. Автотесты формы SQL/policies.
7. Runbook + validation + threat model + policy matrix.

## Что намеренно НЕ сделано

- migration **не применена**;
- RLS **не включён** на demo;
- rollback **не выполнен**;
- Vercel / deploy **не трогались**;
- service role **не удалён**;
- Storage binary policies **не входят** в PR;
- seed / `.env` / реальные UUID **не менялись**.

## Service-role strategy (полная оценка)

### Variant A — user-scoped database access

API routes создают server Supabase client с пользовательской session (`createSupabaseServerAuthClient`). Запросы к четырём таблицам проходят RLS.

| Плюсы | Минусы |
| --- | --- |
| Единый enforcement в PostgreSQL | Нужен рефакторинг всех CRM repos |
| Снижает IDOR при ошибке в TypeScript RBAC | Каждый route должен иметь валидные Auth cookies |
| Соответствует целевой production-модели | Background jobs / demo reset всё равно нужен service_role |

### Variant B — service role + application RBAC (текущий runtime)

Server repositories продолжают `getSupabaseAdmin()`. RLS защищает прямой PostgREST / anon abuse. App RBAC остаётся обязательным.

| Плюсы | Минусы |
| --- | --- |
| Apply RLS не ломает текущий CRM path | RLS не лечит ошибки app-level permissions |
| Быстрый defense-in-depth | Утечка service role = полный доступ |
| Совместим с health / provisioning | Managers по-прежнему видят всех клиентов через API |

**Решение этого PR:** готовим policies и health; runtime остаётся **Variant B** до отдельного cutover. Целевая миграция CRUD → Variant A после успешного apply + validation.

Где service_role остаётся необходимым:

- provisioning профилей;
- system health probes;
- demo reset;
- background jobs;
- строго ограниченные admin operations;
- login/session resolve профиля до появления user-scoped path везде.


## Вердикты на момент подготовки

| Вердикт | Статус |
| --- | --- |
| SAFE TO COMMIT | ✅ да (после зелёных test/build) |
| SAFE TO APPLY RLS | ❌ **NOT SAFE TO APPLY** без отдельного подтверждения и успешного preflight |
| SAFE TO ENABLE AUTH ON VERCEL | ❌ **NOT SAFE** до успешного apply + runtime validation RLS Phase 1 |

## Артефакты

- `SPIORA_RLS_PHASE1_POLICY_MATRIX.md`
- `SPIORA_RLS_PHASE1_RUNTIME_RUNBOOK.md`
- `SPIORA_RLS_PHASE1_RUNTIME_VALIDATION.md`
- `SPIORA_RLS_PHASE1_THREAT_MODEL.md`
- `supabase/migrations/025_rls_phase1.sql`
- `SPIORA_SUPABASE_PATCH_025_RLS_PHASE1.sql`
- `SPIORA_SUPABASE_PATCH_025_RLS_ROLLBACK.sql`
