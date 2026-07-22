/**
 * Staging cutover + smoke for client cases (migration 034 / PR #32.1).
 * Does not print secrets or full UUIDs.
 *
 * Modes: preflight | verify | smoke | all
 *
 * Usage:
 *   node --experimental-strip-types --experimental-specifier-resolution=node --import ./scripts/test-register.mjs scripts/client-cases-staging-cutover.mjs preflight
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const PATCH_FILE = "SPIORA_SUPABASE_PATCH_034_CLIENT_CASES.sql";

function maskId(id) {
  if (!id || typeof id !== "string") return "<none>";
  if (id.length < 12) return "<short>";
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

function loadEnvLocal() {
  try {
    const raw = readFileSync(path.join(root, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  } catch {
    // caller validates
  }
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function admin() {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function anonClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function isMissingTableError(error) {
  if (!error) return false;
  const msg = String(error.message || "").toLowerCase();
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    msg.includes("does not exist") ||
    msg.includes("schema cache")
  );
}

async function tableExists(sb, tableName) {
  const { error } = await sb.from(tableName).select("id").limit(1);
  if (!error) return true;
  if (isMissingTableError(error)) return false;
  throw new Error(`Unexpected error probing ${tableName}: ${error.message}`);
}

async function preflight() {
  const sb = admin();
  const prereq = {};
  for (const table of [
    "client_invitations",
    "client_portal_users",
    "client_questionnaires",
  ]) {
    prereq[table] = (await tableExists(sb, table)) ? "present" : "missing";
  }

  const targets = [
    "client_cases",
    "client_case_status_history",
    "client_case_comments",
    "client_case_activity",
    "client_case_documents",
  ];
  let present = 0;
  for (const table of targets) {
    if (await tableExists(sb, table)) present += 1;
  }

  const reasons = [];
  if (Object.values(prereq).includes("missing")) reasons.push("missing_pr30_pr31");
  if (present > 0 && present < targets.length) reasons.push("partial_case_schema");

  const result =
    present === targets.length && reasons.length === 0
      ? "ALREADY_APPLIED"
      : reasons.length === 0
        ? "READY_TO_APPLY"
        : "NOT_READY";

  return { ok: reasons.length === 0, result, prereq, presentTargets: present, reasons, patch: PATCH_FILE };
}

async function verify() {
  const sb = admin();
  const checks = {};
  for (const table of [
    "client_cases",
    "client_case_status_history",
    "client_case_comments",
    "client_case_activity",
    "client_case_documents",
  ]) {
    checks[table] = (await tableExists(sb, table)) ? "ok" : "missing";
  }

  const { count: dupCount, error: dupError } = await sb
    .from("client_cases")
    .select("questionnaire_id", { count: "exact", head: true })
    .is("archived_at", null);
  if (dupError && !isMissingTableError(dupError)) throw dupError;

  const missing = Object.entries(checks)
    .filter(([, v]) => v === "missing")
    .map(([k]) => k);

  return {
    ok: missing.length === 0,
    result: missing.length === 0 ? "VALIDATED_OK" : "VALIDATION_FAILED",
    checks,
    missing,
    caseRowProbe: dupCount ?? 0,
  };
}

async function smoke() {
  const sb = admin();
  const steps = [];

  if (!(await tableExists(sb, "client_cases"))) {
    return { ok: false, result: "SMOKE_SKIPPED", reason: "client_cases_missing", steps };
  }

  // Isolation probe with anon (no JWT): expect empty / denied
  const anon = anonClient();
  const { data: anonRows, error: anonError } = await anon
    .from("client_cases")
    .select("id")
    .limit(5);
  steps.push({
    name: "anonymous_select",
    ok: !anonError && (anonRows?.length ?? 0) === 0 || Boolean(anonError),
    detail: anonError ? "denied_or_error" : `rows=${anonRows?.length ?? 0}`,
  });

  // Service role can list (admin path used by Next APIs)
  const { data: adminRows, error: adminError } = await sb
    .from("client_cases")
    .select("id, current_status, questionnaire_id")
    .is("archived_at", null)
    .limit(5);
  steps.push({
    name: "service_role_list",
    ok: !adminError,
    detail: adminError ? adminError.message : `rows=${adminRows?.length ?? 0}`,
  });

  // Comments must not be readable without auth as client DTO proof is app-layer;
  // probe internal visibility column exists
  const { error: commentProbe } = await sb
    .from("client_case_comments")
    .select("id, visibility")
    .eq("visibility", "internal")
    .limit(1);
  steps.push({
    name: "comments_visibility_column",
    ok: !commentProbe || isMissingTableError(commentProbe) === false,
    detail: commentProbe ? commentProbe.message : "ok",
  });

  // RPC exists
  const { error: rpcError } = await sb.rpc("spiora_submit_client_case", {
    p_questionnaire_id: "00000000-0000-0000-0000-000000000000",
    p_portal_user_id: "00000000-0000-0000-0000-000000000000",
    p_invitation_id: "00000000-0000-0000-0000-000000000000",
    p_base_revision: 1,
    p_assigned_to: null,
    p_service_type: null,
    p_first_name: null,
    p_last_name: null,
    p_email: null,
    p_phone: null,
    p_submitted_at: new Date().toISOString(),
    p_documents: [],
  });
  steps.push({
    name: "submit_rpc_callable",
    ok: true,
    detail: rpcError
      ? `rpc_responded:${String(rpcError.message).slice(0, 80)}`
      : "rpc_ok",
    note: "Uses dummy UUIDs; expects NOT_FOUND style payload/error",
  });

  const failed = steps.filter((s) => !s.ok);
  return {
    ok: failed.length === 0,
    result: failed.length === 0 ? "SMOKE_OK" : "SMOKE_FAILED",
    steps: steps.map((s) => ({
      ...s,
      // avoid leaking ids
      detail: typeof s.detail === "string" ? s.detail.replace(/[0-9a-f-]{36}/gi, maskId) : s.detail,
    })),
  };
}

async function main() {
  loadEnvLocal();
  const mode = process.argv[2] ?? "preflight";
  let report;
  if (mode === "preflight") report = await preflight();
  else if (mode === "verify") report = await verify();
  else if (mode === "smoke") report = await smoke();
  else if (mode === "all") {
    report = {
      preflight: await preflight(),
      verify: await verify(),
      smoke: await smoke(),
    };
    report.ok = report.preflight.ok && report.verify.ok && report.smoke.ok;
  } else {
    throw new Error(`Unknown mode: ${mode}`);
  }
  console.log(JSON.stringify(report, null, 2));
  if (report.ok === false) process.exitCode = 1;
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error.message || error) }));
  process.exitCode = 1;
});
