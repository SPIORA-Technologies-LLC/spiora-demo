# SPIORA KB Attachments Phase 1 — Runtime Checklist

## Before apply (operator)
- [ ] Migration `026` applied and validated
- [ ] Backup / snapshot available
- [ ] Review `SPIORA_SUPABASE_PATCH_027_KNOWLEDGE_BASE_ATTACHMENTS.sql`
- [ ] Confirm Storage available on project

## Apply order (manual — do not auto-run from CI)
1. Run patch `027` in Supabase SQL Editor (or `supabase db push` when approved)
2. Confirm table `knowledge_base_attachments` exists
3. Confirm bucket `knowledge-base` exists and `public = false`
4. Redeploy / restart app with same env (no new Vercel secrets required if service role already set)

## Smoke tests
- [ ] Owner: create text draft → edit → upload PDF → preview/download
- [ ] Owner: upload PNG/JPEG/WebP
- [ ] Owner: archive attachment → hidden for manager
- [ ] Manager: cannot POST upload (403)
- [ ] Anon: 401 on attachment APIs
- [ ] Published article: manager can download active attachment
- [ ] Draft article: manager cannot list/download attachments
- [ ] Reject `.svg`, `.exe`, oversized file
- [ ] Service role key not present in any browser network response

## Rollback
- Use `SPIORA_SUPABASE_PATCH_027_KNOWLEDGE_BASE_ATTACHMENTS_ROLLBACK.sql` only after confirming no production dependency on attachments.
