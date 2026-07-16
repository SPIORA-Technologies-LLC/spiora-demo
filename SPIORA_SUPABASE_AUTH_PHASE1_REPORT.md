# SPIORA — Supabase Auth Phase 1 Report

**PR:** #17  
**Дата:** 16 июля 2026  
**Язык:** русский

## Цель

Подготовить production-аутентификацию через Supabase Auth **без** немедленного отключения demo JWT-login.

## Что сделано

1. Migration `supabase/migrations/024_users_auth_profiles.sql` — таблицы `user_profiles` и `auth_login_rate_limits`.
2. Repository `src/lib/supabase/user-profiles-repo.ts`.
3. Auth clients:
   - browser — anon/publishable (`browser.ts`)
   - server cookie-aware (`server-auth.ts`)
   - middleware refresh (`middleware-auth.ts`)
   - admin — service role (`server.ts`, без изменений контракта)
4. Provider switching: `SPIORA_AUTH_PROVIDER=legacy|supabase` (`provider.ts`).
5. Parallel login в `signInAction` без silent fallback supabase→legacy.
6. Unified `getSession()` с проверкой роли из `user_profiles`.
7. Persistent login rate-limit interface + Supabase store.
8. Health: `authProvider`, `auth`, `profiles`, `session`, `rbac`.
9. Документы cutover/runbook/RLS draft.
10. Тесты Phase 1.

## Что не сделано (намеренно)

- migration не применена;
- Auth users в реальном Supabase не созданы;
- legacy auth не удалён;
- пароли не в Git;
- Vercel не переключён на supabase;
- RLS не включён;
- login UI дизайн не менялся;
- commit / push / deploy не выполнялись.

## Карта зависимостей (аудит)

```
users.ts ──► login (legacy), DemoCredentials, team/notifications/calendar roster
session.ts ──► middleware, layout, ~60 API/pages через getSession()
permissions.ts ──► middleware, nav, redirects
verify-password / password-store ──► только legacy path
```

Phase 1 сохраняет контракт `getSession(): SessionUser | null`, поэтому большинство routes не переписывались.

## Текущий auth flow (legacy, local default)

```
Browser → LoginForm → signInAction
  → rate limit → users.ts → verify password
  → JWT cookie spiora_session
  → middleware / getSession → RBAC
```

## Новый auth flow (supabase)

```
Browser → LoginForm → signInAction
  → rate limit → Supabase Auth signInWithPassword
  → load user_profiles by auth_user_id
  → reject suspended/archived/missing profile
  → Supabase Auth cookies
  → middleware refresh + profile → RBAC
```

## Provider switching rules

| Окружение | Правило |
|---|---|
| Production / Vercel | только `supabase` |
| Local + `SPIORA_AUTH_PROVIDER=legacy` | legacy |
| Local + `SPIORA_AUTH_PROVIDER=supabase` | supabase, **без** fallback на legacy |
| Local без флага | legacy (demo continuity) |

## Session model

Unified session (Supabase mode):

- profile `id`
- `authUserId`
- `email`
- `name` (= display_name)
- `role` **из user_profiles**, не из client metadata
- `status`, `language`, `timezone`

Legacy заполняет safe defaults (`status=active`, `authUserId=null`).

## Security audit (Phase 1)

| Тема | Статус |
|---|---|
| SameSite=Lax / HttpOnly | да (legacy cookie + Supabase cookies) |
| Secure в production | да |
| Origin check | best-effort в login action |
| Open redirect | `isSafeAppPath` + `canAccessPath` |
| Silent fallback | запрещён |
| Raw provider errors | санитизируются |
| Service role в browser | запрещён |
| Passwords в Git/seed | нет |
| Refresh поверх Supabase | не создаём |

## Rate-limit strategy

- Interface: `LoginRateLimiter`
- Persistent store: таблица `auth_login_rate_limits`
- Fallback: in-memory, если Supabase недоступен
- Работает вне demo-only режима
- Пароли в логи не пишутся

## Оценка

- **SAFE TO COMMIT** — foundation code + docs + tests (после зелёных test/build)
- **NOT SAFE TO APPLY MIGRATION** автоматически — только вручную по runbook
- **NOT SAFE TO ENABLE ON VERCEL** до runtime validation
