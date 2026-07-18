# SPIORA KB Tables Phase 1A — Threat Model

| ID | Threat | Mitigation |
|----|--------|------------|
| T1 | XSS via cell content | Text-only inputs/spans; no raw HTML / markdown in cells |
| T2 | javascript:/data: URLs | `isSafeHttpUrl` — http(s) only |
| T3 | CSV formula injection | Store as text; export prefixes `'` for `=+-@` |
| T4 | Oversized CSV/JSON | 5 MB / 2 MB / 50k cells / 2k chars caps |
| T5 | IDOR tableId | Always scoped to article from slug |
| T6 | Non-owner write | API 403 + RLS owner insert/update |
| T7 | Draft leak | Readers require published parent + active table |
| T8 | Stale overwrite | `revision` / `expectedRevision` → 409 |
| T9 | Prototype pollution | Reject `__proto__` / `constructor` keys in cells |
| T10 | Anonymous access | 401 without session |
| T11 | Hard delete | Trigger + REVOKE DELETE |
| T12 | service_role in browser | Server-only repos |

Phase 1A does **not** parse XLSX (zip bomb / macro risks deferred to 1B).
