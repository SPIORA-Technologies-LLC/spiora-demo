# Spiora Client — Threat Model (PR #29)

**Date:** 21 July 2026  
**Status:** Design / analysis only.  
**Depends on:** `SPIORA_CLIENT_ARCHITECTURE_AUDIT.md`, `SPIORA_CLIENT_DATA_MODEL_PROPOSAL.md`

---

## 1. Assets

| Asset | Sensitivity |
|-------|-------------|
| Invitation raw tokens | High — account linkage |
| Client PII (passport-adjacent, contacts, family) | High |
| Questionnaire answers | High |
| Documents (ID scans, PDFs) | Critical |
| Internal employee notes | High — must never reach clients |
| Staff-only documents | High |
| Service role key | Critical |
| Organization / case IDs | Medium (IDOR pivot) |
| Auth sessions (employee + client) | High |

---

## 2. Actors

| Actor | Trust |
|-------|-------|
| Anonymous internet user | Untrusted |
| Invite holder (pre-accept) | Limited |
| Authenticated client | Low — own data only |
| Employee (owner/manager) | Medium — org data |
| Malicious employee | Insider — audit + least privilege |
| Compromised browser XSS | Untrusted code in origin |
| Attacker with leaked service role | Catastrophic |

---

## 3. Trust boundaries

```text
Browser ──► Next.js middleware / API ──► service-role Supabase
                │
                ├── employee SessionUser
                ├── client ClientSession
                └── anonymous (invite token only)
```

Today Spiora APIs use **service role** widely. Portal must treat **handler authorization** as primary control; RLS as second layer.

---

## 4. Threat catalog & mitigations

### 4.1 Invitation token leakage

| Risk | Raw token in URL logs, Referer, chat screenshots |
| Mitigation | Short TTL; one-time accept; revoke; hash-at-rest; mask email on preview; no PII in URL |
| Severity | High |

### 4.2 Token brute force

| Risk | Guess `/client/invite/{token}` |
| Mitigation | ≥128-bit entropy; rate limit preview/accept by IP + token prefix; constant-time hash compare; no user enumeration differences beyond generic errors |
| Severity | High if short tokens |

### 4.3 Token reuse

| Risk | Accept twice; share link after accept |
| Mitigation | `accepted_at` set once; subsequent accepts idempotent for **same** user only; others get conflict; revoke support |
| Severity | High |

### 4.4 Email mismatch / account takeover

| Risk | Attacker registers different email than invite |
| Mitigation | Require authenticated email === invite email (normalized); block accept if mismatch; optional verify email before accept |
| Severity | Critical |

### 4.5 IDOR

| Risk | `/api/client/documents/{otherId}`, employee APIs with guessed UUIDs |
| Mitigation | Resolve resources via session ownership; ignore client-supplied org/case ids; tests for cross-user access |
| Severity | Critical |

### 4.6 Cross-tenant access

| Risk | Multi-tenant future; demo constant today |
| Mitigation | `organization_id` on all rows; assert org on every query; don’t skip checks because “single tenant demo” |
| Severity | High (future) / Medium (now) |

### 4.7 Storage path guessing

| Risk | Predictable paths + leaked bucket policy |
| Mitigation | Private bucket; **no** public/signed broad policies; UUID paths; download only via auth proxy; strip paths from client DTOs (`toPublicDocument` pattern) |
| Severity | Critical |

### 4.8 Unsafe MIME / polyglot / oversized uploads

| Risk | HTML-as-PDF, polyglot, zip bombs, huge files |
| Mitigation | KB-style allowlist + magic sniff + size caps; `X-Content-Type-Options: nosniff`; serve via proxy with safe Content-Type; block SVG/HTML/JS |
| Severity | High |

### 4.9 Malformed PDFs / images

| Risk | Parser crashes, XSS in PDF viewers |
| Mitigation | Don’t execute in privileged context; use browser sandbox/`<iframe>`/`object` carefully; prefer download for untrusted; size limits |
| Severity | Medium |

### 4.10 XSS via questionnaire values

| Risk | Answers rendered as HTML in CRM |
| Mitigation | React text escaping by default; never `dangerouslySetInnerHTML` on answers; sanitize URLs (`https?` only) |
| Severity | High |

### 4.11 Unsafe URLs in answers

| Risk | `javascript:` links |
| Mitigation | Same URL allowlist helpers as KB links (`isSafeHttpUrl`) |
| Severity | Medium |

### 4.12 JSON payload abuse

| Risk | Huge answers jsonb; prototype pollution; unexpected keys |
| Mitigation | Max body size; validate against template schema; strip unknown field ids; depth/size limits |
| Severity | Medium |

### 4.13 Duplicate submit / races

| Risk | Double case, double notifications |
| Mitigation | Transaction + row lock; unique case questionnaire; idempotent submit |
| Severity | High |

### 4.14 Status tampering

| Risk | Client PATCHes `current_status` |
| Mitigation | No client status write API; employee-only status PATCH with allowlist transitions |
| Severity | High |

### 4.15 Hidden field / schema manipulation

| Risk | Client sends admin-only fields or alters template |
| Mitigation | Server loads template_version; clients cannot upload schema; ignore unknown answer keys |
| Severity | High |

### 4.16 Client viewing internal notes

| Risk | Notes API exposed under `/api/client/*` by mistake |
| Mitigation | Separate routes; RLS deny; UI never ships notes to client bundle queries |
| Severity | Critical |

### 4.17 Employee exposing staff-only documents

| Risk | Default visibility wrong; bulk “share all” |
| Mitigation | Explicit visibility enum (no ambiguous boolean); default `staff_only` for employee uploads; confirm UI; audit log on visibility change |
| Severity | High |

### 4.18 Service-role leakage

| Risk | Key in client bundle / logs |
| Mitigation | Existing boundary tests (`auth-boundaries.test.ts`); keep admin import server-only |
| Severity | Critical |

### 4.19 Audit log tampering

| Risk | Client inserts fake activity |
| Mitigation | Inserts only from server trusted paths; no client write to `client_activity`; revoke UPDATE for clients |
| Severity | Medium |

### 4.20 Session confusion (employee ↔ client)

| Risk | Same browser cookie used to open `/clients` as client role |
| Mitigation | Distinct session mapping; middleware path ACL; logout on role mismatch; never put `client` in employee `UserRole` union used by nav |
| Severity | High |

### 4.21 Meeting-invite pattern regression

| Risk | Copying plaintext `token` column from guest invites |
| Mitigation | Design requires `token_hash` only; code review checklist for PR #30 |
| Severity | High |

---

## 5. Abuse cases (happy-path adversarial)

1. **Replay accept:** Same token after accept → idempotent for owner; deny for others.  
2. **Invite enumerate:** `/api/client/invite/aaaa…` → uniform 404.  
3. **Employee IDOR:** Manager A reads Manager B’s org — Phase 1 single org mitigates; still check authz.  
4. **Client downloads staff_only:** API returns 404/403, not 500.  
5. **Submit without required docs:** 400 with field/document codes; no partial lock.  
6. **Revision conflict:** Two tabs → 409 → reload, no silent overwrite.

---

## 6. Security requirements checklist (PR gates)

| PR | Must include |
|----|--------------|
| #30 | token_hash, TTL, revoke, email bind, rate limit, no plaintext token column |
| #31 | middleware ACL, client session isolation |
| #32 | schema validation server-side, revision/409, XSS-safe render |
| #33 | magic sniff, private bucket, proxy download, visibility enum |
| #34 | transactional idempotent submit |
| #35 | employee authz on all CRM portal reads |
| #36 | staff_only default + notification without leaking titles of staff files to wrong party |
| #37 | e2e tests for IDOR, reuse, visibility |

---

## 7. Residual risks (accepted for Phase 1)

| Risk | Why accepted | Follow-up |
|------|--------------|-----------|
| Service-role bypass of RLS | Matches current Spiora pattern | Tighten RLS + user-scoped clients later |
| Single shared cookie jar on path-based host | Simpler deploy | Consider `__Host-` cookies / separate client cookie name |
| No email delivery | In-app + copy link | Resend/email in later PR |
| Formgrid still external | Parallel channel | Unify intake UX later |

---

## 8. Verdict linkage

Threat analysis supports:

- **SAFE TO IMPLEMENT PR #30** with hash-only tokens and email binding.  
- **SAFE TO ADD CLIENT ROLE** with session isolation.  
- **NOT SAFE** to reuse CRM `clients` as auth identity.  
- **SAFE TO REUSE** KB Storage security patterns for a **new** bucket.

**No implementation in this document.**
