# Spiora Client — Implementation Roadmap (PR #29)

**Date:** 21 July 2026  
**Status:** Planning only. No code in this audit.  
**Depends on:** Architecture audit, data model proposal, threat model.

---

## 0. Phase 1 framing

| Choice | Decision |
|--------|----------|
| App topology | Same Next.js app + same Supabase DB |
| Client URLs | `/client/…` |
| Employee URLs | Keep current (`/clients`, …) — **do not** mass-rename to `/app` in MVP |
| Hosting | `demo.spiora.app/client/…` (path) |
| Desk code | Reference only — do not copy |
| Formgrid | Remains parallel intake |
| Email/push | Deferred; in-app notifications only |
| Multi-tenant | `organization_id` + demo constant; no full orgs SaaS |

---

## 1. Complexity legend

| Tag | Meaning |
|-----|---------|
| S | Small (1–3 days) |
| M | Medium (3–7 days) |
| L | Large (1–2 weeks) |
| XL | Extra large / split further |

Estimates assume one focused engineer familiar with this repo.

---

## 2. PR plan

### PR #30 — Client Invitations

**Goal:** Employee creates secure invite; client can open link, register/sign in, accept once; empty client portal shell.

| Deliverable | Notes | Size |
|-------------|-------|------|
| SQL: `client_invitations` (+ org constant) | `token_hash`, TTL, revoke, email bind fields | M |
| Extend role `client` + session split | `ClientSession` ≠ `SessionUser` | M |
| Employee UI: create / copy / revoke / list invites | Under Clients or Team tools | M |
| `GET/POST` invite APIs | Preview + accept idempotent | M |
| `/client/invite/[token]` page | Anonymous → login/register → accept | M |
| Middleware: public invite + block employee paths for client | | S |
| Empty `/client` shell redirect | | S |
| Tests: hash storage, reuse, expiry, email mismatch, rate limit | | M |

**Out of scope:** questionnaire engine, documents binary, CRM auto-create.

**Exit criteria:** End-to-end invite → accept → client lands on empty portal; raw token never in DB.

**Complexity:** **L**  
**Blockers:** None for schema; Auth provider must be Supabase for real client users (legacy JWT insufficient for portal — document requirement).

---

### PR #31 — Spiora Client Shell

**Goal:** Branded client layout, routes, profile stub, EN/RU, guards, mobile.

| Deliverable | Notes | Size |
|-------------|-------|------|
| Layout `/client` (nav: questionnaire, documents, status, profile) | Distinct from employee AppShell | M |
| Branding / atmosphere consistent with Spiora, client-appropriate | No Desk copy-paste | S |
| Profile view + locale preference | Cookie + profile field | S |
| Route guards + empty states | | S |
| i18n `clientPortal.*` | en.json / ru.json | M |
| Mobile responsive shell | | S |

**Complexity:** **M**  
**Depends on:** #30

---

### PR #32 — Questionnaire Engine

**Goal:** Versioned templates; client draft with autosave; review; validation.

| Deliverable | Notes | Size |
|-------------|-------|------|
| Tables: templates, versions, `client_questionnaires` | Seed one published Phase 1 schema | L |
| Schema validator + field types list | Server-side only | M |
| PATCH autosave + debounce + `expectedRevision` / 409 | Mirror KB tables UX | M |
| Multi-step UX + progress + continue later | Sections per audit | L |
| Review screen | Labels from **saved** template version | M |
| No builder UI | Seed JSON only | — |
| Tests: concurrency, unknown keys stripped, locked immutability | | M |

**Complexity:** **L–XL** (largest engine piece)  
**Depends on:** #30–#31

---

### PR #33 — Client Documents

**Goal:** Private Storage; upload/preview; requirements; visibility; review states.

| Deliverable | Notes | Size |
|-------------|-------|------|
| Bucket `client-documents` + extend `client_documents` | Magic sniff from KB | M |
| Client upload / list / archive / download proxy | | M |
| Requirements table + checklist UI | | M |
| Visibility enum + review_status | | M |
| Employee read path (minimal) | Full CRM UI in #35 | S |
| Tests: MIME mismatch, path leak absence, visibility | | M |

**Complexity:** **L**  
**Depends on:** #30–#31 (case id); soft-dep #32 for questionnaire_id

---

### PR #34 — Submission Workflow

**Goal:** Idempotent submit; case activation; first CRM appearance; notifications.

| Deliverable | Notes | Size |
|-------------|-------|------|
| `POST …/questionnaire/submit` transaction | Validate answers + required docs | L |
| Status events + activity rows | | M |
| Upsert/link `clients` (`source=portal_invite`) | Dedup helpers | M |
| Lock questionnaire read-only for client | | S |
| Employee in-app notifications | New types | S |
| Idempotency / race tests | | M |

**Complexity:** **L**  
**Depends on:** #32–#33

---

### PR #35 — New Clients CRM

**Goal:** List + full card for portal-submitted clients.

| Deliverable | Notes | Size |
|-------------|-------|------|
| List: filters, search, sort, pagination, new indicator | Prefer `/clients` filter over third nav item | M |
| Columns: name, program, citizenship, residence, assignee, docs m/n, status, submitted | | M |
| Detail: Overview / Questionnaire / Documents / Statuses / History / Notes | Master-detail or `/clients/[id]` tabs | L |
| Render answers with template version labels (not raw JSON) | | M |
| Employee document actions | accept/reject/replace/upload/visibility | M |
| Status timeline + activity | | M |
| Internal notes (existing `client_notes`) | | S |

**UX preference:** Keep Spiora’s `/clients` + `/clients/[id]` pattern (detail route already exists); enhance tabs rather than invent Desk-like shell.

**Complexity:** **L**  
**Depends on:** #34

---

### PR #36 — Employee ↔ Client Collaboration

**Goal:** Employee files to client; document requests; notes polish; client notifications.

| Deliverable | Notes | Size |
|-------------|-------|------|
| Employee upload with visibility picker | Default staff_only | M |
| Document requests + client fulfillment | | M |
| Client notifications for status/docs | | M |
| Guardrails: no client overwrite of employee docs | | S |

**Complexity:** **M–L**  
**Depends on:** #33–#35

---

### PR #37 — Demo Polish

**Goal:** Demo-ready guided scenario.

| Deliverable | Notes | Size |
|-------------|-------|------|
| Seed: template, invite, sample client journey | | M |
| Guided script / checklist doc | | S |
| a11y + mobile pass | | M |
| Performance pass (list/detail) | | S |
| E2E: invite → fill → submit → CRM | | L |
| Demo reset notes | | S |

**Complexity:** **L**  
**Depends on:** #30–#36

---

## 3. Migration sequence (implementation time)

Do **not** run during this audit.

1. Role + RLS helpers for client  
2. `client_invitations`  
3. `client_profiles` / `client_cases` / status + activity  
4. Questionnaire tables + seed version  
5. Documents columns + Storage bucket  
6. Requirements / requests  
7. CRM link fields  
8. Demo seed pack  

Follow repo convention: `SPIORA_SUPABASE_PATCH_NNN_*.sql` + rollback + `supabase/migrations/NNN_*.sql`.

---

## 4. UX flows (target)

### Invitation

```text
Employee creates invite → copies /client/invite/{token}
→ Client opens → signs up / signs in (email match)
→ Accept once → profile + case + questionnaire available
```

### Questionnaire

```text
Welcome → sections… → Documents → Review → Submit
Autosave · progress · continue later · 409 reload · mobile
After submit: read-only for client
```

### Employee CRM

```text
New row in Clients (portal filter) → open card
→ Overview / Questionnaire / Documents / Statuses / History / Notes
```

---

## 5. Explicit non-goals (MVP)

- Native mobile apps / stores  
- Google Drive as SoT  
- OCR / passport recognition / e-sign  
- Realtime chat / video inside client portal  
- Drag-and-drop questionnaire builder  
- Collaborative editing / AI autofill / AI doc analysis  
- XLSX  
- External CRM sync  
- Subdomain split / separate DB / separate Next project  

---

## 6. Risks & blockers

| Risk | Impact | Mitigation |
|------|--------|------------|
| Legacy auth cannot onboard real clients | Blocks #30 in legacy-only envs | Require Supabase Auth for portal demos |
| Three intake UIs (Formgrid / Leads / Portal) | Confusion | Filter badges; docs; unify later |
| Service-role authz bugs | IDOR | Threat-model tests per PR |
| CLE/UCI not implemented | Status fragmentation | Portal status enum + map to CRM display |
| Extending `client_documents` while Sheets-era statuses exist | Mapping bugs | Explicit status dual-write map |
| Consultant/viewer still unfinished | Scope creep | Phase 1 owner/manager only for invites |

---

## 7. Open questions (carry into PR #30 kickoff)

1. Supabase Auth email confirmation required before accept?  
2. Invite resend = new token (revoke old) or same hash rotation?  
3. Should portal-submitted clients appear in default `/clients` list or opt-in filter only?  
4. One questionnaire template globally vs per `service_type` in Phase 1?  
5. Register-in-place on invite page vs redirect to `/login` with return URL?

**Recommendations:** (1) yes if Auth supports; (2) new token on resend; (3) default list with “Portal · New” badge + filter; (4) one template + `service_type` field; (5) return URL to invite accept.

---

## 8. Suggested demo script (PR #37)

1. Owner creates invite for `demo.client@example.com`.  
2. Open link in private window → register → accept.  
3. Fill questionnaire; upload 2 docs; submit.  
4. As owner: see client in list; open card; accept one doc; request replacement; change status.  
5. As client: see status + request; upload replacement; see shared employee file.

---

## 9. Final go / no-go

| Gate | Verdict |
|------|---------|
| Start PR #30 Client Invitations | **SAFE TO IMPLEMENT** |
| Add `client` role | **SAFE TO ADD** (session-isolated) |
| Reuse `clients` as portal identity | **NOT SAFE** — link only |
| Reuse Storage patterns | **SAFE** — new bucket + KB validation |

---

## 10. Document index

| File | Contents |
|------|----------|
| `SPIORA_CLIENT_ARCHITECTURE_AUDIT.md` | Current state, reuse, target architecture, verdicts |
| `SPIORA_CLIENT_DATA_MODEL_PROPOSAL.md` | Tables, RLS, Storage, API, submit tx |
| `SPIORA_CLIENT_THREAT_MODEL.md` | Threats & mitigations |
| `SPIORA_CLIENT_IMPLEMENTATION_ROADMAP.md` | This file — phased PRs |

**Audit complete. Stop. Do not implement until explicitly requested.**
