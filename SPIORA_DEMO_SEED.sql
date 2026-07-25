-- =============================================================================
-- SPIORA — Demo Seed (SQL Editor)
-- =============================================================================
-- CRM clients are intentionally NOT seeded with fictional names.
-- Add real clients from the Clients UI (or INSERT your own rows).
--
-- Modules without SQL seed (Tasks, Calendar, Team Chat, Notifications, AI chats):
-- still initialize from TypeScript demo seeds on first app access.
-- =============================================================================

-- Clear leftover fictional CRM rows if re-run on an older database.
delete from client_documents
where client_uuid in (
  select id from clients where is_demo = true or external_id like 'DEMO-%'
);

delete from client_notes
where client_uuid in (
  select id from clients where is_demo = true or external_id like 'DEMO-%'
)
or client_id like 'DEMO-%'
or is_demo = true;

delete from clients
where is_demo = true or external_id like 'DEMO-%';

-- -----------------------------------------------------------------------------
-- app_state — analytics supplement + formgrid watch (fictional aggregates)
-- -----------------------------------------------------------------------------

insert into app_state (key, value)
values (
  'analytics_croatia_supplement',
  '{
    "visaD": [
      {"consulate": "Demo Consulate A", "submitted": 24, "approved": 20, "rejected": 4, "avgProcessingDays": 38},
      {"consulate": "Demo Consulate B", "submitted": 11, "approved": 9, "rejected": 2, "avgProcessingDays": 42},
      {"consulate": "Demo Consulate C", "submitted": 6, "approved": 5, "rejected": 1, "avgProcessingDays": 45}
    ]
  }'::jsonb
)
on conflict (key) do nothing;

insert into app_state (key, value)
values ('formgrid_known_leads', '{"initialized": false, "rowKeys": []}'::jsonb)
on conflict (key) do nothing;

-- =============================================================================
-- VERIFICATION (read-only) — после seed
-- =============================================================================

-- 1. Demo CRM clients should be 0
SELECT COUNT(*) AS demo_clients_count
FROM clients
WHERE is_demo = true
  AND archived_at IS NULL;

-- 2. app_state keys
SELECT key, jsonb_typeof(value) AS value_type
FROM app_state
WHERE key IN ('analytics_croatia_supplement', 'formgrid_known_leads')
ORDER BY key;
