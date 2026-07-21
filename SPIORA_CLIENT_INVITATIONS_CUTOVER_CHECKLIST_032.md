# Client Invitations — Cutover checklist 032

Do **not** auto-apply. Apply manually on staging Supabase, then run automated smoke.

## Prerequisites

- Patch **025** (RLS helpers) already applied
- `SPIORA_ENABLE_SUPABASE=true` and staging `.env.local` points to demo project ref in `SPIORA_ALLOWED_SUPABASE_PROJECT_REFS`
- Node TLS on Windows: `$env:NODE_OPTIONS='--use-system-ca'`

## Steps

1. Backup (Free plan: keep rollback SQL ready)
2. Run `SPIORA_SUPABASE_PATCH_032_CLIENT_INVITATIONS.sql` in Supabase SQL Editor
3. Verify query results at end of patch:
   - 2 tables: `client_invitations`, `client_portal_users`
   - columns include `assigned_to`, `service_type`, `preferred_locale`, `token_hash`
4. Re-run patch once — must be idempotent (no errors)
5. Automated smoke (framework-agnostic modules only; no Next.js `server-only` imports):

```powershell
$env:NODE_OPTIONS='--use-system-ca'
node --experimental-strip-types --experimental-specifier-resolution=node --import ./scripts/test-register.mjs scripts/client-invitations-staging-cutover.mjs smoke
```

Smoke covers:

- create invitation with required assignee
- reject arbitrary assignee UUID
- persist `assigned_to`, `service_type`, `preferred_locale`
- `SPIORA_DEMO_MODE=false` → no skip-email config; `demo-register` → 403
- `SPIORA_DEMO_MODE=true` → skip-email config; `demo-register` → `{ ok: true }` only

6. Push commit `61455db` after smoke passes
7. Deploy — separate confirmed step

## DDL automation (optional)

If `SUPABASE_DB_URL` or `SUPABASE_ACCESS_TOKEN` is in `.env.local`:

```powershell
$env:NODE_OPTIONS='--use-system-ca'
node --experimental-strip-types --experimental-specifier-resolution=node scripts/client-invitations-staging-cutover.mjs all
```

## Rollback

`SPIORA_SUPABASE_PATCH_032_CLIENT_INVITATIONS_ROLLBACK.sql` — only when no production portal users depend on the tables.
