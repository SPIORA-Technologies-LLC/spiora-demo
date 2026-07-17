# SPIORA — RLS Phase 1 Runtime Validation

**PR #18.** Статус на момент подготовки: migration **не применена**.

Заполнять после ручного apply на demo.

## Preflight (до apply)

| Check | Expected | Actual | Pass |
| --- | --- | --- | --- |
| Auth users | 4 | _pending_ | ☐ |
| Active profiles | 4 | _pending_ | ☐ |
| Active owners | 1 | _pending_ | ☐ |
| Clients | 25 | _pending_ | ☐ |
| Orphan notes | 0 | _pending_ | ☐ |
| Orphan documents | 0 | _pending_ | ☐ |
| notes без client_uuid | 0 | _pending_ | ☐ |
| Profiles без auth_user_id | 0 | _pending_ | ☐ |
| Role/status constraints | present | _pending_ | ☐ |

**Preflight verdict:** ☐ SAFE TO APPLY / ☐ NOT SAFE TO APPLY

## Post-apply SQL

| Check | Expected | Actual | Pass |
| --- | --- | --- | --- |
| `spiora_rls_phase1_status()` | enabled | _pending_ | ☐ |
| RLS on 4 tables | true | _pending_ | ☐ |
| Policy count Phase 1 | ≥ 16 | _pending_ | ☐ |

## Anonymous

| Check | Expected | Actual | Pass |
| --- | --- | --- | --- |
| SELECT clients без session | denied/empty | _pending_ | ☐ |
| SELECT user_profiles | denied/empty | _pending_ | ☐ |

## Olivia owner

| Check | Expected | Actual | Pass |
| --- | --- | --- | --- |
| Profiles / self | OK | _pending_ | ☐ |
| Clients CRUD + archive | OK | _pending_ | ☐ |
| Notes CRUD | OK | _pending_ | ☐ |
| Documents create/update/archive | OK | _pending_ | ☐ |

## Daniel manager

| Check | Expected | Actual | Pass |
| --- | --- | --- | --- |
| Clients read/create/update | OK | _pending_ | ☐ |
| Client archive | denied | _pending_ | ☐ |
| Notes CRUD | OK | _pending_ | ☐ |
| Documents read/create/update | OK | _pending_ | ☐ |
| Document archive | denied | _pending_ | ☐ |
| Role/status profile change | denied | _pending_ | ☐ |

## Suspended / abuse

| Check | Expected | Actual | Pass |
| --- | --- | --- | --- |
| Suspended data access | denied | _pending_ | ☐ |
| Cross-client note ID | denied | _pending_ | ☐ |
| Role self-escalate | denied | _pending_ | ☐ |
| Hard delete | denied | _pending_ | ☐ |
| Подмена client_uuid | denied | _pending_ | ☐ |

## App regression (service_role)

| Check | Expected | Actual | Pass |
| --- | --- | --- | --- |
| Supabase login | OK | _pending_ | ☐ |
| CRM | OK | _pending_ | ☐ |
| Notes / documents | OK | _pending_ | ☐ |
| Dashboard KPI | OK | _pending_ | ☐ |
| Owner/manager RBAC | OK | _pending_ | ☐ |
| Google off | OK | _pending_ | ☐ |
| Health `rls` / `rlsPhase` | enabled / phase1 | _pending_ | ☐ |

## Итоговые вердикты (после validation)

| Вердикт | Статус |
| --- | --- |
| SAFE TO COMMIT | ✅ да (npm test 607 pass; npm run build OK; migration не применена) |
| SAFE TO APPLY RLS | ❌ **NOT SAFE TO APPLY** до явного подтверждения + зелёного preflight |
| SAFE TO ENABLE AUTH ON VERCEL | ❌ **NOT SAFE** до успешного apply и этой validation |

## Подготовка PR (до apply) — checklist артефактов

| Артефакт | Готов |
| --- | --- |
| migration 025 | ✅ |
| patch + rollback | ✅ |
| policy shape tests | ✅ |
| health rls fields | ✅ |
| docs (report/matrix/runbook/threat) | ✅ |
