# SPIORA — Demo Production Baseline

**Статус:** stabilization checkpoint (read-only audit)  
**Дата фиксации:** 2026-07-17  
**Вердикт audit:** ✅ **STABLE FOR DEMO**

---

## Production surface

| Поле | Значение |
| --- | --- |
| **Production URL** | https://spiora-demo.vercel.app |
| **Git commit (baseline)** | `36336d38e7cb816d628c60a218901a1055228534` |
| **Vercel Production deploy SHA** | `36336d3` (совпадает с `main` HEAD) |
| **Репозиторий** | https://github.com/Nikigo1983/spiora-demo (Private) |
| **Supabase project ref** | `lrqeoiafyegtlcqogrkx` |
| **Supabase URL** | `https://lrqeoiafyegtlcqogrkx.supabase.co` |

---

## Cutover timeline

| Этап | Дата | Статус |
| --- | --- | --- |
| Supabase Auth Phase 1 (PR #17) | 2026-07 | ✅ |
| RLS Phase 1 apply на demo DB (PR #18) | 2026-07-17 | ✅ |
| RLS + Auth runtime validation localhost | 2026-07-17 | ✅ |
| Vercel Supabase Auth cutover | 2026-07-17 | ✅ (owner подтвердила login) |

---

## Auth & security posture

| Параметр | Ожидание | Факт (audit) |
| --- | --- | --- |
| Auth provider | `supabase` | ✅ Vercel force supabase (`VERCEL=1`) |
| Legacy auth fallback | выключен на Vercel | ✅ `isLegacyAuthAllowed()` → false |
| CRM legacy fallback | выключен на Vercel | ✅ `isCrmLegacyFallbackAllowed()` → false при `VERCEL=1` |
| RLS Phase 1 | `enabled` | ✅ `spiora_rls_phase1_status()` = enabled |
| `rlsPhase` (health) | `phase1` | ✅ код в `system-health.ts` |
| Google backend | выключен | ✅ `SPIORA_ENABLE_GOOGLE_INTEGRATIONS` не включён (demo policy) |
| Demo mode | включён | ✅ `SPIORA_DEMO_MODE=true` (Vercel env) |
| Service role в browser bundle | отсутствует | ✅ `browser.ts` — только anon; `createSupabaseBrowserClient` нигде не импортируется; boundary tests pass |

---

## Demo users (fictional)

| Email | Роль | Runtime |
| --- | --- | --- |
| `olivia@spiora.demo` | owner | active |
| `daniel@spiora.demo` | manager | active |
| `emma@spiora.demo` | manager | active |
| `lucas@spiora.demo` | manager | active |

**Пароли:** только Supabase Dashboard → Authentication → Users.  
**Не использовать:** `AUTH_PASSWORD_*` из `.env.local` / Vercel для Supabase Auth.

---

## Production audit results (2026-07-17)

### HTTP (automated, без session)

| Endpoint | Ожидание | Факт |
| --- | --- | --- |
| `GET /login` | 200 | ✅ 200 |
| `GET /api/clients` | 401 | ✅ 401 |
| `GET /api/system/health` | 401 | ✅ 401 |
| `GET /dashboard` | redirect login | ✅ 307 |
| `GET /clients` | redirect login | ✅ 307 |

### Browser (user-verified)

| Check | Статус |
| --- | --- |
| Olivia login/logout | ✅ |
| Daniel login | ✅ |
| CRM | ✅ |
| Dashboard | ✅ |
| Notes/Documents | ✅ (user: «всё работает») |
| Vercel login после env cutover | ✅ |

### Git

| Check | Статус |
| --- | --- |
| `HEAD` = `origin/main` | ✅ `36336d3` |
| Working tree clean | ✅ |
| Unpushed commits | ✅ нет |
| Uncommitted migrations/docs | ✅ нет |

### Tests (local, regression signal)

| Check | Статус |
| --- | --- |
| `npm test` | ✅ 607 pass |

---

## Vercel Environment Variables checklist

### Обязательные (подтверждены / требуются)

| Variable | Назначение | Audit |
| --- | --- | --- |
| `SPIORA_DEMO_MODE` | demo isolation | ✅ есть |
| `SPIORA_ENABLE_SUPABASE` | PostgreSQL CRM | ✅ есть |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project | ✅ есть |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Auth session | ✅ добавлен (login работает) |
| `SUPABASE_SERVICE_ROLE_KEY` | server CRM/API | ✅ есть |
| `SPIORA_ALLOWED_SUPABASE_PROJECT_REFS` | project guard | ✅ есть |

### Опциональные / рекомендуемые

| Variable | Audit |
| --- | --- |
| `SPIORA_AUTH_PROVIDER=supabase` | ⚠️ не обязателен на Vercel (auto-force), можно добавить явно |
| `NEXT_PUBLIC_APP_URL` | ⚠️ проверить = `https://spiora-demo.vercel.app` |
| `AUTH_SECRET` | ⚠️ желателен; не виден в audit screenshot |
| `SPIORA_BLOCKED_SUPABASE_PROJECT_REFS` | ✅ есть (blocklist) |

### Лишние (не ломают, но не нужны для Supabase Auth)

| Variable | Комментарий |
| --- | --- |
| `AUTH_PASSWORD_*` | legacy-only; **не используются** при supabase auth |

**Не добавлять на Vercel:** `SPIORA_CRM_LEGACY_FALLBACK=true`, `SPIORA_AUTH_PROVIDER=legacy`.

---

## Rollback procedures

### RLS Phase 1 (блокирующая регрессия data access)

1. SQL Editor → `SPIORA_SUPABASE_PATCH_025_RLS_ROLLBACK.sql`
2. Verify: `spiora_rls_phase1_status()` → `disabled`
3. **Не удаляет** данные, profiles, Auth users

### Vercel Auth cutover (откат login path)

1. Убрать / не задавать `NEXT_PUBLIC_SUPABASE_ANON_KEY` → login через supabase перестанет работать
2. Полный откат к legacy на Vercel **невозможен** по дизайну (`VERCEL=1` → supabase only)
3. При критической регрессии: redeploy предыдущего commit + restore env snapshot

### Supabase backup

Free plan: scheduled backups **недоступны**. Держать rollback SQL под рукой.

---

## Известные ограничения (не баги baseline)

1. **Variant B CRM:** server API использует `service_role` и **обходит RLS** — защита Data API + app RBAC, не единый DB enforcement.
2. **Manager isolation:** все managers видят всех clients (нет assignee RLS).
3. **Consultant/viewer:** RLS deny; runtime login для этих ролей не активен.
4. **RLS Phase 2+:** tasks, calendar, team_chat, Storage — **без RLS**.
5. **Негативные abuse/suspended тесты:** не полностью прогнаны на production.
6. **Free Supabase:** нет automated backup.

---

## Что НЕ менять перед демонстрацией

- ❌ новые migrations / SQL apply без отдельного PR
- ❌ rollback RLS без блокирующей причины
- ❌ изменение Vercel env (особенно Supabase keys)
- ❌ включение `SPIORA_ENABLE_GOOGLE_INTEGRATIONS`
- ❌ включение legacy auth / CRM fallback
- ❌ force push / destructive git ops
- ❌ удаление demo Auth users или profiles в Supabase

---

## Следующий инженерный шаг (после baseline)

**PR #19 — User-scoped CRM access (Variant A)**  
Scope: только `clients`, `client_notes`, `client_documents`.  
Цель: authenticated session → user-scoped Supabase client → RLS policies.  
`service_role` оставить для health, provisioning, demo reset, system ops.

**Не в одном PR:** tasks, calendar, chat, Storage.

---

## Audit sign-off

| Auditor | Method | Result |
| --- | --- | --- |
| Automated HTTP/Git/Tests | Cursor agent | ✅ no drift |
| Browser login (Olivia/Daniel) | User confirmed | ✅ |
| Health `rls` on production API | User partial / localhost verified | ⚠️ re-check on Vercel if needed |

**STABLE FOR DEMO** — при условии не менять env и не деплоить новые PR до показа.
