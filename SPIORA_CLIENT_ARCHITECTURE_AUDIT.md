# Spiora Client — Architecture Audit (PR #29)

**Date:** 21 July 2026  
**Status:** Audit only. No code, migrations, dependencies, commits, pushes, or deploys.  
**Scope:** Design Spiora Client inside the existing Next.js + Supabase app. Emigrant Croatia Desk is a visual/functional reference only — do not copy its code.

---

## Verdicts (summary)

| Decision | Verdict |
|----------|---------|
| Implement PR #30 — Client Invitations | **SAFE TO IMPLEMENT** (with constraints below) |
| Add `client` role | **SAFE TO ADD** (with strict session/route separation) |
| Reuse existing `clients` tables as portal identity | **NOT SAFE TO REUSE AS-IS** — **SAFE TO LINK/EXTEND** |
| Reuse existing Storage patterns | **SAFE TO REUSE PATTERNS** — new private bucket required |

See §20 and companion docs for detail.

---

## 1. Current architecture

### 1.1 Next.js routing

| Area | Reality |
|------|---------|
| Employee shell | `src/app/(app)/…` — **no `/app` URL prefix**. Routes are `/dashboard`, `/clients`, `/crm/leads`, etc. |
| Auth | `/login` |
| Guest (non-CRM) | `/join/[token]` — video meeting guests only |
| Client portal | **Does not exist** |
| APIs | `src/app/api/…` — **outside** middleware matcher; each handler must call `getSession()` |

Route group `(app)` is layout-only. Renaming all employee URLs to `/app/…` is optional and **out of Phase 1** (high churn). Preferred Phase 1:

| Portal | Path |
|--------|------|
| Employee (unchanged) | `/clients`, `/crm/…`, `/dashboard`, … |
| Client portal | `/client/…` |
| Invite accept | `/client/invite/[token]` |

### 1.2 Dashboard / nav

Employee nav and path ACL live in `src/lib/auth/permissions.ts` + `middleware.ts` (`PROTECTED_PREFIXES`).  
Relevant CRM surfaces:

| Route | Purpose |
|-------|---------|
| `/clients`, `/clients/[id]` | Postgres CRM list + detail |
| `/crm/leads`, `/crm/leads/[id]` | Formgrid Lead Review queue |
| `/new-formgrid-clients` | Raw Formgrid sheet table |

### 1.3 Roles today

| Layer | Values |
|-------|--------|
| DB `user_profiles.role` | `owner` \| `manager` \| `consultant` \| `viewer` |
| Runtime `SessionUser.role` | **`owner` \| `manager` only** |
| Planned but not login-ready | `consultant`, `viewer` → `profileToSessionUser` returns `null` |
| Spiora `client` role | **Absent** (Desk external project only) |

### 1.4 Auth

- Dual provider: legacy JWT cookie **or** Supabase Auth (`SPIORA_AUTH_PROVIDER`).
- Browser / middleware / server-auth use **anon** key; data repos use **service role** (`getSupabaseAdmin()`).
- **RLS is defense-in-depth**; the app currently **bypasses RLS** via service role.
- Status gate: only `active` sessions pass `isSessionAccessAllowed`.

### 1.5 Profiles / memberships / tenant

| Concept | Status |
|---------|--------|
| `user_profiles` | Exists (`024`) |
| `organizations` / memberships | **Missing** |
| Session `organization_id` / `tenant_id` | **Missing** |
| Calendar `company_id` | Hardcoded `"northstar-mobility"` |

**Conclusion:** single-tenant demo. Phase 1 should add `organization_id` columns with a **demo default constant**, not block on full multi-tenant SaaS.

### 1.6 Clients / leads / questionnaire intake

Four parallel contours (confirmed by CLE design doc):

1. **Postgres CRM** — `clients`, `client_notes`, `client_documents`
2. **Formgrid** — Google Sheets + `/new-formgrid-clients` + notifications watcher
3. **Lead Review** — `app_state.formgrid_lead_reviews` (+ local `.data` fallback)
4. **Emigrant Desk** — external Supabase `profiles`/`cases` (optional env gate)

There is **no** Spiora-hosted questionnaire engine, invitation-to-register flow, or authenticated client UI.

### 1.7 Status / documents / Storage

- Client status: free-text on `clients.status` + `pipeline_stage` (no Postgres enum).
- `client_documents`: **metadata only**; UI says upload comes after Storage setup.
- Private buckets exist for tasks, chat, meetings, KB — **not** for client CRM files.
- Gold-standard binary pattern: KB attachments (magic sniff, private bucket, auth proxy + Range).

### 1.8 Notifications / activity / i18n / guards

| Concern | Status |
|---------|--------|
| Notifications | `notifications` table + emit + bell UI; types include `client_new` |
| Generic activity log | **Missing** (closest: `calendar_meeting_audit`) |
| EN/RU | next-intl cookie locales; no URL prefix |
| Middleware | Pages only; public: `/login`, `/join`, webhooks |
| KB revision / 409 | Tables use `expectedRevision` → conflict UX — **reuse for questionnaire** |

### 1.9 Demo / seed

- `supabase/seeds/clients-demo.sql`, `SPIORA_DEMO_SEED.sql` — staff CRM demos.
- No portal seed / guided invite scenario yet (PR #37).

---

## 2. Reuse vs build from scratch

### Reuse as-is (or with thin wrappers)

| Asset | Use for Client portal |
|-------|------------------------|
| Supabase Auth + `user_profiles` lookup | Auth backbone; extend role carefully |
| `getSession()` / middleware / permissions patterns | Mirror as `getClientSession()` + `/client` ACL |
| Postgres `clients` | **Staff CRM record** created/linked on submit |
| `client_notes` | Map to **internal notes** (employee-only) |
| `client_documents` columns / soft-archive | Extend for portal binaries + visibility |
| KB `attachment-storage` + MIME sniff + download proxy | Clone for `client-documents` bucket |
| KB tables revision / 409 | Questionnaire autosave concurrency |
| Notifications emit + UI | New event types |
| `ClientsList` / detail layout / `StatusBadge` / Card | CRM “New clients” UI |
| i18n cookie + dictionaries | `clientPortal.*` namespaces |
| Meeting invite **UX idea** only | Create link → copy → accept — **not** plaintext token storage |
| CLE / UCI design docs | Status vocabulary guidance |

### Needs extension

| Asset | Extension |
|-------|-----------|
| `user_profiles.role` CHECK | Add `client` **or** keep clients out of employee session mapping |
| Middleware `PUBLIC_PATHS` / ACL | `/client/invite/*` public; `/client/*` client-only |
| `notifications.type` | Invitation / questionnaire / document events |
| `client_documents` | visibility, review_status, uploader_role, Storage wiring |
| `clients` | Link fields: `portal_user_id`, `invitation_id`, `submitted_at`, source=`portal_invite` |
| RLS helpers | `is_spiora_client()`, case ownership predicates |

### Build from scratch

| Asset | Why |
|-------|-----|
| `/client/…` routes + shell | No portal exists |
| `client_invitations` (+ token_hash) | Meeting invites store **plaintext** token — do not copy |
| `questionnaire_templates` / versions / `client_questionnaires` | No engine |
| `client_cases` (or case columns) | Desk cases are external; Spiora has no case table |
| `client_document_requirements` / requests | Missing |
| `client_activity` (or case status history) | No generic audit |
| Idempotent submit transaction API | Missing |
| Client-facing questionnaire UX | Missing |

### Must not copy / must not conflate

| Source | Risk |
|--------|------|
| Emigrant Desk code | Explicitly out of scope; different project/schema |
| Formgrid as the only intake | Keep as **parallel** channel; portal invites are intentional |
| Meeting `calendar_meeting_guest_invites.token` | Stores raw token — Client invites must store **hash only** |
| Treating CRM `clients` row as Auth identity | Clients are not app users today |

---

## 3. Target architecture (Phase 1)

### 3.1 Same app, same database

Spiora Client is a **route partition** of the existing Next.js app, same Supabase project/Postgres.

```text
Employee UI  ──►  /clients, /crm/…, APIs under /api/clients*, /api/client-invitations*
Client UI    ──►  /client/…, APIs under /api/client/*
Shared DB    ──►  Postgres + private Storage buckets
```

### 3.2 Hosting alternatives

| Option | Pros | Cons | Phase 1 |
|--------|------|------|---------|
| **Path:** `demo.spiora.app/client/…` | Zero infra; shared cookies/auth carefully scoped; simplest | Cookie/session must not leak employee nav | **Choose** |
| Subpath rewrite only | Same | Same | Same as above |
| `client.demo.spiora.app` | Harder cookie confusion | DNS, CORS, cookie domain, deploy complexity | Later |
| Separate Next.js project | Isolation | Two deploys, duplicated auth/i18n | Reject for Phase 1 |
| Separate database | Isolation | Sync hell | Reject |

**Decision:** path-based `/client/…` on the same deployment.

### 3.3 Preferred routes

```text
/client/invite/[token]     accept invitation (anonymous → register/sign-in)
/client                    home / redirect by state
/client/questionnaire      fill / review / submit
/client/documents          own documents + staff-shared
/client/status             case status timeline
/client/profile            own profile
```

Employee “New clients from portal” can live at:

```text
/clients?source=portal_invite   or   /crm/new-clients
```

Prefer integrating into `/clients` with filters + badge rather than a third parallel list (Formgrid + Lead Review already duplicate intake UX).

### 3.4 Auth model

```text
auth.users
    │
    ├─► user_profiles (role includes client) ──► ClientSession (portal only)
    │
    └─► user_profiles (owner|manager|…) ──► SessionUser (employee only)
```

**Hard rules:**

1. `profileToSessionUser` must **not** return an employee `SessionUser` for `role=client`.
2. New `getClientSession()` for portal APIs/layouts.
3. Middleware: client cannot access `PROTECTED_PREFIXES`; employee cannot access `/client/*` except maybe impersonation (out of MVP).
4. Anonymous: only `GET` invite preview + accept endpoints for valid tokens.

### 3.5 Data spine (conceptual)

```text
client_invitations
        │ accept
        ▼
client_profiles ──user_id──► auth.users / user_profiles
        │
        ▼
client_cases ──optional link──► clients (CRM row)
        │
        ├─► client_questionnaires (answers + revision + template_version_id)
        ├─► client_documents (Storage)
        ├─► client_status_events / client_activity
        └─► client_notes (employee-only; can reuse table with visibility flag or keep staff notes on CRM client)
```

Detail: `SPIORA_CLIENT_DATA_MODEL_PROPOSAL.md`.

---

## 4. Role & access model

### Employee (owner, manager; later consultant with assignment)

| Capability | Allowed |
|------------|---------|
| Create / revoke / list invitations | Yes (owner/manager Phase 1) |
| See new portal clients | Yes |
| Read questionnaire / documents | Yes (org-scoped) |
| Upload docs; set visibility | Yes |
| Change status; assign employee | Yes |
| Internal notes | Yes |
| Viewer | Read-only later; Phase 1 may keep viewer offline |

### Client

| Capability | Allowed |
|------------|---------|
| Own profile / case / questionnaire / allowed docs | Yes |
| Other clients / employees / staff notes / staff_only docs | **No** |
| Change status / assignment | **No** |

### Anonymous

| Capability | Allowed |
|------------|---------|
| Open valid invite page | Yes |
| Enumerate tokens / read cases | **No** |

---

## 5–12. Lifecycles (overview)

Full schemas and APIs: companion docs. Short form:

### Invitation

Employee creates invite → store **token_hash** + metadata → copy URL with raw token once → client opens → register/sign-in with email binding → single accept (idempotent) → profile + case + draft questionnaire.

### Questionnaire

Versioned templates → client answers jsonb + revision → autosave → review → submit locks answers.

### Documents

Private bucket → metadata in Postgres → proxy download → visibility `staff_only` | `client_and_staff` → review states.

### Submit transaction

Server-side idempotent: validate → lock questionnaire → activate case → status event → activity → notify employees → return success. Replay safe.

### CRM “New clients”

On submit, upsert/link `clients` row (`source=portal_invite`) and surface in list with unread indicator.

### Employee → client files

Upload with explicit visibility; client notified when `client_and_staff`.

---

## 13. Notifications

Extend existing `notifications` + emit helpers. Phase 1 = in-app only.

| To employee | To client |
|-------------|-----------|
| Invite accepted | Status changed |
| Questionnaire started / submitted | Doc accepted / rejected / replacement requested |
| Client uploaded / replaced doc | Employee uploaded shared doc; new request |

---

## 14. RLS & isolation

Phase 1 reality: APIs still use service role — **authorization must be enforced in handlers**, same as today. Still:

1. Add RLS policies for all new tables (defense in depth).
2. Prefer gradual move of portal reads to user-scoped client where feasible.
3. Every row: `organization_id` (demo default).
4. Client policies: `user_id = auth.uid()` / case ownership.
5. Never grant clients SELECT on employee notes or `staff_only` documents.

---

## 15–16. Threat model & API

See `SPIORA_CLIENT_THREAT_MODEL.md` and API section in `SPIORA_CLIENT_DATA_MODEL_PROPOSAL.md` / roadmap.

---

## 17. Reuse audit table

| Existing | Reuse | Extend | Replace | Reason |
|----------|-------|--------|---------|--------|
| `clients` | Partial | Yes | No | Staff CRM; link from portal case on submit |
| Formgrid / Lead Review | Keep parallel | No for portal | No | Different intake channel |
| Desk `profiles`/`cases` | Reference only | No | No | External; do not copy |
| `client_documents` | Yes (metadata spine) | Yes (binary + visibility) | No | Already FK’d to clients |
| `client_notes` | Yes as internal notes | Yes (ensure client never reads) | No | Soft-archive pattern OK |
| Status free-text | — | Normalize portal statuses | Don’t break CRM strings overnight | Dual display mapping |
| Task attachments Storage | Pattern | — | — | Weaker MIME than KB |
| KB attachment Storage + sniff | **Yes** | Clone bucket | — | Best binary pattern |
| Meeting guest invites | UX only | — | Don’t reuse table | Plaintext token |
| Notifications | Yes | New types | No | Existing bell |
| Activity / audit | Pattern from meeting audit | New `client_activity` | — | No generic log |
| KB table revision/409 | Yes | For questionnaire | — | Proven UX |
| Localization | Yes | New keys | No | Cookie locales |
| Dashboard tables / modals | Yes | — | No shared Modal yet | Copy Tasks/Calendar pattern |
| Auto Draft (KB) | Optional later | — | No for Phase 1 | Out of MVP AI |
| Demo seeds | Extend in PR #37 | — | No | Need portal scenario |

---

## 18–19. Phases & non-goals

See `SPIORA_CLIENT_IMPLEMENTATION_ROADMAP.md`.

**Out of MVP:** native apps, Drive sync, OCR, e-sign, realtime chat/video in portal, drag-drop form builder, collaborative editing, AI doc analysis, XLSX, external CRM sync.

---

## 20. Final verdicts

### SAFE / NOT SAFE TO IMPLEMENT PR #30 — CLIENT INVITATIONS

**SAFE TO IMPLEMENT**, provided PR #30:

1. Adds `client_invitations` with **token_hash only** (never store raw token).
2. Adds `client` role **or** equivalent auth linkage **without** granting employee `SessionUser`.
3. Uses path `/client/invite/[token]` + middleware public allowlist.
4. Does **not** invent multi-tenant orgs yet (demo `organization_id` constant OK).
5. Does **not** write Formgrid; creates invitation + empty portal shell only.
6. Keeps service-role usage behind server handlers with explicit authz checks.
7. Does not copy Emigrant Desk or meeting-guest token schema.

### SAFE / NOT SAFE TO ADD CLIENT ROLE

**SAFE TO ADD** if:

- DB CHECK extended to include `client`.
- Runtime splits `SessionUser` (employees) vs `ClientSession`.
- Middleware and API guards deny cross-area access.
- Consultant/viewer work remains independent (don’t block on them).

Alternative also safe: **no** `user_profiles.role=client`, only `client_profiles.user_id` → `auth.users`, with portal session derived from Auth + profile join. Prefer **explicit `client` role** for RLS helper clarity (`is_spiora_client()`).

### SAFE / NOT SAFE TO REUSE EXISTING CLIENT TABLES

**NOT SAFE** to treat `clients` as portal user profile or case store alone.  
**SAFE TO LINK/EXTEND:** on submit, create/update `clients` with `source=portal_invite` and FK from `client_cases` / `client_profiles`.

### SAFE / NOT SAFE TO REUSE EXISTING STORAGE PATTERNS

**SAFE TO REUSE PATTERNS** from Knowledge Base (private bucket, magic-byte validation, auth proxy download, soft archive).  
**NOT SAFE** to put portal files in KB or task buckets. **NOT SAFE** to rely on current `client_documents` without a new bucket and upload routes.

---

## Blockers & open questions

| # | Question | Recommendation for Phase 1 |
|---|----------|----------------------------|
| 1 | Rename employee routes to `/app/…`? | **No** — keep current URLs |
| 2 | Create `organizations` table now? | **Stub constant** + columns; table optional |
| 3 | One case per client or many? | **One active case per invitation**; multi-case later |
| 4 | Merge Formgrid submits into same “New clients”? | **Separate filters**; unify UX later |
| 5 | Email must match invite? | **Yes** — bind on accept |
| 6 | Can existing CRM client receive invite? | Phase 1: create new portal profile; dedupe by email/passport on submit |
| 7 | Viewer/consultant on invitations? | Phase 1: owner/manager only |
| 8 | Service role vs user-scoped client for portal? | Handlers + service role OK if authz strict; add RLS anyway |

---

## Companion documents

- `SPIORA_CLIENT_DATA_MODEL_PROPOSAL.md`
- `SPIORA_CLIENT_THREAT_MODEL.md`
- `SPIORA_CLIENT_IMPLEMENTATION_ROADMAP.md`

**Audit complete. Stop here — do not implement.**
