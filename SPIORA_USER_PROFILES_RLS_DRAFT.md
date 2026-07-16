# SPIORA — user_profiles RLS Draft

**Статус:** draft only. Не применять в PR #17.

## Цели

- пользователь читает свой профиль;
- owner читает и управляет всеми;
- manager видит ограниченный список;
- никто не меняет свою роль напрямую;
- последний owner защищён (app-level + policy defense).

## Предпосылки

- `auth.uid()` = `user_profiles.auth_user_id`
- helper-функции (будущие):

```sql
-- draft
create or replace function public.current_user_profile()
returns user_profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from user_profiles
  where auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.current_user_profile();
$$;
```

## Policies (draft)

```sql
alter table user_profiles enable row level security;

-- SELECT: self
create policy user_profiles_select_self
on user_profiles for select
using (auth_user_id = auth.uid());

-- SELECT: owner sees all
create policy user_profiles_select_owner
on user_profiles for select
using (public.current_user_role() = 'owner');

-- SELECT: manager sees limited active team (no suspended secrets beyond basic)
create policy user_profiles_select_manager
on user_profiles for select
using (
  public.current_user_role() = 'manager'
  and status in ('active', 'invited')
  and archived_at is null
);

-- UPDATE self: profile fields only (no role/status)
-- Enforce via trigger or restricted column grants in a later PR.
create policy user_profiles_update_self_safe
on user_profiles for update
using (auth_user_id = auth.uid())
with check (
  auth_user_id = auth.uid()
  and role = (select role from user_profiles where auth_user_id = auth.uid())
  and status = (select status from user_profiles where auth_user_id = auth.uid())
);

-- UPDATE/INSERT/DELETE management: owner only
create policy user_profiles_owner_write
on user_profiles for all
using (public.current_user_role() = 'owner')
with check (public.current_user_role() = 'owner');
```

## Last owner protection (app + DB)

App already returns `last_owner_protected` in suspend/archive.

Future trigger draft:

```sql
-- prevent archiving/suspending the last active owner
```

## Важно для текущего runtime

Сейчас сервер работает через **service role**, поэтому RLS сам по себе не защитит API, пока admin client обходит policies.

RLS станет эффективным после:

1. user-scoped Supabase client для части reads;
2. сокращения service-role поверхности;
3. включения policies на `user_profiles` и доменных таблицах.
