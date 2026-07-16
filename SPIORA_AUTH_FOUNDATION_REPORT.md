# SPIORA AUTH FOUNDATION REPORT

## Executive Summary

PR #16 подготавливает foundation для production identity и security, не ломая текущую demo и не внедряя Supabase Auth прямо сейчас.

Сделано в этом PR:

- зафиксирован audit текущей auth/session/RBAC архитектуры;
- описана целевая user model;
- подготовлена permissions matrix для будущих ролей;
- расширен `GET /api/system/health` статусами `auth`, `session`, `rbac`;
- добавлены тестируемые auth/session helper-функции;
- добавлены тесты для session, rate limit, RBAC и health.

## Runtime схема Auth

```text
Browser
  ↓
Login
  ↓
JWT Cookie (spiora_session)
  ↓
Middleware
  ↓
API / App Layout
  ↓
RBAC
```

### Как это реализовано сейчас

1. Логин идёт через `src/app/login/actions.ts`.
2. Проверка пользователя идёт через demo roster `src/lib/auth/users.ts`.
3. Пароль проверяется через `src/lib/auth/verify-password.ts`.
4. Сессия создаётся в `src/lib/auth/session.ts`.
5. JWT сохраняется в `httpOnly` cookie `spiora_session`.
6. `middleware.ts` защищает основные app routes.
7. `getSession()` и route-level checks дополнительно защищают SSR и API.
8. RBAC строится на ролях `owner` и `manager`, плюс на domain-specific permission helpers.

## Что изменено в коде

### 1. Session foundation

В `src/lib/auth/session.ts` вынесены testable helper’ы:

- `getAuthSecretState()`
- `getSessionCookieConfig()`
- `createSessionToken()`
- `verifySessionToken()`

Это позволяет отдельно тестировать:

- источник секрета;
- cookie config;
- валидный JWT;
- invalid / expired session;
- неподдерживаемые роли в токене.

### 2. User model foundation

Добавлен `src/lib/auth/user-model.ts` как каркас целевой модели:

- planned roles: `owner`, `manager`, `consultant`, `viewer`
- user statuses: `invited`, `active`, `suspended`, `archived`
- `PlatformUserRecord`
- `PlatformSessionClaims`

Текущий runtime при этом не менялся и продолжает работать только с `owner` и `manager`.

### 3. Health API

`src/lib/system/system-health.ts` теперь возвращает:

- `auth`
- `session`
- `rbac`

Интерпретация:

- `auth = ok` — задан нормальный `AUTH_SECRET`
- `auth = warning` — используется dev fallback secret
- `auth = disabled` — auth secret отсутствует в production
- `session = warning` — сессия работает, но пока без refresh/revocation rotation
- `rbac = warning` — RBAC есть, но ещё не data-driven и не покрывает полную role-модель

## Текущие роли

### Реально реализованы сейчас

- `owner`
- `manager`

### Целевые роли

- `owner`
- `manager`
- `consultant`
- `viewer`

## Session Audit

### Cookie lifecycle

- cookie name: `spiora_session`
- storage: `httpOnly` cookie
- `sameSite: "lax"`
- `secure: true` только в production
- TTL: 7 дней

### Refresh

- refresh token отсутствует
- sliding session отсутствует
- idle timeout отсутствует

### Logout

- logout удаляет cookie только у текущего клиента
- server-side revoke отсутствует
- logout-from-all-devices отсутствует

### Invalid session

- invalid JWT даёт `null` в `getSession()`
- SSR routes ведут на `/login`
- API routes возвращают `401`

### Multiple tabs

- вкладки делят одну cookie
- централизованной cross-tab синхронизации logout нет

### Expired cookie / expired token

- просроченный JWT перестаёт проходить верификацию
- graceful refresh flow отсутствует

## Security Audit

### Что уже хорошо

- используется `httpOnly` cookie;
- `sameSite=lax` лучше, чем полностью открытая cookie;
- JWT проверяется подписью;
- owner-only маршруты и API уже отделены от manager;
- есть базовый login rate limit для demo mode.

### Основные риски

#### Session fixation

Классической server-side fixation нет, но нет и server-side session id с ревокацией. Украденный JWT живёт до истечения.

#### CSRF

Полноценной CSRF-защиты нет:

- нет CSRF token;
- нет явной проверки `Origin` / `Referer`;
- защита опирается в основном на `SameSite=Lax`.

#### XSS

`httpOnly` cookie снижает риск кражи session через JS, но XSS всё равно остаётся риском для UI и action abuse. Отдельного XSS-аудита sanitization layers этот PR не вводит.

#### Brute force

Rate limit:

- только in-memory;
- только в demo mode;
- не shared между instance;
- сбрасывается при рестарте.

#### Replay

Нет:

- `jti`
- refresh rotation
- revocation list
- session versioning

#### Cookie flags

Есть:

- `HttpOnly`
- `SameSite=Lax`
- `Secure` в production

Нет:

- rotation strategy
- device/session binding
- централизованной session invalidation

## Auth gaps

Основные пробелы до production:

1. Пользователи всё ещё demo-local, а не data-driven из таблицы `users`.
2. Нет `auth_user_id` и связи с Supabase Auth.
3. Нет refresh token, revoke и session rotation.
4. Нет полноценной CSRF-защиты.
5. RBAC частично размазан по route/page/domain checks.
6. Роли `consultant` и `viewer` ещё не активированы в runtime.
7. Нет RLS enforcement на уровне PostgreSQL.

## Health API

`GET /api/system/health` остаётся owner-only и теперь дополнительно показывает:

- `auth`
- `session`
- `rbac`

Это не заменяет security audit, но даёт быстрый runtime-индикатор готовности identity-слоя.

## Документы PR #16

- `SPIORA_USER_MODEL.md`
- `SPIORA_PERMISSIONS_MATRIX.md`
- `SPIORA_SUPABASE_AUTH_PLAN.md`
- `SPIORA_AUTH_FOUNDATION_REPORT.md`

## Тесты, добавленные в PR

- `src/lib/auth/session.test.ts`
- `src/lib/auth/permissions.test.ts`
- `src/lib/auth/login-rate-limit.test.ts`
- обновлён `src/lib/system/system-health.test.ts`

## Итоговая оценка

### Что уже можно считать foundation-ready

- понятная runtime auth-схема
- формализованный target user model
- target permissions matrix
- health signal для auth/session/rbac
- тестируемый session layer

### Что пока не production-ready

- demo-local identity
- отсутствие refresh/revoke
- отсутствие полноценного CSRF слоя
- отсутствие RLS enforcement

## Предварительный вывод

После этого PR проект становится заметно лучше подготовлен к production migration по identity/security, но сам auth-слой всё ещё нельзя считать полностью production-ready без следующего этапа: data-driven users, Supabase Auth cutover и RLS.
