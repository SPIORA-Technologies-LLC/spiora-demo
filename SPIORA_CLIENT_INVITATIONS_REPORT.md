# Spiora Client Invitations — Implementation Report (PR #30)

**Date:** 21 July 2026  
**Status:** Implemented locally. Migration **not applied**. No commit / push / deploy.

## Migration number

**029 is taken** by Knowledge Base media. This PR uses **032**:

- `supabase/migrations/032_spiora_client_invitations.sql`
- `SPIORA_SUPABASE_PATCH_032_CLIENT_INVITATIONS.sql`
- `SPIORA_SUPABASE_PATCH_032_CLIENT_INVITATIONS_ROLLBACK.sql`

## What shipped

| Area | Detail |
|------|--------|
| Tables | `client_invitations`, `client_portal_users` |
| Token | 32-byte CSPRNG, base64url, SHA-256 hash at rest |
| Employee API | `GET/POST /api/client-invitations`, `POST …/[id]/revoke` |
| Public/client API | invite preview, accept, session, logout |
| Employee UI | Clients page → “Invite client” modal + invitations table |
| Client UI | `/client/invite/[token]`, `/client/login`, `/client` shell |
| Auth | Separate `ClientSession` via `client_portal_users`; employee `getSession()` unchanged |
| Local fallback | `.data/client-invitations.json` + `.data/client-portal-users.json` when Supabase admin not configured |
| i18n | `clientInvitations.*`, `clientPortal.*` (EN/RU) |

## Auth separation (critical)

1. Employee session = `user_profiles` + `isUserRole` (`owner`/`manager` only).  
2. Client portal session = Supabase Auth user **and** row in `client_portal_users`.  
3. Middleware: employee session **cannot** enter `/client` shell (redirect `/dashboard`).  
4. Client Auth without `user_profiles` → `resolveSessionFromAuthUserId` returns **null** → employee routes redirect to `/login`.  
5. `(app)/layout` still requires `getSession()` only.  
6. `client/(portal)/layout` requires `getClientSession()` only.

Clients are **not** added to `user_profiles.role`. Portal identity is a separate table.

## Invitation state

Computed (not stored): `pending` | `accepted` | `expired` | `revoked`.

**Revoke policy:** allowed for pending and expired (sets `revoked_at`). Rejected for accepted (`ALREADY_ACCEPTED`). Idempotent if already revoked.

## Idempotency

Optional `requestId` / `Idempotency-Key`: same creator + request id returns existing invitation **without** a new plaintext URL (cannot reconstruct token from hash).

## Future tenant extension

No `organization_id` in Phase 1 (single-tenant demo). Add nullable/not-null `organization_id` when orgs land.

## Assignee picker

- `GET /api/client-invitations/assignees` — active owner/manager list
- Create invitation **requires** `assignedTo`
- Modal fields: email → assignee → service → questionnaire language → expiry
- Values are stored on `client_invitations` for future case creation (PR #34+)

## Demo email confirmation skip

When **`SPIORA_DEMO_MODE=true`** and Supabase is configured:

- `GET /api/client/auth/config` → `{ skipEmailConfirmation: true }`
- Registration uses `POST /api/client/auth/demo-register` (service role, `email_confirm: true`)
- Client then signs in normally — no mailbox step during demos

**Production:** leave `SPIORA_DEMO_MODE` unset/false — standard Supabase email confirmation applies.


Questionnaire, documents, CRM card creation, notifications, email send, resend mail, subdomain.

## Dependency impact

**None.** No new npm packages.
