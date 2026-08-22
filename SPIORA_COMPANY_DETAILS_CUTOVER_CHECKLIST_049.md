# SPIORA Company Details cutover checklist (049 / PR #34)

## Scope

- Adds `company_details` + append-only `company_details_changes`
- Demo seed row (`singleton_key = active`, `is_demo = true`)
- RPCs: `spiora_company_details_get`, `spiora_company_details_update`
- RLS: view = owner/finance_manager/manager; manage = owner/finance_manager

## Apply order

1. Run `SPIORA_COMPANY_DETAILS_PREFLIGHT_049.sql`
   - Expect `READY_TO_APPLY` or `ALREADY_APPLIED`
2. Apply `SPIORA_SUPABASE_PATCH_049_COMPANY_DETAILS.sql`
   - Must match `supabase/migrations/049_company_details.sql`
3. Run `SPIORA_COMPANY_DETAILS_VALIDATE_049.sql`
   - Expect `VALIDATED_OK`
4. Optional smoke: `node scripts/company-details-staging-cutover.mjs smoke`

## Rollback (staging only)

- Run `SPIORA_SUPABASE_PATCH_049_COMPANY_DETAILS_ROLLBACK.sql`
- Re-run preflight → expect `READY_TO_APPLY`

## Notes

- Migration number **037** is already used by `037_knowledge_base_scope.sql`; Company Details uses **049**.
- Seed is idempotent and does not overwrite existing active row.
- Hard delete on `company_details` is blocked by trigger.
