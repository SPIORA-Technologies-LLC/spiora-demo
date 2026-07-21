# Spiora Client Invitations — Threat Model (PR #30)

## Mitigations implemented

| Threat | Mitigation |
|--------|------------|
| Token leakage in DB | Only `token_hash` (SHA-256 hex) stored |
| Token in logs | Create handlers do not `console.log` invite URL/token |
| Brute force | 32-byte entropy; invalid tokens → neutral `INVITATION_INVALID` |
| Hash timing | `timingSafeEqual` on hex digests |
| Token reuse | One accept; others get accepted/conflict |
| Email mismatch | Accept requires normalized email equality |
| IDOR on invitation id | Revoke requires employee session; public APIs use token only |
| Enumeration | Invalid/unknown share same error shape/status family |
| Employee↔client confusion | Separate session helpers + middleware blocks |
| Open redirect | Accept returns fixed `/client` only |
| CSRF | Origin check on mutating endpoints + SameSite cookies |
| Referrer leak | `Referrer-Policy: no-referrer` on invite paths; `Cache-Control: no-store` |
| Service role in browser | Existing boundary; repos are `server-only` |
| Meeting-invite plaintext pattern | Not reused |

## Residual risks

| Risk | Notes |
|------|-------|
| Service role bypasses RLS | Same as rest of Spiora; handlers must enforce authz |
| Email confirmation | If Supabase requires confirm, user sees message and must return to invite link |
| Demo email bypass | `POST /api/client/auth/demo-register` only when `SPIORA_DEMO_MODE=true` + Supabase; must stay off in production |
| Browser history | Token remains in history until user clears; short TTL recommended |
| Local `.data` store | Dev-only fallback; not for production multi-instance |

## Verdict

**SAFE TO COMMIT** from a design/security structure perspective after tests/build pass, **provided** reviewers confirm guard separation.  
**NOT SAFE TO APPLY MIGRATION** until manual checklist on a staging Supabase project.
