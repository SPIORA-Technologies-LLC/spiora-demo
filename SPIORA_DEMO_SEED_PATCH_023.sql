-- =============================================================================
-- SPIORA — Demo Seed Patch 023 (SQL Editor)
-- =============================================================================
-- PR #15.1 — применять ПОСЛЕ SPIORA_SUPABASE_PATCH_023.sql на Spiora Demo.
--
-- Содержит ТОЛЬКО:
--   • idempotent backfill client_notes (client_uuid, content, author_name)
--   • 10 fictional demo notes (NT-DEMO-1 … NT-DEMO-10)
--   • 16 fictional document metadata records (DOC-DEMO-001 … DOC-DEMO-016)
--
-- НЕ содержит: INSERT 25 clients, app_state, migration DDL, secrets.
-- Idempotent: ON CONFLICT DO NOTHING + безопасный UPDATE backfill.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- STEP 1 — Supplemental backfill (idempotent, повторяет migration 023 logic)
-- -----------------------------------------------------------------------------

update client_notes
set
  content = coalesce(nullif(trim(content), ''), text),
  author_name = coalesce(nullif(trim(author_name), ''), author),
  updated_at = coalesce(updated_at, created_at),
  is_demo = coalesce(is_demo, true)
where content is null
   or trim(content) = ''
   or author_name is null
   or trim(author_name) = ''
   or client_uuid is null;

update client_notes cn
set client_uuid = c.id
from clients c
where cn.client_uuid is null
  and cn.client_id = c.external_id;

-- -----------------------------------------------------------------------------
-- STEP 2 — Demo notes (10 records, ON CONFLICT skip)
-- client_notes.client_id = clients.external_id (legacy, kept)
-- -----------------------------------------------------------------------------

insert into client_notes (
  id, client_id, client_uuid, author, author_name, author_user_id, text, content, created_at, is_demo
) values
  ('NT-DEMO-1', 'DEMO-1001', (select id from clients where external_id = 'DEMO-1001' limit 1), 'Daniel Cooper', 'Daniel Cooper', 'user-daniel', 'Intro call completed. Client prefers Portugal as primary destination.', 'Intro call completed. Client prefers Portugal as primary destination.', '2026-05-27T10:00:00Z', true),
  ('NT-DEMO-2', 'DEMO-1002', (select id from clients where external_id = 'DEMO-1002' limit 1), 'Emma Wilson', 'Emma Wilson', 'user-emma', 'Document checklist sent for Spain consultation track.', 'Document checklist sent for Spain consultation track.', '2026-05-26T14:30:00Z', true),
  ('NT-DEMO-3', 'DEMO-1013', (select id from clients where external_id = 'DEMO-1013' limit 1), 'Daniel Cooper', 'Daniel Cooper', 'user-daniel', 'Financial documents received, pending review.', 'Financial documents received, pending review.', '2026-05-17T09:15:00Z', true),
  ('NT-DEMO-4', 'DEMO-1003', (select id from clients where external_id = 'DEMO-1003' limit 1), 'Lucas Martin', 'Lucas Martin', 'user-lucas', 'Passport scan requested again — previous upload was unreadable.', 'Passport scan requested again — previous upload was unreadable.', '2026-05-25T16:00:00Z', true),
  ('NT-DEMO-5', 'DEMO-1006', (select id from clients where external_id = 'DEMO-1006' limit 1), 'Lucas Martin', 'Lucas Martin', 'user-lucas', 'D7 visa timeline discussed; client will provide bank statements next week.', 'D7 visa timeline discussed; client will provide bank statements next week.', '2026-05-24T11:20:00Z', true),
  ('NT-DEMO-6', 'DEMO-1008', (select id from clients where external_id = 'DEMO-1008' limit 1), 'Emma Wilson', 'Emma Wilson', 'user-emma', 'Digital nomad program docs list shared; client confirmed remote employer letter.', 'Digital nomad program docs list shared; client confirmed remote employer letter.', '2026-05-22T09:45:00Z', true),
  ('NT-DEMO-7', 'DEMO-1015', (select id from clients where external_id = 'DEMO-1015' limit 1), 'Lucas Martin', 'Lucas Martin', 'user-lucas', 'Proof of address still missing — utility bill preferred.', 'Proof of address still missing — utility bill preferred.', '2026-05-15T13:10:00Z', true),
  ('NT-DEMO-8', 'DEMO-1022', (select id from clients where external_id = 'DEMO-1022' limit 1), 'Daniel Cooper', 'Daniel Cooper', 'user-daniel', 'Embassy appointment prep call scheduled for next Tuesday.', 'Embassy appointment prep call scheduled for next Tuesday.', '2026-05-08T08:30:00Z', true),
  ('NT-DEMO-9', 'DEMO-1005', (select id from clients where external_id = 'DEMO-1005' limit 1), 'Emma Wilson', 'Emma Wilson', 'user-emma', 'Case closed successfully — all residence documents approved.', 'Case closed successfully — all residence documents approved.', '2026-05-20T15:00:00Z', true),
  ('NT-DEMO-10', 'DEMO-1021', (select id from clients where external_id = 'DEMO-1021' limit 1), 'Emma Wilson', 'Emma Wilson', 'user-emma', 'Golden visa investment proof under internal review.', 'Golden visa investment proof under internal review.', '2026-05-09T10:05:00Z', true)
on conflict (id) do nothing;

-- Re-run backfill for rows inserted without client_uuid subquery match
update client_notes cn
set client_uuid = c.id
from clients c
where cn.client_uuid is null
  and cn.client_id = c.external_id;

-- -----------------------------------------------------------------------------
-- STEP 3 — Document metadata (16 fictional records, no binary)
-- -----------------------------------------------------------------------------

insert into client_documents (
  client_uuid, external_id, file_name, original_file_name, mime_type, size_bytes,
  document_type, status, storage_provider, storage_bucket, storage_path,
  uploaded_by_user_id, uploaded_by_name, uploaded_at, is_demo, metadata
) values
  ((select id from clients where external_id = 'DEMO-1001' limit 1), 'DOC-DEMO-001', 'carter_passport_scan.pdf', 'carter_passport_scan.pdf', 'application/pdf', 245760, 'passport_copy', 'approved', 'demo', 'demo-clients', 'demo/clients/DEMO-1001/passport_scan.pdf', 'user-daniel', 'Daniel Cooper', '2026-05-20T11:00:00Z', true, '{}'::jsonb),
  ((select id from clients where external_id = 'DEMO-1001' limit 1), 'DOC-DEMO-002', 'carter_application_form.pdf', 'carter_application_form.pdf', 'application/pdf', 512000, 'application_form', 'under_review', 'demo', 'demo-clients', 'demo/clients/DEMO-1001/application_form.pdf', 'user-daniel', 'Daniel Cooper', '2026-05-21T09:30:00Z', true, '{}'::jsonb),
  ((select id from clients where external_id = 'DEMO-1002' limit 1), 'DOC-DEMO-003', 'martins_questionnaire.pdf', 'martins_questionnaire.pdf', 'application/pdf', 198656, 'client_questionnaire', 'uploaded', 'demo', 'demo-clients', 'demo/clients/DEMO-1002/questionnaire.pdf', 'user-emma', 'Emma Wilson', '2026-05-26T12:00:00Z', true, '{}'::jsonb),
  ((select id from clients where external_id = 'DEMO-1002' limit 1), 'DOC-DEMO-004', 'martins_proof_of_address.pdf', 'martins_proof_of_address.pdf', 'application/pdf', 307200, 'proof_of_address', 'missing', 'demo', 'demo-clients', 'demo/clients/DEMO-1002/proof_of_address.pdf', 'user-emma', 'Emma Wilson', '2026-05-26T12:05:00Z', true, '{}'::jsonb),
  ((select id from clients where external_id = 'DEMO-1003' limit 1), 'DOC-DEMO-005', 'kowalska_passport_copy.pdf', 'kowalska_passport_copy.pdf', 'application/pdf', 221184, 'passport_copy', 'under_review', 'supabase', 'client-docs', 'internal/demo/DEMO-1003/passport_copy.pdf', 'user-lucas', 'Lucas Martin', '2026-05-26T08:15:00Z', true, '{}'::jsonb),
  ((select id from clients where external_id = 'DEMO-1003' limit 1), 'DOC-DEMO-006', 'kowalska_residence_permit.pdf', 'kowalska_residence_permit.pdf', 'application/pdf', 409600, 'residence_permit', 'expired', 'demo', 'demo-clients', 'demo/clients/DEMO-1003/residence_permit.pdf', 'user-lucas', 'Lucas Martin', '2026-05-25T14:00:00Z', true, '{}'::jsonb),
  ((select id from clients where external_id = 'DEMO-1005' limit 1), 'DOC-DEMO-007', 'brown_employment_contract.pdf', 'brown_employment_contract.pdf', 'application/pdf', 655360, 'employment_contract', 'approved', 'demo', 'demo-clients', 'demo/clients/DEMO-1005/employment_contract.pdf', 'user-emma', 'Emma Wilson', '2026-05-18T10:00:00Z', true, '{}'::jsonb),
  ((select id from clients where external_id = 'DEMO-1006' limit 1), 'DOC-DEMO-008', 'nguyen_bank_statement.pdf', 'nguyen_bank_statement.pdf', 'application/pdf', 890880, 'other', 'uploaded', 'demo', 'demo-clients', 'demo/clients/DEMO-1006/bank_statement.pdf', 'user-lucas', 'Lucas Martin', '2026-05-24T16:30:00Z', true, '{}'::jsonb),
  ((select id from clients where external_id = 'DEMO-1008' limit 1), 'DOC-DEMO-009', 'novak_remote_employer_letter.pdf', 'novak_remote_employer_letter.pdf', 'application/pdf', 143360, 'employment_contract', 'approved', 'supabase', 'client-docs', 'internal/demo/DEMO-1008/employer_letter.pdf', 'user-emma', 'Emma Wilson', '2026-05-22T11:45:00Z', true, '{}'::jsonb),
  ((select id from clients where external_id = 'DEMO-1013' limit 1), 'DOC-DEMO-010', 'petrova_financial_summary.pdf', 'petrova_financial_summary.pdf', 'application/pdf', 524288, 'other', 'under_review', 'demo', 'demo-clients', 'demo/clients/DEMO-1013/financial_summary.pdf', 'user-daniel', 'Daniel Cooper', '2026-05-17T09:00:00Z', true, '{}'::jsonb),
  ((select id from clients where external_id = 'DEMO-1013' limit 1), 'DOC-DEMO-011', 'petrova_application_form.pdf', 'petrova_application_form.pdf', 'application/pdf', 471040, 'application_form', 'uploaded', 'demo', 'demo-clients', 'demo/clients/DEMO-1013/application_form.pdf', 'user-daniel', 'Daniel Cooper', '2026-05-16T13:20:00Z', true, '{}'::jsonb),
  ((select id from clients where external_id = 'DEMO-1015' limit 1), 'DOC-DEMO-012', 'larsen_utility_bill.pdf', 'larsen_utility_bill.pdf', 'application/pdf', 98304, 'proof_of_address', 'missing', 'demo', 'demo-clients', 'demo/clients/DEMO-1015/utility_bill.pdf', 'user-lucas', 'Lucas Martin', '2026-05-15T12:00:00Z', true, '{}'::jsonb),
  ((select id from clients where external_id = 'DEMO-1021' limit 1), 'DOC-DEMO-013', 'lin_investment_proof.pdf', 'lin_investment_proof.pdf', 'application/pdf', 1048576, 'other', 'under_review', 'supabase', 'client-docs', 'internal/demo/DEMO-1021/investment_proof.pdf', 'user-emma', 'Emma Wilson', '2026-05-09T10:00:00Z', true, '{}'::jsonb),
  ((select id from clients where external_id = 'DEMO-1022' limit 1), 'DOC-DEMO-014', 'dubois_passport_copy.pdf', 'dubois_passport_copy.pdf', 'application/pdf', 256000, 'passport_copy', 'approved', 'demo', 'demo-clients', 'demo/clients/DEMO-1022/passport_copy.pdf', 'user-daniel', 'Daniel Cooper', '2026-05-08T07:30:00Z', true, '{}'::jsonb),
  ((select id from clients where external_id = 'DEMO-1022' limit 1), 'DOC-DEMO-015', 'dubois_client_questionnaire.pdf', 'dubois_client_questionnaire.pdf', 'application/pdf', 172032, 'client_questionnaire', 'uploaded', 'demo', 'demo-clients', 'demo/clients/DEMO-1022/questionnaire.pdf', 'user-daniel', 'Daniel Cooper', '2026-05-07T15:45:00Z', true, '{}'::jsonb),
  ((select id from clients where external_id = 'DEMO-1025' limit 1), 'DOC-DEMO-016', 'alrashid_consultation_brief.pdf', 'alrashid_consultation_brief.pdf', 'application/pdf', 131072, 'client_questionnaire', 'uploaded', 'demo', 'demo-clients', 'demo/clients/DEMO-1025/consultation_brief.pdf', 'user-emma', 'Emma Wilson', '2026-05-05T09:00:00Z', true, '{}'::jsonb)
on conflict (external_id) do nothing;

-- =============================================================================
-- POST-SEED VERIFICATION (read-only)
-- =============================================================================

SELECT 'POST-SEED' AS phase, now() AT TIME ZONE 'UTC' AS captured_at_utc;

SELECT COUNT(*) AS active_clients_count
FROM clients
WHERE archived_at IS NULL;
-- Ожидаемо: 25

SELECT COUNT(*) AS client_notes_active
FROM client_notes
WHERE archived_at IS NULL;
-- Ожидаемо: >= 10

SELECT COUNT(*) AS client_documents_active
FROM client_documents
WHERE archived_at IS NULL;
-- Ожидаемо: 16

SELECT COUNT(*) AS notes_without_client_uuid
FROM client_notes
WHERE client_uuid IS NULL;
-- Ожидаемо: 0 для demo notes

SELECT COUNT(*) AS orphan_documents
FROM client_documents d
LEFT JOIN clients c ON c.id = d.client_uuid
WHERE c.id IS NULL;
-- Ожидаемо: 0

-- Sample: notes per demo client (DEMO-1001 должен иметь >= 1 note)
SELECT c.external_id, COUNT(n.id) AS notes_count
FROM clients c
LEFT JOIN client_notes n ON n.client_uuid = c.id AND n.archived_at IS NULL
WHERE c.external_id IN ('DEMO-1001', 'DEMO-1002', 'DEMO-1013')
GROUP BY c.external_id
ORDER BY c.external_id;

-- Sample: documents per demo client (DEMO-1001 должен иметь 2 docs)
SELECT c.external_id, COUNT(d.id) AS documents_count
FROM clients c
LEFT JOIN client_documents d ON d.client_uuid = c.id AND d.archived_at IS NULL
WHERE c.external_id IN ('DEMO-1001', 'DEMO-1002', 'DEMO-1025')
GROUP BY c.external_id
ORDER BY c.external_id;
