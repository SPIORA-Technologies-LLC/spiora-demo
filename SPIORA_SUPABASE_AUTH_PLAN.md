# SPIORA SUPABASE AUTH PLAN

## Ограничение этого PR

В этом PR Supabase Auth не внедряется. Документ фиксирует подготовительный план и совместимость текущего session-слоя с будущей миграцией.

## Текущее состояние

Сейчас Spiora использует:

- demo users из `src/lib/auth/users.ts`;
- JWT cookie `spiora_session`;
- локальную проверку пароля через `src/lib/auth/verify-password.ts`;
- guard-логику в middleware, layout и API;
- service-role доступ к Supabase на сервере, а не пользовательскую auth-session.

## Runtime схема сейчас

```text
Browser
  ↓
Login form
  ↓
signInAction()
  ↓
JWT cookie spiora_session
  ↓
middleware / layout / API getSession()
  ↓
RBAC checks
```

## Сопоставление `Сейчас -> Будет`

| Сейчас | Будет |
| --- | --- |
| `SessionUser.id` = demo user id | `users.id` как внутренний app user id |
| Нет `auth_user_id` | `users.auth_user_id -> auth.users.id` |
| `SessionUser.email` из demo roster | `auth.users.email` + дублирование в `users.email` |
| `SessionUser.name` одной строкой | `users.first_name` + `users.last_name` |
| `SessionUser.role` из demo roster | `users.role` или JWT custom claim, синхронизированный из `users.role` |
| JWT подписывается локальным `AUTH_SECRET` | Supabase access token / refresh token |
| Cookie `spiora_session` | Supabase auth cookies |
| Локальная проверка пароля | Supabase Auth password / magic link / SSO |
| `isUserDeleted()` через app state/file store | `users.status`, `archived_at`, возможный deny-login hook |
| Rate limit только in-memory demo mode | Edge / gateway / auth provider rate limiting |
| Logout удаляет только local cookie | Supabase sign-out + revoke refresh session |

## Целевая сессионная модель

### Сейчас

Сессия хранит только:

- `id`
- `email`
- `name`
- `role`

### Целевые claims

Минимально рекомендуемые claims после миграции:

- `sub` — `auth.users.id`
- `email`
- `app_user_id`
- `role`
- `status`
- `language`
- `timezone`
- `tenant_id` или `company_id`, если multi-tenant станет явным

## Что уже готово к миграции

- единая точка чтения session: `getSession()`
- JWT helper в `src/lib/auth/session.ts`
- middleware уже умеет читать cookie и пускать/не пускать на protected routes
- часть RBAC уже вынесена в helper-функции
- Supabase persistence уже используется для app state и PostgreSQL доменных данных

## Что мешает миграции прямо сейчас

- пользователи зашиты в `src/lib/auth/users.ts`
- роли ограничены runtime-типом `owner | manager`
- нет таблицы `users` как источника истины
- нет `auth_user_id`
- нет refresh session flow
- нет session revocation
- часть RBAC зашита inline в routes/pages
- есть plain-text password fallback для demo

## Этапы миграции без поломки demo

### Этап A — подготовка данных

1. Создать таблицу `users`.
2. Заполнить её существующими demo users.
3. Добавить `auth_user_id = null` на переходном этапе.
4. Перенести role/status/language/timezone в таблицу.

### Этап B — подготовка auth bridge

1. Добавить mapper `auth.users -> users`.
2. Добавить слой чтения session claims из Supabase cookie.
3. Сохранить совместимость через адаптер `getSession()`.

### Этап C — cutover

1. Убрать demo login как primary flow.
2. Переключить login/logout на Supabase Auth.
3. Переключить middleware и API на Supabase claims.
4. Включить RLS для пользовательских таблиц.

## Draft RLS policies

Ниже не применение, а целевая спецификация.

### Общий принцип

Во всех policy предполагается:

- `auth.uid()` = `users.auth_user_id`
- роль и статус читаются из таблицы `users`
- `users.status = 'active'` обязательно для write-операций

### `clients`

- `select`: owner, manager; consultant только по назначенным клиентам; viewer только по явно разрешённым
- `insert`: owner, manager
- `update`: owner, manager для разрешённых клиентов
- `delete/archive`: owner

### `notes`

- `select`: owner, manager; consultant только по связанным клиентам/своим записям
- `insert`: owner, manager, consultant в своём контуре
- `update`: author, owner, manager
- `delete/archive`: owner, manager по правилам политики

### `documents`

- `select`: owner, manager; consultant по связанным клиентам
- `insert`: owner, manager, consultant в своём контуре
- `update`: owner, manager, uploader/author при соблюдении правил
- `delete/archive`: owner

### `calendar`

- `select`: owner, manager, участник встречи, владелец personal event
- `insert`: active user
- `update/delete`: owner, creator, owner of personal event

### `tasks`

- `select`: creator, assignee, owner
- `insert`: owner, manager
- `update`: creator, owner; limited status updates для assignee
- `delete`: creator, owner

### `chat`

- `select`: только active team members внутри tenant
- `insert`: только active team members
- `update/delete`: author либо owner/moderation role

### `notifications`

- `select`: только `user_id = current app user`
- `insert`: system/service или owner-managed functions
- `update`: только mark-as-read для владельца записи

### `analytics`

- `select`: owner only, либо curated read-only view для viewer в будущем
- `insert/update/delete`: только system jobs / service functions

### `knowledge`

- `select`: owner, manager, consultant, viewer по published/readable policy
- `insert/update`: owner, manager
- `delete/archive`: owner

### `users`

- `select`: owner full; manager ограниченный список; user может читать только self-profile
- `update`: owner full; user может менять только self-profile fields без role/status
- `delete/archive`: owner only

## Что должно остаться стабильным после миграции

- текущие маршруты и UI логина не должны требовать redesign;
- `getSession()` должен остаться публичным runtime API для app-кода;
- role checks должны перейти из demo roster в data-driven источник без переписывания всего приложения.
