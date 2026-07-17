import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "025_rls_phase1.sql",
);

const REQUIRED_HELPERS = [
  "current_spiora_profile_id",
  "current_spiora_role",
  "is_active_spiora_user",
  "is_spiora_owner",
  "is_spiora_manager",
  "spiora_rls_phase1_status",
] as const;

const REQUIRED_POLICIES = [
  "rls_p1_user_profiles_select_self",
  "rls_p1_user_profiles_select_owner",
  "rls_p1_user_profiles_select_manager",
  "rls_p1_user_profiles_update_self",
  "rls_p1_user_profiles_update_owner",
  "rls_p1_clients_select_owner_manager",
  "rls_p1_clients_insert_owner_manager",
  "rls_p1_clients_update_owner",
  "rls_p1_clients_update_manager",
  "rls_p1_client_notes_select",
  "rls_p1_client_notes_insert",
  "rls_p1_client_notes_update",
  "rls_p1_client_documents_select",
  "rls_p1_client_documents_insert",
  "rls_p1_client_documents_update_owner",
  "rls_p1_client_documents_update_manager",
] as const;

const RLS_TABLES = [
  "user_profiles",
  "clients",
  "client_notes",
  "client_documents",
] as const;

function readMigration(): string {
  return readFileSync(MIGRATION_PATH, "utf8");
}

describe("RLS Phase 1 policy shape (migration 025)", () => {
  it("содержит helper-функции с SECURITY DEFINER и search_path", () => {
    const sql = readMigration();
    for (const name of REQUIRED_HELPERS) {
      assert.match(sql, new RegExp(`function public\\.${name}\\(`));
    }
    assert.match(sql, /security definer/i);
    assert.match(sql, /set search_path = public/i);
    assert.match(sql, /language sql\s+stable/i);
  });

  it("включает RLS только на четырёх целевых таблицах", () => {
    const sql = readMigration();
    for (const table of RLS_TABLES) {
      assert.match(
        sql,
        new RegExp(`alter table public\\.${table} enable row level security`, "i"),
      );
    }
    assert.doesNotMatch(sql, /force row level security/i);
  });

  it("создаёт все ожидаемые policies Phase 1", () => {
    const sql = readMigration();
    for (const policy of REQUIRED_POLICIES) {
      assert.match(sql, new RegExp(`policy ${policy}\\b`));
    }
  });

  it("не даёт permissive catch-all и не грантит anon", () => {
    const sql = readMigration();
    assert.doesNotMatch(sql, /for all\s+using\s*\(\s*true\s*\)/i);
    assert.doesNotMatch(sql, /using\s*\(\s*true\s*\)/i);
    assert.doesNotMatch(sql, /grant\s+.*\s+to\s+anon\b/i);
    assert.match(sql, /revoke all on table public\.user_profiles from anon/i);
    assert.match(sql, /revoke all on table public\.clients from anon/i);
    assert.match(sql, /revoke all on table public\.client_notes from anon/i);
    assert.match(sql, /revoke all on table public\.client_documents from anon/i);
  });

  it("не использует legacy client_id как security boundary", () => {
    const sql = readMigration();
    const policyBodies = sql
      .split(/create policy/i)
      .slice(1)
      .join("\n");
    assert.doesNotMatch(policyBodies, /client_notes\.client_id|cn\.client_id/i);
    assert.match(sql, /client_uuid/);
  });

  it("не использует assigned_manager_name как security boundary", () => {
    const sql = readMigration();
    const withoutComments = sql.replace(/--.*$/gm, "");
    assert.doesNotMatch(withoutComments, /assigned_manager_name/i);
  });

  it("manager не может архивировать documents (archived_at must stay null)", () => {
    const sql = readMigration();
    assert.match(
      sql,
      /rls_p1_client_documents_update_manager[\s\S]*archived_at is null[\s\S]*archived_at is null/,
    );
  });

  it("manager не может архивировать clients через update policy", () => {
    const sql = readMigration();
    assert.match(
      sql,
      /rls_p1_clients_update_manager[\s\S]*archived_at is null[\s\S]*archived_at is null/,
    );
  });

  it("защищает last active owner и привилегированные поля профиля", () => {
    const sql = readMigration();
    assert.match(sql, /last active owner/i);
    assert.match(sql, /user_profiles_guard_sensitive_update/);
    assert.match(sql, /privileged profile fields are owner-only/);
  });

  it("блокирует hard delete для non-service_role", () => {
    const sql = readMigration();
    assert.match(sql, /spiora_block_hard_delete/);
    assert.match(sql, /hard delete denied/i);
  });

  it("не содержит secrets и seed UUID", () => {
    const sql = readMigration();
    assert.doesNotMatch(sql, /sb_publishable_|sb_secret_|service_role_key\s*=/i);
    assert.doesNotMatch(sql, /eyJ[A-Za-z0-9_-]{20,}/);
    assert.doesNotMatch(sql, /0fc76f12-892f|password\s*=/i);
  });

  it("rollback patch снимает только Phase 1 artifacts", () => {
    const rollback = readFileSync(
      path.join(process.cwd(), "SPIORA_SUPABASE_PATCH_025_RLS_ROLLBACK.sql"),
      "utf8",
    );
    assert.match(rollback, /disable row level security/i);
    assert.match(rollback, /drop policy if exists rls_p1_/i);
    assert.doesNotMatch(rollback, /drop table/i);
    assert.doesNotMatch(rollback, /delete from user_profiles/i);
    assert.doesNotMatch(rollback, /auth\.users/i);
  });
});
