# SPIORA — RLS Phase 1 Policy Matrix

**PR #18.** Источник идентичности: `auth.uid()` → `user_profiles.auth_user_id` → `role` / `status`.  
Активный пользователь: `status = 'active'` AND `archived_at is null`.

## Helper functions

| Функция | Возврат | Примечания |
| --- | --- | --- |
| `current_spiora_profile_id()` | `uuid` / null | только активный профиль; без email |
| `current_spiora_role()` | `text` / null | owner\|manager\|… |
| `is_active_spiora_user()` | boolean | anon → false |
| `is_spiora_owner()` | boolean | active owner |
| `is_spiora_manager()` | boolean | active manager |
| `spiora_rls_phase1_status()` | `enabled\|disabled\|warning` | для health |

Все: `STABLE`, `SECURITY DEFINER`, `search_path = public`.

## user_profiles

| Операция | Owner | Manager | Consultant/Viewer | Anon / suspended / archived |
| --- | --- | --- | --- | --- |
| SELECT self | ✔ | ✔ | ✔ (свой, если active) | ✗ |
| SELECT all / team | ✔ все | ✔ active\|invited, не archived | только self | ✗ |
| UPDATE safe fields (`language`, `timezone`, `avatar_url` + guard) | ✔ | ✔ self | ✔ self | ✗ |
| UPDATE role/status/auth_user_id/email/archived_at | ✔ (+ last-owner guard) | ✗ | ✗ | ✗ |
| INSERT / DELETE | ✗ через authenticated (service_role only) | ✗ | ✗ | ✗ |

## clients

| Операция | Owner | Manager | Consultant/Viewer |
| --- | --- | --- | --- |
| SELECT | ✔ | ✔ | ✗ Phase 1 (assigned model ненадёжна) |
| INSERT | ✔ | ✔ (`archived_at is null`) | ✗ |
| UPDATE | ✔ | ✔ только если `archived_at is null` (нельзя archive) | ✗ |
| Hard DELETE | ✗ (trigger + нет DELETE grant) | ✗ | ✗ |
| Archive (UPDATE archived_at) | ✔ | ✗ | ✗ |

**Не используется:** `assigned_manager_name`, legacy text assignee как security boundary.

## client_notes

Граница: `client_notes.client_uuid` → `clients.id` (EXISTS под RLS clients).  
**Не используется:** legacy `client_id` TEXT.

| Операция | Owner | Manager |
| --- | --- | --- |
| SELECT | ✔ если видит client | ✔ |
| INSERT | ✔ | ✔ |
| UPDATE / archive | ✔ | ✔ (как runtime RBAC) |
| Hard DELETE | ✗ | ✗ |

## client_documents

Граница: `client_documents.client_uuid` → `clients.id`.  
Binary Storage policies **вне** этого PR.  
API по-прежнему не должен отдавать internals (`storage_path`) в публичный DTO — app-level.

| Операция | Owner | Manager |
| --- | --- | --- |
| SELECT metadata | ✔ | ✔ |
| INSERT | ✔ | ✔ |
| UPDATE metadata | ✔ | ✔ при `archived_at is null` |
| Archive | ✔ | ✗ |
| Hard DELETE | ✗ | ✗ |

## Соответствие runtime RBAC

| Capability | App (`permissions.ts`) | RLS Phase 1 |
| --- | --- | --- |
| Archive client | owner | owner |
| Archive note | owner\|manager | owner\|manager |
| Archive document | owner | owner |
| Consultant CRM | нет сессии | deny |
