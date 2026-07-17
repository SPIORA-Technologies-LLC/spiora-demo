# SPIORA — RLS Phase 1 Runtime Runbook

**PR #18.** Migration **не применять** без отдельного подтверждения.

## Перед apply

1. Убедиться, что Auth Phase 1 (024) и профили уже на demo.
2. Выполнить **только** read-only preflight из `SPIORA_SUPABASE_PATCH_025_RLS_PHASE1.sql` (PART 0).
3. Ожидания preflight:
   - active profiles = 4;
   - active owners = 1;
   - clients = 25 (demo);
   - orphan notes = 0;
   - orphan documents = 0;
   - `client_uuid` заполнен;
   - нет profiles без `auth_user_id`.
4. При любом нарушении → **NOT SAFE TO APPLY**. Остановиться.

## Apply (только после подтверждения)

1. Backup / snapshot проекта Supabase (Dashboard).
2. В SQL Editor выполнить PART A из patch (или migration `025_rls_phase1.sql`).
3. Выполнить PART B verification.
4. Ожидание: `spiora_rls_phase1_status()` = `enabled`.

## После apply — health

Owner: `GET /api/system/health`

Ожидание (безопасно, без имён policies):

```json
{
  "rls": "enabled",
  "rlsPhase": "phase1"
}
```

Пока migration не применена: `"rls": "disabled"`.

## Runtime checks (impersonation / browser)

### Anonymous

- Data API SELECT без session → denied / empty.

### Olivia (owner)

- список профилей (если UI/API появится) / self profile;
- clients read/create/update/archive;
- notes CRUD;
- documents create/update/archive.

### Daniel (manager)

- clients read/create/update;
- notes CRUD по matrix;
- documents read/create/update;
- document archive → denied (app + RLS);
- client archive → denied;
- изменение role/status своего/чужого профиля → denied.

### Suspended user

- любой data access через authenticated client → denied.

### Direct API abuse

- чужой note/document ID без доступа к client;
- UPDATE role;
- hard DELETE;
- подмена `client_uuid` на INSERT.

## App regression (service_role path)

Пока Variant B: CRM через service_role должен продолжать работать после apply.

Проверить:

- login Supabase;
- CRM list/detail;
- notes / documents;
- Dashboard KPI;
- owner/manager RBAC;
- Google off.

## Rollback

Только при блокирующей регрессии:

1. Файл: `SPIORA_SUPABASE_PATCH_025_RLS_ROLLBACK.sql`
2. Не удаляет данные / Auth users / profiles tables.
3. Не запускать автоматически.

## SQL impersonation (после apply)

В SQL Editor (только на demo, с тестовыми JWT claims — если доступен `request.jwt.claim.sub`):

```sql
-- Пример каркаса (подставить auth_user_id менеджера; не коммитить реальные UUID в git):
-- select set_config('request.jwt.claim.sub', '<AUTH_USER_ID>', true);
-- select set_config('request.jwt.claim.role', 'authenticated', true);

select public.is_spiora_manager();
select count(*) from public.clients;
-- manager: > 0

-- archive document as manager should fail under RLS:
-- update public.client_documents set archived_at = now() where id = '<DOC_UUID>';
```

Практичнее проверять через браузер + PostgREST с user access token (см. validation checklist).

## Запрещено в этом PR-цикле без новой команды

- auto-apply;
- Vercel enable Auth;
- deploy;
- commit/push (если не запрошено отдельно).
