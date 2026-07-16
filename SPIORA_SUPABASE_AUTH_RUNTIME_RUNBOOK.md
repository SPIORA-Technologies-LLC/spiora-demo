# SPIORA — Supabase Auth Runtime Runbook (Phase 1)

## Важно

Этот runbook **ручной**. Автоматически migration и Auth users не создавать.

Пароли:

- не хранить в Git;
- не класть в seed SQL;
- не показывать в публичном UI после production cutover;
- задавать только через Dashboard / Admin API / локальный защищённый процесс.

## Шаг 1 — Применить migration 024

В Supabase SQL Editor выполнить:

`supabase/migrations/024_users_auth_profiles.sql`

Проверить наличие таблиц:

- `user_profiles`
- `auth_login_rate_limits`

## Шаг 2 — Создать fictional Auth users

Через **Supabase Dashboard → Authentication → Users → Add user**  
или Admin API `auth.admin.createUser`.

Создать четыре demo-аккаунта:

| Email | Роль в профиле |
|---|---|
| `olivia@spiora.demo` | owner |
| `daniel@spiora.demo` | manager |
| `emma@spiora.demo` | manager |
| `lucas@spiora.demo` | manager |

Временные пароли задать локально и сохранить вне репозитория.

**Запрещено:** `INSERT INTO auth.users ...`

## Шаг 3 — Скопировать auth_user_id

Для каждого пользователя скопировать UUID из Auth.

## Шаг 4 — Вставить профили

Подставить реальные UUID в шаблон из конца migration 024 (закомментированный блок) и выполнить INSERT.

Проверить:

```sql
select email, role, status, auth_user_id, is_demo
from user_profiles
order by email;
```

## Шаг 5 — Локальные env

```env
SPIORA_AUTH_PROVIDER=supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Не включать provider=supabase на Vercel на этом шаге.

## Шаг 6 — Проверки

1. Login owner (`olivia@spiora.demo`) → `/dashboard`
2. Login manager → нет доступа к `/settings` и `/analytics`
3. Logout → `/login`
4. Suspended profile → отказ во входе
5. Missing profile → отказ во входе
6. `GET /api/system/health` (owner) → `authProvider=supabase`, без URL/ключей

## Шаг 7 — Откат локально

```env
SPIORA_AUTH_PROVIDER=legacy
```

Legacy JWT-login должен снова работать в local development.

## Шаг 8 — Vercel (только после validation)

1. Убедиться, что profiles и Auth users готовы.
2. Выставить `SPIORA_AUTH_PROVIDER=supabase`.
3. Добавить anon key в Vercel env.
4. Не оставлять `SPIORA_AUTH_PROVIDER=legacy` на Vercel (игнорируется принудительно, но не путать команду).

## Troubleshooting

| Симптом | Действие |
|---|---|
| `auth_unavailable` | проверить anon URL/key, не падать в legacy |
| `accountDisabled` | проверить status/archived_at/profile |
| Health `profiles=unavailable` | migration 024 не применена |
| Middleware пускает без роли | роль должна читаться из `user_profiles` |
