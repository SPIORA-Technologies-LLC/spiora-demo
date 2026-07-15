-- Demo CRM clients seed (fictional data only). Idempotent via external_id.
-- Run after 023_client_notes_documents.sql. Safe to re-run — skips existing external_id rows.

insert into clients (
  external_id,
  first_name,
  last_name,
  full_name,
  email,
  phone,
  status,
  pipeline_stage,
  assigned_user_id,
  assigned_manager_name,
  country,
  citizenship,
  direction,
  service_type,
  source,
  notes_summary,
  passport_number,
  last_activity_at,
  created_at,
  is_demo
) values
  ('DEMO-1001', 'John', 'Carter', 'John Carter', 'john.carter@example.com', '+000 000 000 001', 'In progress', 'Active case', 'user-daniel', 'Daniel Cooper', 'United States', 'US', 'Portugal', 'Residence permit', 'demo', 'Intro call completed.', 'DEMO-P10001', '2026-05-28', '2026-03-12', true),
  ('DEMO-1002', 'Sofia', 'Martins', 'Sofia Martins', 'sofia.martins@example.com', '+000 000 000 002', 'Consultation', 'Discovery', 'user-emma', 'Emma Wilson', 'Brazil', 'Brazil', 'Spain', 'Consultation', 'demo', 'Document checklist sent.', 'DEMO-P10002', '2026-05-27', '2026-04-05', true),
  ('DEMO-1003', 'Anna', 'Kowalska', 'Anna Kowalska', 'anna.kowalska@example.com', '+000 000 000 003', 'Documents', 'Document prep', 'user-lucas', 'Lucas Martin', 'Poland', 'Poland', 'Croatia', 'Residence permit', 'demo', 'Awaiting passport scan.', 'DEMO-P10003', '2026-05-26', '2026-05-20', true),
  ('DEMO-1004', 'Marco', 'Rossi', 'Marco Rossi', 'marco.rossi@example.com', '+000 000 000 004', 'New', 'Intake', 'user-daniel', 'Daniel Cooper', 'Italy', 'Italy', 'Slovakia', 'Work permit', 'demo', '', 'DEMO-P10004', '2026-05-25', '2026-01-18', true),
  ('DEMO-1005', 'Emily', 'Brown', 'Emily Brown', 'emily.brown@example.com', '+000 000 000 005', 'Completed', 'Closed won', 'user-emma', 'Emma Wilson', 'United Kingdom', 'UK', 'Germany', 'Family reunification', 'demo', 'Case closed successfully.', 'DEMO-P10005', '2026-05-20', '2025-11-10', true),
  ('DEMO-1006', 'Lucas', 'Nguyen', 'Lucas Nguyen', 'lucas.nguyen@example.com', '+000 000 000 006', 'In progress', 'Active case', 'user-lucas', 'Lucas Martin', 'Vietnam', 'Vietnam', 'Portugal', 'D7 visa', 'demo', '', 'DEMO-P10006', '2026-05-24', '2026-02-02', true),
  ('DEMO-1007', 'Elena', 'Fischer', 'Elena Fischer', 'elena.fischer@example.com', '+000 000 000 007', 'Waiting', 'On hold', 'user-daniel', 'Daniel Cooper', 'Germany', 'Germany', 'Croatia', 'Residence permit', 'demo', 'Waiting for embassy slot.', 'DEMO-P10007', '2026-05-23', '2026-02-14', true),
  ('DEMO-1008', 'Tomáš', 'Novák', 'Tomáš Novák', 'tomas.novak@example.com', '+000 000 000 008', 'In progress', 'Active case', 'user-emma', 'Emma Wilson', 'Czech Republic', 'Czech Republic', 'Spain', 'Digital nomad', 'demo', '', 'DEMO-P10008', '2026-05-22', '2026-03-01', true),
  ('DEMO-1009', 'Maria', 'Santos', 'Maria Santos', 'maria.santos@example.com', '+000 000 000 009', 'Consultation', 'Discovery', 'user-lucas', 'Lucas Martin', 'Portugal', 'Portugal', 'Germany', 'Blue Card', 'demo', '', 'DEMO-P10009', '2026-05-21', '2026-03-08', true),
  ('DEMO-1010', 'James', 'Wilson', 'James Wilson', 'james.wilson@example.com', '+000 000 000 010', 'On hold', 'Paused', 'user-olivia', 'Olivia Bennett', 'Canada', 'Canada', 'Portugal', 'Golden visa', 'demo', 'Client requested pause.', 'DEMO-P10010', '2026-05-19', '2026-03-15', true),
  ('DEMO-1011', 'Petra', 'Horvat', 'Petra Horvat', 'petra.horvat@example.com', '+000 000 000 011', 'Completed', 'Closed won', 'user-daniel', 'Daniel Cooper', 'Slovenia', 'Slovenia', 'Croatia', 'Residence permit', 'demo', '', 'DEMO-P10011', '2026-04-15', '2025-12-05', true),
  ('DEMO-1012', 'Yuki', 'Tanaka', 'Yuki Tanaka', 'yuki.tanaka@example.com', '+000 000 000 012', 'New', 'Intake', 'user-emma', 'Emma Wilson', 'Japan', 'Japan', 'Spain', 'Student visa', 'demo', '', 'DEMO-P10012', '2026-05-18', '2026-04-22', true),
  ('DEMO-1013', 'Olga', 'Petrova', 'Olga Petrova', 'olga.petrova@example.com', '+000 000 000 013', 'In progress', 'Active case', 'user-daniel', 'Daniel Cooper', 'Russia', 'Russia', 'Portugal', 'Residence permit', 'demo', 'Financial docs under review.', 'DEMO-P10013', '2026-05-17', '2026-04-01', true),
  ('DEMO-1014', 'Carlos', 'Diaz', 'Carlos Diaz', 'carlos.diaz@example.com', '+000 000 000 014', 'Consultation', 'Discovery', 'user-emma', 'Emma Wilson', 'Argentina', 'Argentina', 'Spain', 'Non-lucrative visa', 'demo', '', 'DEMO-P10014', '2026-05-16', '2026-04-10', true),
  ('DEMO-1015', 'Ingrid', 'Larsen', 'Ingrid Larsen', 'ingrid.larsen@example.com', '+000 000 000 015', 'Documents', 'Document prep', 'user-lucas', 'Lucas Martin', 'Norway', 'Norway', 'Croatia', 'Residence permit', 'demo', '', 'DEMO-P10015', '2026-05-15', '2026-04-12', true),
  ('DEMO-1016', 'Ahmed', 'Hassan', 'Ahmed Hassan', 'ahmed.hassan@example.com', '+000 000 000 016', 'New', 'Intake', 'user-olivia', 'Olivia Bennett', 'Egypt', 'Egypt', 'Portugal', 'Work permit', 'demo', '', 'DEMO-P10016', '2026-05-14', '2026-04-18', true),
  ('DEMO-1017', 'Chloe', 'Martin', 'Chloe Martin', 'chloe.martin@example.com', '+000 000 000 017', 'In progress', 'Active case', 'user-emma', 'Emma Wilson', 'France', 'France', 'Slovakia', 'Business setup', 'demo', '', 'DEMO-P10017', '2026-05-13', '2026-04-20', true),
  ('DEMO-1018', 'Raj', 'Patel', 'Raj Patel', 'raj.patel@example.com', '+000 000 000 018', 'Waiting', 'On hold', 'user-daniel', 'Daniel Cooper', 'India', 'India', 'Germany', 'Skilled worker', 'demo', 'Background check pending.', 'DEMO-P10018', '2026-05-12', '2026-04-22', true),
  ('DEMO-1019', 'Isabella', 'Costa', 'Isabella Costa', 'isabella.costa@example.com', '+000 000 000 019', 'Consultation', 'Discovery', 'user-lucas', 'Lucas Martin', 'Brazil', 'Brazil', 'Portugal', 'Family reunification', 'demo', '', 'DEMO-P10019', '2026-05-11', '2026-04-25', true),
  ('DEMO-1020', 'Henrik', 'Andersen', 'Henrik Andersen', 'henrik.andersen@example.com', '+000 000 000 020', 'Completed', 'Closed won', 'user-olivia', 'Olivia Bennett', 'Denmark', 'Denmark', 'Spain', 'Retirement visa', 'demo', '', 'DEMO-P10020', '2026-05-10', '2026-01-20', true),
  ('DEMO-1021', 'Mei', 'Lin', 'Mei Lin', 'mei.lin@example.com', '+000 000 000 021', 'In progress', 'Active case', 'user-emma', 'Emma Wilson', 'China', 'China', 'Portugal', 'Golden visa', 'demo', '', 'DEMO-P10021', '2026-05-09', '2026-02-28', true),
  ('DEMO-1022', 'Pierre', 'Dubois', 'Pierre Dubois', 'pierre.dubois@example.com', '+000 000 000 022', 'Documents', 'Document prep', 'user-daniel', 'Daniel Cooper', 'Belgium', 'Belgium', 'Croatia', 'Residence permit', 'demo', '', 'DEMO-P10022', '2026-05-08', '2026-03-05', true),
  ('DEMO-1023', 'Nina', 'Schmidt', 'Nina Schmidt', 'nina.schmidt@example.com', '+000 000 000 023', 'On hold', 'Paused', 'user-lucas', 'Lucas Martin', 'Austria', 'Austria', 'Germany', 'EU Blue Card', 'demo', 'Client traveling.', 'DEMO-P10023', '2026-05-07', '2026-03-10', true),
  ('DEMO-1024', 'David', 'O''Connor', 'David O''Connor', 'david.oconnor@example.com', '+000 000 000 024', 'New', 'Intake', 'user-olivia', 'Olivia Bennett', 'Ireland', 'Ireland', 'Spain', 'Digital nomad', 'demo', '', 'DEMO-P10024', '2026-05-06', '2026-03-18', true),
  ('DEMO-1025', 'Fatima', 'Al-Rashid', 'Fatima Al-Rashid', 'fatima.al-rashid@example.com', '+000 000 000 025', 'Consultation', 'Discovery', 'user-emma', 'Emma Wilson', 'UAE', 'UAE', 'Portugal', 'Investment visa', 'demo', 'Initial consultation scheduled.', 'DEMO-P10025', '2026-05-05', '2026-03-22', true)
on conflict (external_id) do nothing;

-- Demo notes + documents (requires migration 023_client_notes_documents.sql)
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
