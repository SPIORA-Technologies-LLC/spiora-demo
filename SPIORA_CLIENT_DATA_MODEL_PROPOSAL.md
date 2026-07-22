# Spiora Client — Data Model Proposal (PR #29)

**Date:** 21 July 2026  
**Status:** Design only. No migrations applied.  
**Depends on:** `SPIORA_CLIENT_ARCHITECTURE_AUDIT.md`

---

## 1. Principles

1. Same Postgres / Supabase project as Spiora employee app.
2. Prefer **extend + link** over parallel CRM forks.
3. Portal identity ≠ staff CRM row: link them on accept/submit.
4. Store **token_hash**, never raw invitation tokens.
5. Questionnaire answers are immutable after submit relative to a **template version**.
6. Binaries in private Storage; Postgres holds metadata only.
7. Soft-archive (`archived_at`); block hard delete (match KB / RLS Phase 1).
8. Every tenant-facing table gets `organization_id` (Phase 1: demo default UUID/constant).

---

## 2. Existing entities — collision check

| Proposed | Existing | Decision |
|----------|----------|----------|
| `client_profiles` | `clients` (CRM), Desk `profiles` | **New table**. Link to `clients.id` via nullable `crm_client_id`. Do not rename Desk. |
| `client_cases` | Desk `cases`, CRM `status`/`pipeline_stage` | **New table** for portal case lifecycle. Sync status summary onto `clients` on submit. |
| `client_invitations` | `calendar_meeting_guest_invites` | **New table**. Do not extend meeting invites. |
| Questionnaire tables | Formgrid Sheets / Lead Review JSON | **New**. Formgrid remains parallel intake. |
| `client_documents` (portal) | Existing `client_documents` | **Extend existing table** (or add portal columns + keep one table keyed by `client_uuid` / later `case_id`). Avoid two document systems. |
| Internal notes | `client_notes` | **Reuse** with policy: never expose to client role. Optional `visibility` default `staff_only`. |
| Status history | None / CLE design | **New** `client_case_status_events` (+ optional `client_activity`). |

---

## 3. Organization stub (Phase 1)

```text
SPIORA_DEMO_ORGANIZATION_ID = fixed uuid (config/env)
```

Optional later:

```sql
organizations (id, name, slug, created_at)
```

All new tables: `organization_id uuid not null` defaulting to demo id.  
No memberships table in Phase 1 — employees are global within the demo tenant.

---

## 4. Auth / role

### 4.1 Extend `user_profiles.role`

```text
owner | manager | consultant | viewer | client
```

### 4.2 `client_profiles`

```text
client_profiles
- id uuid PK
- organization_id uuid not null
- user_id uuid not null unique          -- auth.users / profiles link
- profile_id uuid null                  -- user_profiles.id (if role=client)
- crm_client_id uuid null               -- clients.id after CRM link
- first_name text not null default ''
- last_name text not null default ''
- email text not null
- phone text null
- preferred_locale text not null default 'en'  -- en|ru
- date_of_birth date null
- citizenship text null
- country_of_residence text null
- created_at timestamptz not null
- updated_at timestamptz not null
- archived_at timestamptz null
```

Unique: `(organization_id, lower(email))` among active rows.

---

## 5. Invitations

```text
client_invitations
- id uuid PK
- organization_id uuid not null
- email text not null                   -- bound email (normalized lower)
- token_hash text not null unique       -- sha256(token) or similar
- questionnaire_template_id uuid not null
- service_type text null
- assigned_to uuid null                 -- user_profiles.id employee
- preferred_locale text not null default 'en'
- expires_at timestamptz not null
- accepted_at timestamptz null
- revoked_at timestamptz null
- accepted_by_user_id uuid null
- created_by uuid not null
- created_at timestamptz not null
- metadata jsonb not null default '{}'  -- optional program labels
```

**Indexes:** hash unique; `(organization_id, email)` active invites; expires_at.

**Token rules:**

- Generate 32+ bytes CSPRNG; show once in URL `/client/invite/{token}`.
- Persist only hash (pepper optional via server secret).
- Accept once: `accepted_at is null and revoked_at is null and now() < expires_at`.
- Idempotent accept: same user + already accepted → return existing case.
- Email mismatch → reject.
- Double-click: DB unique partial index / row lock on accept.

**Do not store PII in URL** beyond the opaque token.

---

## 6. Cases

```text
client_cases
- id uuid PK
- organization_id uuid not null
- client_profile_id uuid not null
- invitation_id uuid null
- crm_client_id uuid null               -- clients.id
- service_type text null
- assigned_to uuid null
- current_status text not null          -- enum-like check
- submitted_at timestamptz null
- created_at timestamptz not null
- updated_at timestamptz not null
- archived_at timestamptz null
```

### Phase 1 status vocabulary (portal)

```text
invited
account_activated
questionnaire_in_progress
questionnaire_submitted
documents_received
under_review
additional_documents_requested
completed
cancelled
```

Map to CRM display strings via i18n (do not force-overwrite legacy CRM free-text overnight).

### Status events

```text
client_case_status_events
- id uuid PK
- organization_id uuid not null
- case_id uuid not null
- from_status text null
- to_status text not null
- actor_user_id uuid null
- actor_role text not null              -- employee|client|system
- note text null
- created_at timestamptz not null
```

### Activity (audit)

```text
client_activity
- id uuid PK
- organization_id uuid not null
- case_id uuid not null
- actor_user_id uuid null
- actor_role text not null
- action text not null                  -- invitation_accepted, questionnaire_patched, ...
- entity_type text null
- entity_id uuid null
- payload jsonb not null default '{}'   -- from/to, no secrets
- created_at timestamptz not null
```

---

## 7. Questionnaire engine

```text
questionnaire_templates
- id uuid PK
- organization_id uuid not null
- name text not null
- status text not null                  -- draft|published|archived
- created_at timestamptz not null
- updated_at timestamptz not null

questionnaire_template_versions
- id uuid PK
- template_id uuid not null
- version int not null                  -- monotonic per template
- schema jsonb not null                 -- sections, fields, i18n labels, rules
- published_at timestamptz null
- created_at timestamptz not null
- unique (template_id, version)

client_questionnaires
- id uuid PK
- organization_id uuid not null
- case_id uuid not null unique          -- one active questionnaire per case Phase 1
- template_version_id uuid not null
- status text not null                  -- draft|submitted|locked|archived
- answers jsonb not null default '{}'
- revision int not null default 1
- started_at timestamptz null
- submitted_at timestamptz null
- updated_at timestamptz not null
- created_at timestamptz not null
```

### Schema jsonb (conceptual)

```json
{
  "schemaVersion": 1,
  "sections": [
    {
      "id": "personal",
      "order": 1,
      "title": { "en": "Personal information", "ru": "Личные данные" },
      "fields": [
        {
          "id": "first_name",
          "type": "text",
          "required": true,
          "order": 1,
          "label": { "en": "First name", "ru": "Имя" },
          "validation": { "maxLength": 100 }
        }
      ]
    }
  ]
}
```

### Phase 1 field types

`text`, `textarea`, `email`, `phone`, `number`, `date`, `select`, `multiselect`, `radio`, `checkbox`, `boolean`, `country`

### Concurrency

- PATCH requires `expectedRevision`.
- Mismatch → **409** `{ error: "revision_conflict" }` (KB tables pattern).
- No draft row until first meaningful change (or create empty draft on accept with `revision=1` and `started_at=null` until first PATCH — pick one; recommend **create on accept** for simpler FK, but `started_at` set on first write).

### UX sections (template content, not tables)

Welcome → Personal → Contact → Family → Education → Employment → Service-specific → Documents → Review → Submit.

---

## 8. Documents

### 8.1 Extend `client_documents` (preferred)

Add columns (non-destructive):

```text
- organization_id uuid                 -- backfill demo
- case_id uuid null                    -- portal case
- questionnaire_id uuid null
- label text null
- document_type text                   -- existing
- uploader_role text                   -- client|employee
- visibility text                      -- client_and_staff|staff_only
- review_status text                   -- pending|accepted|rejected|replacement_requested
- client_comment text null
- staff_comment text null
```

Keep: `storage_bucket`, `storage_path`, soft `archived_at`, hard-delete block.

Migrate existing status values carefully (`uploaded` → map to `review_status=pending` where needed).

### 8.2 Requirements & requests

```text
client_document_requirements
- id uuid PK
- organization_id uuid not null
- template_version_id uuid null        -- or service_type key
- document_type text not null
- required boolean not null default true
- label jsonb not null                 -- en/ru
- sort_order int not null default 0

client_document_requests
- id uuid PK
- organization_id uuid not null
- case_id uuid not null
- document_type text not null
- message text null
- status text not null                 -- open|fulfilled|cancelled
- created_by uuid not null
- created_at timestamptz not null
- resolved_at timestamptz null
```

### 8.3 Storage

| Item | Value |
|------|-------|
| Bucket | `client-documents` (private) |
| Path | `{organization_id}/{case_id}/{document_id}.{ext}` |
| MIME Phase 1 | PDF, PNG, JPEG, WebP |
| Validation | Port KB magic-byte sniff |
| Download | Auth proxy API (nosniff); no public URLs |
| Size | Align with KB image/PDF caps (e.g. 25MB PDF, 10MB image) |

DOCX: evaluate later.

### 8.4 Visibility rules

| visibility | Client | Employee |
|------------|--------|----------|
| `client_and_staff` | Yes | Yes |
| `staff_only` | **No** | Yes |

Client cannot set `staff_only`. Employee uploads default configurable; never flip to client-visible by accident without explicit choice.

---

## 9. CRM integration (`clients`)

On **questionnaire submit** (transaction):

1. Upsert/create `clients` row:
   - `source = 'portal_invite'`
   - names, email, phone, citizenship, country, service_type from answers
   - `status` / display mapped from portal `documents_received`
   - `assigned_user_id` from case
2. Set `client_cases.crm_client_id` and `client_profiles.crm_client_id`.
3. Ensure documents’ `client_uuid` points at CRM client.
4. Emit notification + activity.

**Dedup:** email / passport against existing CRM (reuse Lead Review / passport helpers). On strong match: link instead of duplicate when safe; otherwise flag for employee review.

---

## 10. Submission transaction (logical)

```text
BEGIN
  lock questionnaire by id
  assert status = draft
  assert revision match
  validate required answers vs template_version.schema
  validate required documents present & owned by case
  set questionnaire status = submitted|locked, submitted_at = now()
  set case current_status = documents_received, submitted_at = now()
  insert status event + activity
  upsert clients + link FKs
  insert notifications for assignees/owners
COMMIT
```

Idempotency key: `case_id` + questionnaire already submitted → return same success DTO.

---

## 11. RLS model (target)

Helpers (extend `025` style):

```text
is_spiora_client()
current_client_profile_id()
client_owns_case(case_id)
employee_in_org(organization_id)   -- Phase 1: active owner|manager
```

Policies sketch:

| Table | Client | Employee |
|-------|--------|----------|
| invitations | no list; accept via RPC/API only | CRUD org |
| profiles | own row | org |
| cases | own | org |
| questionnaires | own case; no update if locked | read org; no client answers forge |
| documents | visibility + own case | org; cannot mark client overwrite of staff docs |
| notes | **deny** | org |
| activity | own case limited actions | org |

Anonymous: **no** direct table SELECT. Invite preview only through server using service role after hash lookup with constant-time compare.

---

## 12. API contract (proposal)

Consistent errors: `{ error: string, code?: string, details?: unknown }`  
Auth on every route; never trust client-supplied org/case IDs without ownership check.

### Invitations (employee)

```text
GET    /api/client-invitations
POST   /api/client-invitations
POST   /api/client-invitations/[id]/revoke
POST   /api/client-invitations/[id]/resend
```

### Invite (anonymous / accepting user)

```text
GET    /api/client/invite/[token]          -- preview: email mask, locale, expiry, org name
POST   /api/client/invite/[token]/accept  -- requires auth; binds email
```

### Client questionnaire / documents / profile

```text
GET    /api/client/questionnaire
PATCH  /api/client/questionnaire           -- body: answers patch, expectedRevision
POST   /api/client/questionnaire/submit
GET    /api/client/documents
POST   /api/client/documents
GET    /api/client/documents/[id]/download
POST   /api/client/documents/[id]/archive
GET    /api/client/status
GET    /api/client/profile
PATCH  /api/client/profile
```

### Employee CRM (portal-aware)

```text
GET    /api/clients/new                    -- or /api/clients?source=portal_invite
GET    /api/clients/[clientId]
GET    /api/clients/[clientId]/questionnaire
GET    /api/clients/[clientId]/documents
POST   /api/clients/[clientId]/documents
PATCH  /api/clients/[clientId]/status
POST   /api/clients/[clientId]/document-requests
POST   /api/clients/[clientId]/notes
GET    /api/clients/[clientId]/activity
```

`[clientId]` should accept CRM `external_id` (current convention) with server resolve to uuid; portal APIs use case/profile from session only.

---

## 13. Migration sequence (when implementation starts)

Order (do not apply in this audit):

1. Org constant / optional `organizations` stub  
2. Extend `user_profiles.role` + RLS helpers for client  
3. `client_invitations`  
4. `client_profiles`, `client_cases`, status events, activity  
5. Questionnaire templates + versions + seed Phase 1 schema  
6. `client_questionnaires`  
7. Extend `client_documents` + bucket `client-documents`  
8. Requirements / requests  
9. CRM link columns on `clients` / cases  
10. RLS policies  
11. Demo seed guided path (PR #37)

Each step: idempotent SQL patch + rollback script (repo convention).

---

## 14. Complexity notes

| Area | Complexity | Notes |
|------|------------|-------|
| Invitations + accept | M | Token hash, email bind, races |
| Role split | M | Middleware + session types |
| Questionnaire engine | L | Schema validator + autosave + i18n labels |
| Documents + Storage | M | Mostly clone KB |
| Submit transaction | M–L | Idempotency + CRM upsert |
| CRM list/detail tabs | M | UI heavy, model ready |
| Full multi-tenant | XL | Explicitly deferred |

---

**No implementation in this document.**
