-- Meeting recordings — private Storage bucket
-- Required when SPIORA_ENABLE_SUPABASE=true and LiveKit egress writes via server.
--
-- Access model (same as buckets in 004/006/007/008):
--   • bucket public = false
--   • no anon/authenticated policies → no direct client access
--   • Next.js API uses service_role (bypasses storage RLS)
--   • owner/manager RBAC enforced in app layer:
--     src/lib/calendar/meeting-recording-access.ts
--
-- LiveKit remains gated by SPIORA_ENABLE_LIVEKIT (off in default demo).

insert into storage.buckets (id, name, public)
values ('meeting-recordings', 'meeting-recordings', false)
on conflict (id) do update
  set public = excluded.public,
      name = excluded.name;

-- Minimal policy: document service_role scope only.
-- service_role bypasses RLS; policy exists for auditability and future tooling.
drop policy if exists "meeting_recordings_service_role_all" on storage.objects;

create policy "meeting_recordings_service_role_all"
  on storage.objects
  for all
  to service_role
  using (bucket_id = 'meeting-recordings')
  with check (bucket_id = 'meeting-recordings');
