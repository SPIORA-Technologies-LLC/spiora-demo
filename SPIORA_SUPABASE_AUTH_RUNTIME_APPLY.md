# SPIORA — Supabase Auth Runtime Apply (PR #17.1)

Ручная инструкция. **Ничего не применять автоматически.**  
Не коммитить локальную копию seed с реальными UUID.  
Не менять `.env.local` в этом PR без вашего явного решения (ниже — только что поставить вручную).

Связанные файлы:

- `SPIORA_SUPABASE_PATCH_024.sql`
- `SPIORA_USER_PROFILES_SEED_TEMPLATE.sql`
- `SPIORA_SUPABASE_AUTH_RUNTIME_VALIDATION.md`

---

## Точный порядок действий

### A. Применить PATCH_024

1. Открыть Supabase Dashboard → **SQL Editor**.
2. Вставить содержимое `SPIORA_SUPABASE_PATCH_024.sql`.
3. Выполнить (Run).
4. Убедиться, что PART A прошёл без ошибок.

### B. Проверить схему

Выполнить verification-блок из того же файла (PART B) или отдельно:

| Проверка | Ожидание сразу после PATCH |
|---|---|
| `user_profiles` существует | `to_regclass` не null |
| `auth_login_rate_limits` существует | `to_regclass` не null |
| constraints | `user_profiles_role_check`, `user_profiles_status_check`, unique email/auth_user_id |
| indexes | `user_profiles_auth_user_id_uidx`, `user_profiles_email_lower_uidx`, role/status/active indexes |
| `user_profiles` count | **0** |
| `auth_login_rate_limits` count | **0** |

### C. Создать 4 fictional Auth users

Dashboard → **Authentication** → **Users** → **Add user**.

| Email | Display / notes |
|---|---|
| `olivia@spiora.demo` | Olivia Bennett — owner |
| `daniel@spiora.demo` | Daniel Cooper — manager |
| `emma@spiora.demo` | Emma Wilson — manager |
| `lucas@spiora.demo` | Lucas Martin — manager |

**Запрещено:** `INSERT INTO auth.users ...` через SQL.

### D. Пароли

- Задать временные пароли **вручную** в Dashboard.
- Хранить только вне Git (password manager / локальная защищённая заметка).
- Не писать пароли в SQL, Markdown, `.env` в репозитории, UI production.

### E. Скопировать auth user UUID

Для каждого user в Auth скопировать `User UID` (`auth.users.id`).

### F. Подставить UUID только в локальную копию seed

1. Скопировать `SPIORA_USER_PROFILES_SEED_TEMPLATE.sql` → например  
   `SPIORA_USER_PROFILES_SEED.LOCAL.sql` (**не коммитить**).
2. Заменить:
   - `<AUTH_USER_ID_OLIVIA>`
   - `<AUTH_USER_ID_DANIEL>`
   - `<AUTH_USER_ID_EMMA>`
   - `<AUTH_USER_ID_LUCAS>`
3. Шаблон в Git должен остаться с placeholder’ами.

### G. Выполнить profile seed

1. SQL Editor → выполнить **локальную** копию seed.
2. Ожидание: 4 строки в `user_profiles`, upsert по `auth_user_id` идемпотентен.

### H. Проверить join `auth.users` ↔ `user_profiles`

Запустить queries из seed footer / PATCH PART B:

| Query | Ожидание после seed |
|---|---|
| count `user_profiles` | **4** |
| profiles without auth user | **0** |
| demo auth users without profile | **0** |
| role/status distribution | 1 owner/active + 3 manager/active |
| duplicate email | **0** |
| duplicate auth_user_id | **0** |
| active owner count | **1** |

### I. Локально включить Supabase Auth provider

В **вашем** локальном `.env.local` (вручную, этот PR файл не меняет):

```env
SPIORA_AUTH_PROVIDER=supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Не включать `SPIORA_AUTH_PROVIDER=supabase` на Vercel на этом этапе.

### J. Проверить login owner / manager

1. Restart `npm run dev`.
2. Login `olivia@spiora.demo` → `/dashboard`, доступ к Settings/Analytics.
3. Logout.
4. Login `daniel@spiora.demo` (или emma/lucas) → `/dashboard`, **нет** доступа к `/settings` и `/analytics`.

### K. Негативные сценарии

| Сценарий | Как проверить | Ожидание |
|---|---|---|
| Logout | Sign out | redirect `/login`, protected routes закрыты |
| Expired session | дождаться expiry / сбросить cookies | redirect `/login` или 401 на API |
| Suspended profile | `update user_profiles set status='suspended' where email='...'` | login отказ / нет session |
| Missing profile | Auth user без строки в `user_profiles` | login отказ, без silent legacy fallback |
| Restore suspended | `status='active'` | login снова работает |

После негативных тестов вернуть demo profiles в `active`.

### L. Rollback на legacy (только local)

```env
SPIORA_AUTH_PROVIDER=legacy
```

Перезапустить dev-сервер.  
Production/Vercel **не** откатывать на legacy passwords из кода.

Таблицы `user_profiles` / `auth_login_rate_limits` можно оставить — они не мешают legacy path.

---

## Ожидаемые counts (кратко)

| Этап | auth.users (demo emails) | user_profiles | active owners |
|---|---|---|---|
| После PATCH_024 | 0 (или уже существующие чужие) | 0 | 0 |
| После 4 Auth users | ≥4 demo | 0 | 0 |
| После seed | ≥4 demo | **4** | **1** |

---

## Safety notes

- PATCH_024: нет `DROP`, `TRUNCATE`, `DELETE`, `GRANT PUBLIC`, RLS enable, вставки в `auth.users`.
- Seed template в Git: только placeholders.
- Локальный seed с UUID — вне commit.
