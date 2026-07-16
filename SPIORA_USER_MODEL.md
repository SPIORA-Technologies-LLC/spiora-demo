# SPIORA USER MODEL

## Цель

Этот документ фиксирует целевую модель пользователя для production-версии Spiora без внедрения Supabase Auth в текущем PR. Модель должна:

- отделять identity от прикладного профиля;
- поддерживать роли и статусы независимо от demo-логики;
- быть совместимой с Supabase Auth, JWT claims и будущими RLS policy;
- не ломать текущую demo с `owner` и `manager`.

## Текущая ситуация

Сейчас runtime-сессия минимальна и хранит только:

- `id`
- `email`
- `name`
- `role`

Источник пользователей сейчас demo-локальный: `src/lib/auth/users.ts`.

## Целевая таблица `users`

| Поле | Тип | Обязательно | Назначение |
| --- | --- | --- | --- |
| `id` | `uuid` | да | Внутренний стабильный идентификатор пользователя в Spiora |
| `auth_user_id` | `uuid` | нет на этапе demo, да после Supabase Auth | Ссылка на `auth.users.id` из Supabase Auth |
| `email` | `citext` / `text` | да | Логин и основной контакт пользователя |
| `first_name` | `text` | да | Имя |
| `last_name` | `text` | да | Фамилия |
| `avatar` | `text` | нет | URL аватара |
| `role` | `text` / `enum` | да | Роль пользователя в RBAC |
| `status` | `text` / `enum` | да | Жизненный статус пользователя |
| `language` | `text` | да | Язык интерфейса и уведомлений |
| `timezone` | `text` | да | Таймзона пользователя |
| `created_at` | `timestamptz` | да | Дата создания записи |
| `archived_at` | `timestamptz` | нет | Мягкое архивирование вместо физического удаления |

## Роли

### Runtime сейчас

- `owner`
- `manager`

### Целевая role-модель

- `owner` — полный доступ к tenant, пользователям, аналитике, security и настройкам.
- `manager` — операционная роль с доступом к CRM, календарю, задачам, заметкам и документам без критичных административных операций.
- `consultant` — прикладная роль с доступом только к назначенным сущностям, собственным задачам, своим встречам и рабочим заметкам.
- `viewer` — read-only роль для руководства, аудита или внешнего наблюдения.

## Статусы

Рекомендуемые значения `status`:

- `invited` — пользователь создан, но ещё не завершил активацию.
- `active` — активный пользователь.
- `suspended` — вход запрещён, данные сохраняются.
- `archived` — пользователь выведен из эксплуатации, записи остаются для аудита.

## Разделение identity и profile

### Identity слой

Identity должен отвечать за:

- email / подтверждение email;
- пароль / magic link / SSO;
- refresh/access session;
- device/session management;
- MFA в будущем.

Этот слой должен жить в Supabase Auth.

### Profile слой

Прикладной профиль Spiora должен отвечать за:

- роль;
- статус;
- язык;
- таймзону;
- отображаемое имя;
- аватар;
- участие в tenant-процессах.

Этот слой должен жить в таблице `users`.

## Рекомендуемая TypeScript-модель

В кодовой базе для этого PR добавлен базовый каркас: `src/lib/auth/user-model.ts`.

Целевая форма записи:

```ts
type PlatformUserRecord = {
  id: string;
  authUserId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  role: "owner" | "manager" | "consultant" | "viewer";
  status: "invited" | "active" | "suspended" | "archived";
  language: "en" | "ru";
  timezone: string;
  createdAt: string;
  archivedAt: string | null;
};
```

## Индексы и ограничения

Рекомендуемые ограничения для PostgreSQL:

- primary key по `id`
- unique index по `auth_user_id`, когда поле не `null`
- unique index по `lower(email)`
- check constraint на `role`
- check constraint на `status`
- check constraint на непустые `first_name`, `last_name`, `timezone`

## Правила жизненного цикла

- Удаление пользователя не должно быть физическим по умолчанию.
- Для production нужен soft-delete через `archived_at` и `status = 'archived'`.
- При `suspended` и `archived` вход должен блокироваться на auth-слое и на app-слое.
- Смена роли должна журналироваться.

## Совместимость с текущей demo

Чтобы не ломать demo:

- текущие пользователи пока остаются в `src/lib/auth/users.ts`;
- runtime по-прежнему использует только `owner` и `manager`;
- `consultant` и `viewer` описаны как целевая модель, но не активируются в login flow в этом PR.
