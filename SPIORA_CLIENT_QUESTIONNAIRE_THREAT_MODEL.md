# Spiora Client Questionnaire Engine — Threat Model (PR #31)

- IDOR: client questionnaire access bound to `client_portal_users.auth_user_id`
- Unknown fields denied server-side
- Read-only derived identity fields cannot be patched
- Blind overwrite prevented via `revision`
- Hidden conditional answers kept in draft but ignored in validation
- No `dangerouslySetInnerHTML`; labels/descriptions rendered as text
- Migration not applied yet; staging validation required before rollout
