/**
 * Staging cutover + smoke for client invitations (migration 032).
 * Does not print secrets, passwords, service keys, or full UUIDs.
 *
 * Usage (from repo root, with .env.local configured):
 *   $env:NODE_OPTIONS='--use-system-ca'   # Windows: required for Node TLS to Supabase
 *   node --experimental-strip-types --experimental-specifier-resolution=node scripts/client-invitations-staging-cutover.mjs apply
 *   node --experimental-strip-types --experimental-specifier-resolution=node scripts/client-invitations-staging-cutover.mjs verify-schema
 *   node --experimental-strip-types --experimental-specifier-resolution=node --import ./scripts/test-register.mjs scripts/client-invitations-staging-cutover.mjs smoke
 *   node --experimental-strip-types --experimental-specifier-resolution=node scripts/client-invitations-staging-cutover.mjs all
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();

function loadEnvLocal() {
  try {
    const raw = readFileSync(path.join(root, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      process.env[key] = value;
    }
  } catch {
    // caller validates required vars
  }
}

function maskId(id) {
  if (!id || typeof id !== "string") return "<none>";
  if (id.length < 12) return "<short>";
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

function extractProjectRef(url) {
  const match = url.trim().match(/^https:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return match?.[1] ?? null;
}

function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getAdminClient() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const EXPECTED_COLUMNS = [
  "id",
  "email",
  "token_hash",
  "preferred_locale",
  "service_type",
  "assigned_to",
  "expires_at",
  "created_by",
];

async function tableExists(admin, tableName) {
  const { error } = await admin.from(tableName).select("id").limit(1);
  if (!error) return true;
  const msg = error.message.toLowerCase();
  if (
    msg.includes("does not exist") ||
    msg.includes("schema cache") ||
    error.code === "42P01"
  ) {
    return false;
  }
  throw new Error(`Unexpected error probing ${tableName}: ${error.message}`);
}

async function verifySchema(admin) {
  const report = {
    ok: true,
    tables: {},
    columns: {},
    errors: [],
  };

  for (const table of ["client_invitations", "client_portal_users"]) {
    const exists = await tableExists(admin, table);
    report.tables[table] = exists ? "present" : "missing";
    if (!exists) {
      report.ok = false;
      report.errors.push(`table missing: ${table}`);
    }
  }

  if (report.tables.client_invitations === "present") {
    const { error } = await admin
      .from("client_invitations")
      .select(
        "id, email, token_hash, preferred_locale, service_type, assigned_to, expires_at, created_by",
      )
      .limit(1);
    if (error) {
      report.ok = false;
      report.errors.push(`client_invitations select failed: ${error.message}`);
    } else {
      report.columns.client_invitations = "ok";
    }
  }

  return report;
}

async function applyMigration() {
  const patchPath = path.join(
    root,
    "SPIORA_SUPABASE_PATCH_032_CLIENT_INVITATIONS.sql",
  );
  const sql = readFileSync(patchPath, "utf8");
  const admin = getAdminClient();
  const before = await verifySchema(admin);
  if (before.ok) {
    return {
      ok: true,
      action: "skipped-already-applied",
      before,
      after: before,
    };
  }

  const ref =
    extractProjectRef(requireEnv("NEXT_PUBLIC_SUPABASE_URL")) ??
    process.env.SPIORA_ALLOWED_SUPABASE_PROJECT_REFS?.split(/[,;]/)[0]?.trim();

  const dbUrl = process.env.SUPABASE_DB_URL?.trim();
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();

  let appliedVia = null;
  let applyError = null;

  if (dbUrl) {
    const result = spawnSync(
      "npx",
      ["supabase", "db", "query", "--db-url", dbUrl, "-f", patchPath],
      { cwd: root, encoding: "utf8", shell: true },
    );
    if (result.status === 0) {
      appliedVia = "supabase-cli-db-url";
    } else {
      applyError = result.stderr || result.stdout || "db-url apply failed";
    }
  }

  if (!appliedVia && accessToken && ref) {
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${ref}/database/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
      },
    );
    if (res.ok) {
      appliedVia = "management-api";
    } else {
      const body = await res.text();
      applyError = `management-api ${res.status}: ${body.slice(0, 200)}`;
    }
  }

  if (!appliedVia) {
    const linked = spawnSync(
      "npx",
      ["supabase", "db", "query", "--linked", "-f", patchPath],
      { cwd: root, encoding: "utf8", shell: true },
    );
    if (linked.status === 0) {
      appliedVia = "supabase-cli-linked";
    } else {
      const detail = linked.stderr || linked.stdout || applyError;
      throw new Error(
        `Could not apply migration 032. Set SUPABASE_DB_URL or SUPABASE_ACCESS_TOKEN, or run supabase link. Detail: ${String(detail).slice(0, 300)}`,
      );
    }
  }

  const after = await verifySchema(admin);
  if (!after.ok) {
    throw new Error(
      `Migration ran via ${appliedVia} but schema verification failed: ${after.errors.join("; ")}`,
    );
  }

  // Idempotency: second apply should be skipped
  const second = await applyMigration();
  if (second.action !== "skipped-already-applied") {
    throw new Error("Re-apply did not short-circuit as already applied");
  }

  return { ok: true, action: "applied", appliedVia, before, after };
}

async function smokeTests() {
  const report = { ok: true, checks: {}, errors: [] };
  const admin = getAdminClient();
  const env = process.env;

  const schema = await verifySchema(admin);
  report.checks.schema = schema.ok ? "pass" : "fail";
  if (!schema.ok) {
    report.ok = false;
    report.errors.push(...schema.errors);
    return report;
  }

  const { data: profiles, error: profilesErr } = await admin
    .from("user_profiles")
    .select("id, role, status, archived_at, display_name")
    .in("role", ["owner", "manager"])
    .eq("status", "active")
    .is("archived_at", null);
  if (profilesErr) throw profilesErr;

  const { mapSupabaseAssigneeProfiles, createSupabaseInvitationStore } =
    await import("../src/lib/client-portal/invitation-supabase-store.ts");
  const { createClientInvitationCore } = await import(
    "../src/lib/client-portal/invitation-service.ts"
  );
  const { canEmployeeAssignTo } = await import(
    "../src/lib/client-portal/assignee-context.ts"
  );
  const {
    evaluateDemoRegisterAccess,
    isClientPortalDemoAuthEnabledFromEnv,
    resolveClientAuthConfigFromEnv,
  } = await import("../src/lib/client-portal/demo-auth-policy.ts");
  const {
    isDemoRegisterSuccessBody,
    mapDemoRegisterResultToHttp,
    parseDemoRegisterBody,
    validateDemoRegisterCredentials,
    demoRegisterResponseMayLeakSensitiveFields,
  } = await import("../src/lib/client-portal/demo-register-policy.ts");
  const { normalizeInviteEmail } = await import(
    "../src/lib/client-portal/invite-token.ts"
  );

  const assigneePool = mapSupabaseAssigneeProfiles(profiles ?? []);
  if (assigneePool.length === 0) {
    throw new Error("No active owner/manager profiles for assignee smoke");
  }

  const owner =
    assigneePool.find((p) => p.role === "owner") ?? assigneePool[0];
  const manager =
    assigneePool.find((p) => p.role === "manager") ?? owner;

  const store = createSupabaseInvitationStore(admin);
  const assignees = {
    async validate(assigneeId, context) {
      return canEmployeeAssignTo(assigneeId, context, assigneePool);
    },
  };

  const smokeEmail = `smoke-${Date.now()}@example.com`;
  const requestId = `smoke-${Date.now()}`;

  const createOk = await createClientInvitationCore(
    {
      email: smokeEmail,
      preferredLocale: "en",
      serviceType: "consultation",
      assignedTo: manager.id,
      expiresInDays: 7,
      requestId,
      createdBy: owner.id,
      employeeRole: owner.role,
      origin: env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000",
    },
    store,
    assignees,
  );

  if (!createOk.ok) {
    report.ok = false;
    report.errors.push(`create invitation failed: ${createOk.code}`);
  } else {
    report.checks.createWithAssignee = "pass";
    const row = createOk.invitation;
    if (
      row.assignedTo !== manager.id ||
      row.serviceType !== "consultation" ||
      row.preferredLocale !== "en"
    ) {
      report.ok = false;
      report.errors.push("persisted invitation fields mismatch");
    } else {
      report.checks.persistedFields = "pass";
    }
    report.checks.createdInvitation = maskId(row.id);
  }

  const badAssignee = await createClientInvitationCore(
    {
      email: `bad-${Date.now()}@example.com`,
      assignedTo: "00000000-0000-4000-8000-000000000099",
      createdBy: owner.id,
      employeeRole: owner.role,
      origin: "http://localhost:3000",
    },
    store,
    assignees,
  );
  if (badAssignee.ok || badAssignee.code !== "INVALID_ASSIGNEE") {
    report.ok = false;
    report.errors.push("arbitrary assignee UUID was not rejected");
  } else {
    report.checks.rejectArbitraryAssignee = "pass";
  }

  const prevDemo = env.SPIORA_DEMO_MODE;
  env.SPIORA_DEMO_MODE = "false";
  report.checks.productionDemoFlagOff =
    isClientPortalDemoAuthEnabledFromEnv(env) === false ? "pass" : "fail";
  if (report.checks.productionDemoFlagOff !== "pass") {
    report.ok = false;
    report.errors.push("demo auth enabled while SPIORA_DEMO_MODE=false");
  }

  const configOff = resolveClientAuthConfigFromEnv(env);
  if (configOff.skipEmailConfirmation === true) {
    report.ok = false;
    report.errors.push("config exposes skipEmailConfirmation in production mode");
  } else {
    report.checks.productionConfig = "pass";
  }

  const blockedAccess = evaluateDemoRegisterAccess(env);
  const blockedHttp = mapDemoRegisterResultToHttp({
    ok: false,
    code: blockedAccess === "forbidden" ? "DEMO_AUTH_DISABLED" : "REGISTRATION_FAILED",
  });
  if (blockedHttp.status !== 403) {
    report.ok = false;
    report.errors.push(`demo-register not blocked when demo off (${blockedHttp.status})`);
  } else {
    report.checks.demoRegisterBlocked = "pass";
  }

  env.SPIORA_DEMO_MODE = "true";
  if (env.SPIORA_ENABLE_SUPABASE !== "true") {
    env.SPIORA_ENABLE_SUPABASE = "true";
  }
  const demoOn = isClientPortalDemoAuthEnabledFromEnv(env);
  report.checks.demoModeOn = demoOn ? "pass" : "fail";
  if (!demoOn) {
    report.ok = false;
    report.errors.push("demo auth not enabled with SPIORA_DEMO_MODE=true");
  }

  const configOn = resolveClientAuthConfigFromEnv(env);
  if (configOn.skipEmailConfirmation !== true) {
    report.ok = false;
    report.errors.push("config missing skipEmailConfirmation in demo mode");
  } else {
    report.checks.demoConfig = "pass";
  }

  if (evaluateDemoRegisterAccess(env) !== "allowed") {
    report.ok = false;
    report.errors.push("demo-register access policy not allowed in demo mode");
  } else {
    const demoBody = parseDemoRegisterBody({
      email: `demo-smoke-${Date.now()}@example.com`,
      password: "demo-smoke-pass-123",
    });
    if (!demoBody || validateDemoRegisterCredentials(demoBody) !== "ok") {
      report.ok = false;
      report.errors.push("demo-register credential policy rejected valid input");
    } else {
      const email = normalizeInviteEmail(demoBody.email);
      const { error: createError } = await admin.auth.admin.createUser({
        email,
        password: demoBody.password,
        email_confirm: true,
      });

      let registerOk = !createError;
      if (createError) {
        const message = createError.message.toLowerCase();
        const alreadyExists =
          message.includes("already") ||
          message.includes("registered") ||
          message.includes("exists");
        if (alreadyExists) {
          const { data: listed, error: listError } =
            await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
          if (!listError) {
            const existing = listed.users.find(
              (u) => u.email?.trim().toLowerCase() === email,
            );
            if (existing?.id) {
              const { error: updateError } =
                await admin.auth.admin.updateUserById(existing.id, {
                  email_confirm: true,
                  password: demoBody.password,
                });
              registerOk = !updateError;
            }
          }
        }
      }

      const http = mapDemoRegisterResultToHttp(
        registerOk ? { ok: true } : { ok: false, code: "REGISTRATION_FAILED" },
      );
      const bodyText = JSON.stringify(http.body);
      if (demoRegisterResponseMayLeakSensitiveFields(bodyText)) {
        report.ok = false;
        report.errors.push("demo-register response may leak sensitive fields");
      } else if (http.status !== 200 || !isDemoRegisterSuccessBody(http.body)) {
        report.ok = false;
        report.errors.push(`demo-register failed in demo mode (${http.status})`);
      } else {
        report.checks.demoRegisterSuccessShape = "pass";
      }
    }
  }

  env.SPIORA_DEMO_MODE = prevDemo;

  return report;
}

async function main() {
  loadEnvLocal();
  const mode = process.argv[2] ?? "all";
  const out = { mode, ok: true };

  if (mode === "apply" || mode === "all") {
    out.apply = await applyMigration();
    out.ok = out.ok && out.apply.ok;
  }

  if (mode === "verify-schema" || mode === "all") {
    out.schema = await verifySchema(getAdminClient());
    out.ok = out.ok && out.schema.ok;
  }

  if (mode === "smoke" || mode === "all") {
    out.smoke = await smokeTests();
    out.ok = out.ok && out.smoke.ok;
  }

  if (!["apply", "verify-schema", "smoke", "all"].includes(mode)) {
    throw new Error(`Unknown mode: ${mode}`);
  }

  console.log(JSON.stringify(out, null, 2));
  if (!out.ok) process.exit(1);
}

main().catch((error) => {
  console.error(
    JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }),
  );
  process.exit(1);
});
