# SPIORA Knowledge Base Attachments — Threat Model (PR #20 Phase 1)

## Assets
- Attachment metadata in `knowledge_base_attachments`
- Binary objects in private Storage bucket `knowledge-base`
- Parent article visibility (draft / published / archived)

## Trust boundaries
- Browser never receives `SUPABASE_SERVICE_ROLE_KEY`
- Storage I/O only via Next.js API + service role (proxy download)
- Anonymous: deny
- Manager/consultant/viewer: read active attachments only when parent article is published
- Owner: upload, caption/order, archive

## Threats & mitigations

| ID | Threat | Mitigation |
|----|--------|------------|
| T1 | Malware upload | MIME allowlist + magic-byte sniff; SVG/exe blocked; size caps |
| T2 | Path traversal | `storage_path` = `{uuid}.{ext}` only; assert regex before I/O |
| T3 | Public URL leak | Private bucket; `Cache-Control: private`; no permanent public URLs |
| T4 | Draft leak | Readers require published parent; draft attachments owner-only |
| T5 | Archived visible | `status=archived` / `archived_at` filtered for non-owners |
| T6 | Hard delete bypass | Trigger `spiora_block_hard_delete`; revoke DELETE |
| T7 | XSS via image | No SVG; `X-Content-Type-Options: nosniff`; proxy Content-Type from DB |
| T8 | MIME spoofing | Declared MIME must match sniffed bytes |

## Out of scope (Phase 1)
- Virus scanning queue (recommended before production scale)
- DOCX/XLSX/CSV/video
- AI indexing of file contents
- Client-side signed URL issuance

## Residual risk
- PDF/JS inside PDF viewers is a browser concern; prefer download for untrusted PDFs later if needed.
- AV scanning not yet wired — mark NOT SAFE TO APPLY in production without operator review.
