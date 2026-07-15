-- Demo CRM clients seed (fictional data only). Idempotent via external_id.
-- Run after 022_clients.sql. Safe to re-run — skips existing external_id rows.

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

-- Demo notes linked by external_id (client_notes.client_id = clients.external_id)
insert into client_notes (id, client_id, author, text, created_at) values
  ('NT-DEMO-1', 'DEMO-1001', 'Daniel Cooper', 'Intro call completed. Client prefers Portugal as primary destination.', '2026-05-27T10:00:00Z'),
  ('NT-DEMO-2', 'DEMO-1002', 'Emma Wilson', 'Document checklist sent for Spain consultation track.', '2026-05-26T14:30:00Z'),
  ('NT-DEMO-3', 'DEMO-1013', 'Daniel Cooper', 'Financial documents received, pending review.', '2026-05-17T09:15:00Z')
on conflict (id) do nothing;
