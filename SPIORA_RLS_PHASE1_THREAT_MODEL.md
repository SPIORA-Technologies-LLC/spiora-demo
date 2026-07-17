# SPIORA — RLS Phase 1 Threat Model

**PR #18.**

## Активы

- профили сотрудников (`user_profiles`);
- CRM клиенты, заметки, метаданные документов;
- Auth sessions (Supabase);
- service role key (внешний секрет).

## Акторы угроз

1. Анонимный клиент Data API (anon key из фронта).
2. Украденная/подставная session authenticated user.
3. Manager, пытающийся эскалировать роль или архивировать критичное.
4. Suspended / archived пользователь со старым JWT.
5. Insider с service role (внешний контур доверия).

## Доверие / недоверие

| Доверяем | Не доверяем |
| --- | --- |
| `auth.uid()` после Supabase Auth | роли из browser payload |
| `user_profiles.role/status` в БД | user metadata без проверки профиля |
| server session + app RBAC | email как единственный ID |
| | client-provided UUID как proof of access |

## Контроли Phase 1

| Угроза | Контроль |
| --- | --- |
| Anon SELECT/UPDATE | `REVOKE` + RLS без policies для anon |
| Self role escalation | trigger `user_profiles_guard_sensitive_update` |
| Last owner demotion | тот же trigger + app `last_owner_protected` |
| Чужой note/document ID | policies через `client_uuid` + clients RLS |
| Manager document/client archive | `archived_at is null` в manager UPDATE |
| Hard delete | нет DELETE grant + trigger block |
| Catch-all policy | запрещено в migration; покрыто shape-тестами |
| Consultant assigned spoofing | deny до FK-связи `assigned_user_id` ↔ profiles |

## Остаточные риски (честно)

1. **Service role обходит RLS.** Пока API на admin client, IDOR между менеджерами по `DEMO-*` остаётся app-level проблемой.
2. **Нет изоляции assignee** между managers.
3. **FORCE RLS не включён** (Phase 1) — table owner bypass возможен для privileged DB roles.
4. Storage binary / signed URL — вне PR.
5. `assigned_user_id` не UUID профиля — consultant policies отложены.

## Варианты service-role

### Variant A — user-scoped database access

API создаёт server client с user session; запросы проходят RLS.

- **Плюсы:** единый enforcement в БД; меньше IDOR при ошибке в TS.
- **Минусы:** большой рефакторинг repos; middleware/cookies на каждом route; сложнее background jobs.

### Variant B — service role + application RBAC (текущий runtime)

RLS защищает прямой Data API; server API на admin + `getSession` / permissions.

- **Плюсы:** не ломает текущий CRM path при apply; быстрый defense-in-depth против anon.
- **Минусы:** RLS не закрывает баги app RBAC; service key = полный доступ.

**Рекомендация Phase 1:** применить RLS как Variant B shield для Data API; целевой путь — постепенно Variant A для CRUD четырёх таблиц, оставив service role для provisioning / health / demo reset / jobs / узкого admin.
