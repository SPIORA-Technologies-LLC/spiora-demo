# SPIORA — RLS Phase 1 Runtime Validation

**PR #18.1.** Migration **применена** на demo Supabase (2026-07-17).  
**Среда проверки:** localhost (`npm run dev`), не Vercel.

## Preflight (до apply)

| Check | Expected | Actual | Pass |
| --- | --- | --- | --- |
| Auth users | 4 | 4 | ✅ |
| Active profiles | 4 | 4 | ✅ |
| Active owners | 1 | 1 | ✅ |
| Active managers | 3 | 3 | ✅ |
| Clients | 25 | 25 | ✅ |
| Orphan notes | 0 | 0 | ✅ |
| Orphan documents | 0 | 0 | ✅ |
| notes без client_uuid | 0 | 0 | ✅ |
| Profiles без auth_user_id | 0 | 0 | ✅ |
| Auth users without profile | 0 | 0 | ✅ |
| Role/status constraints | present | 2 rows | ✅ |

**Preflight verdict:** ✅ **SAFE TO APPLY**

## Post-apply SQL

| Check | Expected | Actual | Pass |
| --- | --- | --- | --- |
| `spiora_rls_phase1_status()` | enabled | enabled | ✅ |
| RLS on 4 tables | true | true (все 4) | ✅ |
| Policy count Phase 1 | ≥ 16 | не считали отдельно | ☐ |

## Anonymous

| Check | Expected | Actual | Pass |
| --- | --- | --- | --- |
| SELECT clients без session | denied/empty | _не проверено_ | ☐ |
| SELECT user_profiles | denied/empty | _не проверено_ | ☐ |

## Olivia owner

| Check | Expected | Actual | Pass |
| --- | --- | --- | --- |
| Login / session | OK | OK (localhost) | ✅ |
| Profiles / self | OK | _не проверено отдельно_ | ☐ |
| Clients CRUD + archive | OK | _не проверено отдельно_ | ☐ |
| Notes CRUD | OK | _не проверено отдельно_ | ☐ |
| Documents create/update/archive | OK | _не проверено отдельно_ | ☐ |

## Daniel manager

| Check | Expected | Actual | Pass |
| --- | --- | --- | --- |
| Clients read/create/update | OK | _не проверено_ | ☐ |
| Client archive | denied | _не проверено_ | ☐ |
| Notes CRUD | OK | _не проверено_ | ☐ |
| Documents read/create/update | OK | _не проверено_ | ☐ |
| Document archive | denied | _не проверено_ | ☐ |
| Role/status profile change | denied | _не проверено_ | ☐ |

## Suspended / abuse

| Check | Expected | Actual | Pass |
| --- | --- | --- | --- |
| Suspended data access | denied | _не проверено_ | ☐ |
| Cross-client note ID | denied | _не проверено_ | ☐ |
| Role self-escalate | denied | _не проверено_ | ☐ |
| Hard delete | denied | _не проверено_ | ☐ |
| Подмена client_uuid | denied | _не проверено_ | ☐ |

## App regression (service_role path)

| Check | Expected | Actual | Pass |
| --- | --- | --- | --- |
| Supabase login (Olivia) | OK | OK (localhost) | ✅ |
| App opens after login | OK | OK | ✅ |
| CRM | OK | _не проверено отдельно_ | ☐ |
| Notes / documents | OK | _не проверено отдельно_ | ☐ |
| Dashboard KPI | OK | _не проверено отдельно_ | ☐ |
| Owner/manager RBAC | OK | _не проверено отдельно_ | ☐ |
| Google off | OK | env off | ✅ |
| Health `rls` / `rlsPhase` | enabled / phase1 | _не проверено в API_ | ☐ |

## Заметки

- Backup на Free plan недоступен; rollback: `SPIORA_SUPABASE_PATCH_025_RLS_ROLLBACK.sql`.
- Vercel **не использовался** для login (старая версия кода / другой auth path).
- `npm run dev` на Windows: использовать `npm.cmd run dev` при блокировке PowerShell ExecutionPolicy.

## Итоговые вердикты (после validation)

| Вердикт | Статус |
| --- | --- |
| SAFE TO COMMIT | ✅ да |
| SAFE TO PUSH | ✅ да |
| SAFE TO APPLY RLS | ✅ **применено**, preflight + SQL verification OK |
| SAFE TO ENABLE AUTH ON VERCEL | ❌ **NOT SAFE** — нужны полный browser/API validation + deploy с env |

## Подготовка PR — checklist артефактов

| Артефакт | Готов |
| --- | --- |
| migration 025 | ✅ applied |
| patch + rollback | ✅ |
| policy shape tests | ✅ |
| health rls fields | ✅ |
| docs (report/matrix/runbook/threat) | ✅ |
| runtime validation (partial) | ✅ этот файл |
