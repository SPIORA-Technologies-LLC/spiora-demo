# SPIORA — Supabase Auth Runtime Validation

**PR:** #17.2  
**Дата:** 16 июля 2026  
**Проект:** Spiora Demo (local)  
**Статус:** runtime validation завершена (включая ручной browser login)

См. также: `SPIORA_SUPABASE_AUTH_RUNTIME_APPLY.md`

Пароли, токены и полные UUID в этот документ **не** включены.

---

## 1. Migration / PATCH_024

| Проверка | Результат | Notes |
|---|---|---|
| PATCH_024 выполнен без ошибок | ✅ | #17.1 |
| `user_profiles` существует | ✅ | |
| `auth_login_rate_limits` существует | ✅ | |
| role/status constraints есть | ✅ | |
| indexes созданы | ✅ | |

## 2. Auth users / profiles

| Проверка | Результат | Ожидание |
|---|---|---|
| Auth users (demo) | 4 | 4 |
| user_profiles | 4 | 4 |
| active owners | 1 | 1 |
| active managers | 3 | 3 |
| profiles without Auth user | 0 | 0 |
| demo Auth without profile | 0 | 0 |
| duplicate email | 0 | 0 |
| duplicate auth_user_id | 0 | 0 |

## 3. Local ENV

| Проверка | Результат |
|---|---|
| `SPIORA_AUTH_PROVIDER=supabase` | ✅ (локально, не в Git) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ |
| `SPIORA_ENABLE_SUPABASE=true` | ✅ |
| Google integrations выключены | ✅ |
| Vercel ENV не менялся | ✅ |

## 4. No silent fallback

| Проверка | Результат |
|---|---|
| provider = supabase | ✅ |
| legacy fallback не используется | ✅ (подтверждено вручную в browser) |
| invalid password без legacy | ✅ |

## 5. Browser login (ручная проверка)

| Проверка | Результат |
|---|---|
| Olivia owner login | ✅ OK |
| Olivia owner logout | ✅ OK |
| owner-only разделы (Analytics/Settings/Health) | ✅ OK |
| Daniel manager login | ✅ OK |
| Emma manager login | ✅ OK |
| manager restrictions | ✅ OK |
| Supabase session после reload | ✅ OK |
| legacy fallback не используется | ✅ OK |

## 6. Session / cookies

| Проверка | Результат |
|---|---|
| session сохраняется после reload | ✅ |
| unauthenticated → `/login` | ✅ |
| Health/API без session denied | ✅ |
| legacy cookie ignored in supabase mode | ✅ |

## 7. Health API

| Поле | Результат |
|---|---|
| authProvider | `supabase` |
| auth | `ok` |
| profiles | `ok` |
| session | `ok` |
| rbac | `warning` |
| redaction | ✅ |

## 8. Rate limit

| Проверка | Результат |
|---|---|
| persistent `auth_login_rate_limits` | ✅ |
| cleanup тестовых записей | ✅ |

## 9. RBAC

| Проверка | Результат |
|---|---|
| role из `user_profiles` | ✅ |
| owner → settings/analytics | ✅ |
| manager → forbidden | ✅ |

## 10. Regression

| Проверка | Результат |
|---|---|
| CRM PostgreSQL (25 clients) | ✅ |
| Google off | ✅ |
| `npm test` | ✅ 594 pass |
| `npm run build` | ✅ |

## 11. Вердикты

| Вердикт | Решение |
|---|---|
| **SAFE TO COMMIT** | ✅ да |
| **SAFE TO PUSH** | ✅ да |
| **NOT SAFE TO ENABLE ON VERCEL** | ✅ до RLS Phase 1 |

---

**Краткий итог:** local Supabase Auth runtime подтверждён (owner/manager login, logout, RBAC, session reload, no legacy fallback). Включать на Vercel только после RLS Phase 1.
