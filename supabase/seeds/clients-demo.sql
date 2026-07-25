-- CRM clients seed intentionally empty.
-- Demo John Carter / Sofia Martins / … names were removed so operators can add real clients.
-- Do not re-insert fictional DEMO-* clients here.

-- Optional: clear leftover demo rows if this file is re-run against an old database.
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
