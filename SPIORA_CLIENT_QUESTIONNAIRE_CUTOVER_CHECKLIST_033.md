# Spiora Client Questionnaire Engine — Cutover Checklist 033

1. Backup staging database / confirm rollback window.
2. Run `SPIORA_CLIENT_QUESTIONNAIRE_PREFLIGHT_033.sql`.
3. Stop if result is `NOT_READY`.
4. Apply `SPIORA_SUPABASE_PATCH_033_CLIENT_QUESTIONNAIRES.sql` manually on staging only.
5. Run `SPIORA_CLIENT_QUESTIONNAIRE_VALIDATE_033.sql`.
6. Stop if hash mismatch, partial schema, RLS failure, cross-client access, revision conflict failure, or template binding failure is detected.
7. Run automated staging smoke:

```powershell
$env:NODE_OPTIONS='--use-system-ca'
node --experimental-strip-types --experimental-specifier-resolution=node --import ./scripts/test-register.mjs scripts/client-questionnaire-staging-cutover.mjs all
```

8. Run browser smoke checklist.
9. Only after successful staging checks: commit.
10. Push in a separate explicit step.
11. Deploy in a separate explicit step.
