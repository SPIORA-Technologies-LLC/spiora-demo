# SPIORA Client Cases Cutover Checklist — 034 (PR #32.1)

## Goal

Move case workflow from `.data/client-cases.json` to PostgreSQL + private Storage.

## Prerequisites

- [ ] PR #30 invitations applied (`client_invitations`, `client_portal_users`)
- [ ] PR #31 questionnaires applied (`client_questionnaires`, templates)
- [ ] RLS helpers from 025 (`is_spiora_owner`, `is_spiora_manager`, `spiora_block_hard_delete`)
- [ ] Storage bucket `task-attachments` exists and is **private**
- [ ] Staging env has service role + anon keys

## Apply order

1. Run `SPIORA_CLIENT_CASES_PREFLIGHT_034.sql` → expect `READY_TO_APPLY` or `ALREADY_APPLIED`
2. Apply `SPIORA_SUPABASE_PATCH_034_CLIENT_CASES.sql` (parity with `supabase/migrations/034_client_cases.sql`)
3. Run `SPIORA_CLIENT_CASES_VALIDATE_034.sql` → expect `VALIDATED_OK`
4. Run staging smoke: `node scripts/client-cases-staging-cutover.mjs smoke`

## Runtime checks

- [ ] Production/Vercel refuses local JSON fallback (config error if Supabase missing)
- [ ] Submit creates case via `spiora_submit_client_case`
- [ ] Duplicate submit returns same case id
- [ ] Questionnaire immutable after submit
- [ ] Employee intake lists cases with pagination
- [ ] Client portal status DTO has no comments / internal docs
- [ ] Employee document upload writes Storage + `client_case_documents`
- [ ] Failed metadata insert cleans up Storage object
- [ ] Thank-you copy says questionnaire received (not “documents received” unless case docs linked)

## Rollback

- Pre-production only: `SPIORA_SUPABASE_PATCH_034_CLIENT_CASES_ROLLBACK.sql`
- Blocked automatically when `client_cases` has rows

## Do not

- Auto-apply from CI
- Deploy before validate + smoke pass
- Public Storage buckets for case documents
