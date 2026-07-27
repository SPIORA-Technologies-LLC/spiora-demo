# SPIORA Finance Cutover Checklist — 036 (PR #33.1)

## Scope
Finance module PostgreSQL runtime: contracts, payments, dashboard KPIs, analytics. EUR cents only.

## Do NOT
- commit / push / deploy / apply migration without explicit approval
- hard-delete payments
- float money storage
- set `FINANCE_STORE_MODE=demo` in production
- silent fallback to `.data/finance-store.json` / `app_state` in production

## Runtime selection
| Environment | Store |
|---|---|
| production | Supabase only (fail-closed) |
| staging | Supabase only |
| development | Supabase by default; `FINANCE_STORE_MODE=demo` for local demo |
| tests | Demo/in-memory via `FINANCE_STORE_MODE=demo` |

## Pre-apply
1. Run `SPIORA_FINANCE_PREFLIGHT_036.sql` → `READY_TO_APPLY` or `ALREADY_APPLIED`.
2. Confirm `clients.id` uuid PK + `external_id`, `user_profiles` role check, RLS helpers (025).
3. Backup staging DB.

## Apply
1. Apply `SPIORA_SUPABASE_PATCH_036_FINANCE.sql` (must match `supabase/migrations/036_finance.sql`).
2. Run `SPIORA_FINANCE_VALIDATE_036.sql` → `VALIDATED_OK`.

## PostgreSQL smoke
```bash
# Requires Supabase URL + service role; refuses demo mode
node scripts/finance-staging-cutover.mjs smoke
```

Covered: contract + history atomicity, payment idempotency, version conflict, void, summary/analytics RPCs, role denial at app layer. JWT/RLS denial for manager/consultant/anonymous should be verified manually in Supabase Auth when available.

## Idempotency semantics
Unique active payment per `(finance_profile_id, idempotency_key)` where `idempotency_key is not null and voided_at is null`. Replay returns the existing payment id (no second row).

## Rollback
Only pre-production. Refuse if finance rows or `finance_manager` users exist. Does not alter CRM clients. Role is CHECK constraint (not enum).

## Notes
- App client key remains CRM `external_id`; DB FK is `clients.id` (uuid).
- Mutation RPCs are `SECURITY DEFINER` + `service_role` only; actor id comes from trusted Next.js session (legacy JWT has no `auth.uid()`).
- RLS policies protect authenticated JWT path; service role is not a security proof.

## Technical debt — RPC actor identity (accepted for #33.1)

**Status:** temporary / non-blocking for demo + staging cutover.

**Current:** mutation RPCs accept `p_actor_id` / `p_actor_name` from the Next.js server after `getSession` + `canManageFinance`. EXECUTE is granted to `service_role` only. Browser/anon cannot call these RPCs directly with a spoofed actor.

**Why not `auth.uid()` yet:** employee sessions still use legacy JWT / demo users that are not always mapped to Supabase Auth `auth.uid()` → `user_profiles`. Forcing `auth.uid()` inside RPC would break Finance writes until Auth cutover is complete.

**Target end-state:**
1. App authenticates the user.
2. Server derives identity (no client-supplied actor).
3. RPC resolves actor via `auth.uid()` / `current_spiora_*` helpers and ignores request-body actor fields.
4. Optionally drop `p_actor_id` parameters once every finance staff session is Auth-backed.

**Plan:** schedule after Spiora Auth employee session ↔ `auth.uid()` mapping is production-complete. Until then app-layer RBAC remains mandatory and is not optional.

## Follow-up — PR #33.2 Finance Query Optimization (non-blocking)

Do **not** block #33 / #33.1 release on this.

Today `listClients` loads CRM + finance rows then filters/sorts/paginates in the Node store. Fine for demo/staging scale; becomes a bottleneck at thousands of clients.

**#33.2 should deliver:**
- KPI remain SQL-only (already via `spiora_finance_dashboard_summary`).
- Client finance table assembled by one SQL/RPC.
- Search, direction, paymentStatus, sort, and `LIMIT`/`OFFSET` executed in PostgreSQL.
- Server must not materialize the full client list before filtering.
