# SPIORA — RLS Phase 1 Runtime Validation

**PR #18.1.** Migration **применена** на demo Supabase (2026-07-17).  
**Среда:** localhost `http://localhost:3000`, не Vercel.

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

## Anonymous / Data API

| Check | Expected | Actual | Pass |
| --- | --- | --- | --- |
| SELECT clients без session (anon key) | denied | HTTP 401 permission denied | ✅ |
| SELECT user_profiles (anon key) | denied | HTTP 401 permission denied | ✅ |
| `GET /api/clients` без cookie | 401 | 401 | ✅ |
| `GET /api/system/health` без cookie | 401 | 401 | ✅ |

## Olivia owner

| Check | Expected | Actual | Pass |
| --- | --- | --- | --- |
| Login / session | OK | OK | ✅ |
| Dashboard opens | OK | OK | ✅ |
| Clients / notes / documents | OK | OK (browser) | ✅ |
| Settings / Analytics | OK | OK (browser) | ✅ |
| Health `rls` / `rlsPhase` | enabled / phase1 | OK (browser) | ✅ |

## Daniel manager

| Check | Expected | Actual | Pass |
| --- | --- | --- | --- |
| Login | OK | OK (browser) | ✅ |
| Clients read/create/update | OK | OK (browser) | ✅ |
| Client archive | denied | OK (browser) | ✅ |
| Notes CRUD | OK | OK (browser) | ✅ |
| Documents read/create/update | OK | OK (browser) | ✅ |
| Document archive | denied | OK (browser) | ✅ |
| `/settings`, `/analytics` | denied | OK (browser) | ✅ |

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
| Supabase login (Olivia) | OK | OK | ✅ |
| Supabase login (Daniel) | OK | OK (browser) | ✅ |
| App opens after login | OK | OK | ✅ |
| Service role CRM read (25 clients) | OK | Content-Range 0-24/25 | ✅ |
| `npm test` | 607 pass | 607 pass | ✅ |
| CRM / notes / documents UI | OK | OK (browser) | ✅ |
| Dashboard KPI UI | OK | OK (browser) | ✅ |
| Google off | OK | env off | ✅ |

## Заметки

- Backup на Free plan недоступен; rollback: `SPIORA_SUPABASE_PATCH_025_RLS_ROLLBACK.sql`.
- Vercel: код на origin есть; Auth на Vercel включать **только после** настройки env (см. ниже).
- Windows: `npm.cmd run dev` при блокировке PowerShell ExecutionPolicy.

## Итоговые вердикты

| Вердикт | Статус |
| --- | --- |
| SAFE TO COMMIT | ✅ |
| SAFE TO PUSH | ✅ |
| SAFE TO APPLY RLS | ✅ применено, validation OK |
| SAFE TO ENABLE AUTH ON VERCEL | ⚠️ **после env + redeploy** — не включать вслепую |

### Vercel cutover (когда будете готовы)

В Vercel Environment Variables (Production):

```env
SPIORA_AUTH_PROVIDER=supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SPIORA_ENABLE_SUPABASE=true
```

Затем redeploy. Пароли — только из Supabase Dashboard, не `AUTH_PASSWORD_*`.
