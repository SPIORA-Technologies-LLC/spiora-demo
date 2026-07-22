import { readFileSync, writeFileSync } from "node:fs";

const mig = readFileSync(
  "supabase/migrations/033_spiora_client_questionnaires.sql",
  "utf8",
);
const match = mig.match(
  /v_schema jsonb := \$json\$([\s\S]*?)\$json\$::jsonb;/,
);
if (!match) {
  throw new Error("Could not extract schema JSON from migration");
}

const schema = match[1];
const hash =
  "222a220a4f8ef5ddbdca34849ef57145208425060a9dfc12b5668132d40a24ac";

const sql = `-- =============================================================================
-- SPIORA_CLIENT_QUESTIONNAIRE_REPAIR_HASH_033.sql
-- One-shot staging repair: fix schema_hash for general_client_onboarding / v1 only.
-- Does NOT modify schema JSON. Does NOT bump version.
-- Idempotent. Manual SQL Editor only.
-- =============================================================================

drop table if exists pg_temp.spiora_repair_033_result;
create temporary table pg_temp.spiora_repair_033_result (
  repair_result text not null
);

do $$
declare
  v_expected_schema_hash constant text := '${hash}';
  v_expected_schema jsonb := $json$${schema}$json$::jsonb;
  v_count integer;
  v_version_id uuid;
  v_status text;
  v_schema jsonb;
  v_hash text;
  v_result text;
  v_updated integer;
begin
  select count(*)
    into v_count
  from public.questionnaire_templates qt
  join public.questionnaire_template_versions qtv
    on qtv.template_id = qt.id
  where qt.template_key = 'general_client_onboarding'
    and qtv.version = 1;

  if v_count = 0 then
    raise exception 'repair_failed_template_version_not_found';
  end if;
  if v_count > 1 then
    raise exception 'repair_failed_multiple_template_versions';
  end if;

  select qtv.id, qtv.status, qtv.schema, qtv.schema_hash
    into v_version_id, v_status, v_schema, v_hash
  from public.questionnaire_templates qt
  join public.questionnaire_template_versions qtv
    on qtv.template_id = qt.id
  where qt.template_key = 'general_client_onboarding'
    and qtv.version = 1;

  if v_status is distinct from 'published' then
    raise exception 'repair_failed_version_not_published';
  end if;

  if v_schema is distinct from v_expected_schema then
    raise exception 'repair_failed_schema_semantic_mismatch';
  end if;

  if v_hash = v_expected_schema_hash then
    v_result := 'ALREADY_REPAIRED';
  else
    -- Published rows are guarded; temporarily disable only this trigger.
    execute 'alter table public.questionnaire_template_versions disable trigger questionnaire_template_versions_guard';

    update public.questionnaire_template_versions
      set schema_hash = v_expected_schema_hash
    where id = v_version_id
      and version = 1
      and status = 'published'
      and schema is not distinct from v_expected_schema;

    get diagnostics v_updated = row_count;

    execute 'alter table public.questionnaire_template_versions enable trigger questionnaire_template_versions_guard';

    if v_updated <> 1 then
      raise exception 'repair_failed_update_did_not_match_row';
    end if;

    v_result := 'REPAIR_APPLIED';
  end if;

  insert into pg_temp.spiora_repair_033_result (repair_result)
  values (v_result);
end;
$$;

select repair_result from pg_temp.spiora_repair_033_result;
`;

writeFileSync("SPIORA_CLIENT_QUESTIONNAIRE_REPAIR_HASH_033.sql", sql);
console.log("wrote SPIORA_CLIENT_QUESTIONNAIRE_REPAIR_HASH_033.sql");
