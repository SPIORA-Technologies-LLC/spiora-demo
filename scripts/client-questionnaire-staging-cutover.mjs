/**
 * Staging cutover + smoke for client questionnaires (migration 033).
 * Does not print secrets, passwords, service keys, or full UUIDs.
 *
 * Usage (from repo root, with .env.local configured):
 *   $env:NODE_OPTIONS='--use-system-ca'
 *   node --experimental-strip-types --experimental-specifier-resolution=node --import ./scripts/test-register.mjs scripts/client-questionnaire-staging-cutover.mjs preflight
 *   node --experimental-strip-types --experimental-specifier-resolution=node --import ./scripts/test-register.mjs scripts/client-questionnaire-staging-cutover.mjs apply
 *   node --experimental-strip-types --experimental-specifier-resolution=node --import ./scripts/test-register.mjs scripts/client-questionnaire-staging-cutover.mjs verify
 *   node --experimental-strip-types --experimental-specifier-resolution=node --import ./scripts/test-register.mjs scripts/client-questionnaire-staging-cutover.mjs smoke
 *   node --experimental-strip-types --experimental-specifier-resolution=node --import ./scripts/test-register.mjs scripts/client-questionnaire-staging-cutover.mjs all
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const PATCH_FILE = "SPIORA_SUPABASE_PATCH_033_CLIENT_QUESTIONNAIRES.sql";
const EXPECTED_HASH =
  "222a220a4f8ef5ddbdca34849ef57145208425060a9dfc12b5668132d40a24ac";

function maskId(id) {
  if (!id || typeof id !== "string") return "<none>";
  if (id.length < 12) return "<short>";
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

function sha256Hex(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function anonClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
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
    // caller validates required vars
  }
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function extractProjectRef(url) {
  const match = url.trim().match(/^https:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return match?.[1] ?? null;
}

function admin() {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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
  const checks = {};
  for (const table of ["client_invitations", "client_portal_users"]) {
    checks[table] = (await tableExists(sb, table)) ? "present" : "missing";
  }

  const targets = [
    "questionnaire_templates",
    "questionnaire_template_versions",
    "client_questionnaires",
  ];
  let presentTargets = 0;
  for (const table of targets) {
    if (await tableExists(sb, table)) presentTargets += 1;
  }

  const reasons = [];
  if (Object.values(checks).includes("missing")) reasons.push("missing_pr30_tables");
  if (presentTargets > 0 && presentTargets < 3) {
    reasons.push("partial_questionnaire_schema_present");
  }

  return {
    ok: reasons.length === 0,
    result:
      presentTargets === 3 && reasons.length === 0
        ? "ALREADY_APPLIED"
        : reasons.length === 0
          ? "READY_TO_APPLY"
          : "NOT_READY",
    checks,
    presentTargets,
    reasons,
  };
}

async function verify() {
  const sb = admin();
  const tables = [
    "questionnaire_templates",
    "questionnaire_template_versions",
    "client_questionnaires",
  ];
  const checks = {};
  for (const table of tables) {
    checks[table] = (await tableExists(sb, table)) ? "present" : "missing";
  }

  let tmpl = null;
  let version = null;
  if (checks.questionnaire_templates === "present") {
    const { data } = await sb
      .from("questionnaire_templates")
      .select("id, template_key, status")
      .eq("template_key", "general_client_onboarding")
      .maybeSingle();
    tmpl = data ?? null;
  }
  if (checks.questionnaire_template_versions === "present" && tmpl?.id) {
    const { data } = await sb
      .from("questionnaire_template_versions")
      .select("id, version, schema_hash, status")
      .eq("template_id", tmpl.id)
      .eq("version", 1)
      .maybeSingle();
    version = data ?? null;
  }

  const hashOk = version?.schema_hash === EXPECTED_HASH;
  const publishedOk =
    tmpl?.status === "published" && version?.status === "published";
  const ok =
    Object.values(checks).every((v) => v === "present") &&
    Boolean(tmpl) &&
    Boolean(version) &&
    publishedOk &&
    hashOk;

  return {
    ok,
    result: ok ? "VALIDATED_OK" : "VALIDATION_FAILED",
    checks,
    template: tmpl
      ? { key: tmpl.template_key, status: tmpl.status }
      : null,
    version: version
      ? {
          version: version.version,
          status: version.status,
          hashOk,
        }
      : null,
    hashOk,
  };
}

async function applyMigration() {
  const patchPath = path.join(root, PATCH_FILE);
  const sql = readFileSync(patchPath, "utf8");
  const before = await preflight();
  if (before.result === "ALREADY_APPLIED") {
    const after = await verify();
    return {
      ok: after.ok,
      action: "skipped-already-applied",
      before,
      after,
    };
  }
  if (before.result === "NOT_READY") {
    return { ok: false, action: "blocked-not-ready", before };
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
      return {
        ok: false,
        action: "needs-manual-sql-editor",
        before,
        detail: String(detail).slice(0, 400),
        instruction:
          "Set SUPABASE_DB_URL or SUPABASE_ACCESS_TOKEN, or apply SPIORA_SUPABASE_PATCH_033_CLIENT_QUESTIONNAIRES.sql in Supabase SQL Editor, then re-run verify/smoke.",
      };
    }
  }

  // Give PostgREST a moment to refresh schema cache after DDL.
  await new Promise((r) => setTimeout(r, 1500));
  const after = await verify();
  return {
    ok: after.ok,
    action: "applied",
    appliedVia,
    before,
    after,
  };
}

async function smoke() {
  const result = await verify();
  const checks = {
    schema: result.ok ? "pass" : "fail",
    publishedVersionExists: result.template && result.version ? "pass" : "fail",
    schemaHash: result.hashOk ? "pass" : "fail",
  };
  const errors = [];
  const temporary = {
    emails: [],
    invitationIds: [],
    portalUserIds: [],
    questionnaireIds: [],
    authUserIds: [],
  };
  const cleanup = {
    questionnairesArchived: false,
    invitationsRevoked: false,
    authUsersDeleted: false,
    notes: [],
  };

  if (!result.ok) {
    errors.push("Questionnaire schema missing or invalid on staging");
    return { ok: false, checks, errors, temporary, cleanup };
  }

  const sb = admin();
  const stamp = Date.now();
  const password = `Smoke033!${stamp}`;

  const { data: profiles, error: profilesErr } = await sb
    .from("user_profiles")
    .select("id, role, status, archived_at")
    .in("role", ["owner", "manager"])
    .eq("status", "active")
    .is("archived_at", null);
  if (profilesErr) throw profilesErr;
  const owner = (profiles ?? []).find((p) => p.role === "owner") ?? profiles?.[0];
  const manager =
    (profiles ?? []).find((p) => p.role === "manager") ?? owner;
  if (!owner?.id || !manager?.id) {
    return {
      ok: false,
      checks,
      errors: ["No active owner/manager profiles for smoke invitations"],
      temporary,
      cleanup,
    };
  }

  const { data: versionRow, error: versionErr } = await sb
    .from("questionnaire_template_versions")
    .select("id, schema_hash, status, version")
    .eq("status", "published")
    .eq("version", 1)
    .limit(1)
    .maybeSingle();
  if (versionErr || !versionRow) {
    errors.push("published version lookup failed");
    return { ok: false, checks, errors, temporary, cleanup };
  }
  checks.templateVersion = "pass";
  checks.schemaHashExact =
    versionRow.schema_hash === EXPECTED_HASH ? "pass" : "fail";
  if (checks.schemaHashExact === "fail") errors.push("schema hash mismatch");

  try {
    const clients = {};
    for (const label of ["A", "B"]) {
      const email = `q-smoke-${label.toLowerCase()}-${stamp}@example.com`;
      temporary.emails.push(email);

      const { data: createdAuth, error: authErr } =
        await sb.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
      if (authErr || !createdAuth?.user?.id) {
        throw new Error(`auth user ${label}: ${authErr?.message || "missing"}`);
      }
      const authUserId = createdAuth.user.id;
      temporary.authUserIds.push(authUserId);

      const { data: inv, error: invErr } = await sb
        .from("client_invitations")
        .insert({
          email,
          token_hash: sha256Hex(`smoke033_${label}_${stamp}`),
          preferred_locale: "en",
          service_type: "consultation",
          assigned_to: manager.id,
          questionnaire_template_key: "general_client_onboarding",
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
          created_by: owner.id,
          create_request_id: `smoke033-${label}-${stamp}`,
          accepted_at: new Date().toISOString(),
          accepted_by_user_id: authUserId,
        })
        .select("id, questionnaire_template_key")
        .single();
      if (invErr) throw new Error(`invite ${label}: ${invErr.message}`);
      temporary.invitationIds.push(inv.id);
      if (inv.questionnaire_template_key !== "general_client_onboarding") {
        throw new Error(`template binding missing for ${label}`);
      }

      const { data: portal, error: portalErr } = await sb
        .from("client_portal_users")
        .insert({
          auth_user_id: authUserId,
          email,
          preferred_locale: "en",
          invitation_id: inv.id,
        })
        .select("id")
        .single();
      if (portalErr) throw new Error(`portal ${label}: ${portalErr.message}`);
      temporary.portalUserIds.push(portal.id);

      const { data: beforeDraft } = await sb
        .from("client_questionnaires")
        .select("id")
        .eq("invitation_id", inv.id)
        .is("archived_at", null)
        .maybeSingle();
      if (beforeDraft) throw new Error(`unexpected draft before edit for ${label}`);

      const { data: draft, error: draftErr } = await sb
        .from("client_questionnaires")
        .insert({
          client_portal_user_id: portal.id,
          invitation_id: inv.id,
          template_version_id: versionRow.id,
          status: "draft",
          answers: { first_name: label === "A" ? "Alice" : "Bob" },
          revision: 1,
          started_at: new Date().toISOString(),
          last_saved_at: new Date().toISOString(),
        })
        .select("id, revision, answers, template_version_id")
        .single();
      if (draftErr) throw new Error(`draft ${label}: ${draftErr.message}`);
      temporary.questionnaireIds.push(draft.id);
      if (draft.template_version_id !== versionRow.id) {
        throw new Error(`immutable binding broken for ${label}`);
      }
      clients[label] = {
        email,
        authUserId,
        invitationId: inv.id,
        portalUserId: portal.id,
        questionnaireId: draft.id,
      };
    }

    checks.draftCreateA = "pass";
    checks.draftCreateB = "pass";
    checks.templateBinding = "pass";
    checks.noEmptyDraftOnOpen = "pass";

    // Lifecycle on A
    {
      const draftId = clients.A.questionnaireId;
      const { data: updated, error: updErr } = await sb
        .from("client_questionnaires")
        .update({
          answers: { first_name: "Alice", last_name: "Smoke" },
          revision: 2,
          last_saved_at: new Date().toISOString(),
        })
        .eq("id", draftId)
        .eq("revision", 1)
        .select("id, revision")
        .maybeSingle();
      if (updErr || !updated || updated.revision !== 2) {
        throw new Error("revision increment failed");
      }
      checks.revisionIncrement = "pass";

      const { data: stale } = await sb
        .from("client_questionnaires")
        .update({
          answers: { first_name: "Stale" },
          revision: 3,
        })
        .eq("id", draftId)
        .eq("revision", 1)
        .select("id")
        .maybeSingle();
      checks.staleRevisionConflict = stale ? "fail" : "pass";
      if (stale) errors.push("stale revision unexpectedly succeeded");

      const { data: cleared, error: clearErr } = await sb
        .from("client_questionnaires")
        .update({
          answers: { first_name: "Alice" },
          revision: 3,
        })
        .eq("id", draftId)
        .eq("revision", 2)
        .select("answers, revision")
        .maybeSingle();
      if (clearErr || !cleared || "last_name" in (cleared.answers || {})) {
        throw new Error("clear semantics failed");
      }
      checks.clearOperation = "pass";

      const { data: reviewed, error: reviewErr } = await sb
        .from("client_questionnaires")
        .update({
          status: "in_review",
          reviewed_at: new Date().toISOString(),
          revision: 4,
        })
        .eq("id", draftId)
        .eq("revision", 3)
        .select("status, revision")
        .maybeSingle();
      if (reviewErr || reviewed?.status !== "in_review") {
        throw new Error("review transition failed");
      }
      checks.review = "pass";

      const { data: reopened, error: reopenErr } = await sb
        .from("client_questionnaires")
        .update({
          status: "draft",
          reviewed_at: null,
          revision: 5,
        })
        .eq("id", draftId)
        .eq("revision", 4)
        .select("status, revision")
        .maybeSingle();
      if (reopenErr || reopened?.status !== "draft") {
        throw new Error("reopen transition failed");
      }
      checks.reopen = "pass";
    }

    const { error: dupErr } = await sb.from("client_questionnaires").insert({
      client_portal_user_id: clients.A.portalUserId,
      invitation_id: clients.A.invitationId,
      template_version_id: versionRow.id,
      status: "draft",
      answers: { first_name: "Dup" },
      revision: 1,
    });
    checks.noDuplicateDraft = dupErr ? "pass" : "fail";
    if (!dupErr) errors.push("duplicate draft was allowed");

    // Authenticated RLS isolation (anon key + user JWTs)
    const clientA = anonClient();
    const clientB = anonClient();
    const signA = await clientA.auth.signInWithPassword({
      email: clients.A.email,
      password,
    });
    const signB = await clientB.auth.signInWithPassword({
      email: clients.B.email,
      password,
    });
    if (signA.error || signB.error) {
      throw new Error(
        `auth sign-in failed: ${signA.error?.message || signB.error?.message}`,
      );
    }
    checks.authenticatedSignIn = "pass";

    const { data: ownA, error: ownAErr } = await clientA
      .from("client_questionnaires")
      .select("id, answers")
      .eq("id", clients.A.questionnaireId)
      .maybeSingle();
    if (ownAErr || !ownA) {
      throw new Error(`client A cannot read own questionnaire: ${ownAErr?.message}`);
    }
    checks.rlsOwnReadA = "pass";

    const { data: crossRead, error: crossReadErr } = await clientA
      .from("client_questionnaires")
      .select("id, answers")
      .eq("id", clients.B.questionnaireId)
      .maybeSingle();
    // RLS should hide the row (null data, typically no error)
    if (crossRead) {
      checks.rlsCrossReadDenied = "fail";
      errors.push("client A could read client B questionnaire");
    } else {
      checks.rlsCrossReadDenied = "pass";
    }
    checks.rlsCrossReadErrorCode = crossReadErr?.code || null;

    const { data: crossUpdate, error: crossUpdateErr } = await clientA
      .from("client_questionnaires")
      .update({
        answers: { first_name: "Hacked" },
        revision: 99,
      })
      .eq("id", clients.B.questionnaireId)
      .select("id")
      .maybeSingle();
    if (crossUpdate) {
      checks.rlsCrossUpdateDenied = "fail";
      errors.push("client A could update client B questionnaire");
    } else {
      checks.rlsCrossUpdateDenied = "pass";
    }
    checks.rlsCrossUpdateErrorCode = crossUpdateErr?.code || null;

    const { data: ownB } = await clientB
      .from("client_questionnaires")
      .select("id")
      .eq("id", clients.B.questionnaireId)
      .maybeSingle();
    checks.rlsOwnReadB = ownB ? "pass" : "fail";
    if (!ownB) errors.push("client B cannot read own questionnaire");

    const { data: pubTemplates, error: tmplErr } = await clientA
      .from("questionnaire_templates")
      .select("template_key, status")
      .eq("template_key", "general_client_onboarding");
    checks.rlsPublishedTemplateVisible =
      !tmplErr && (pubTemplates || []).some((t) => t.status === "published")
        ? "pass"
        : "fail";
    if (checks.rlsPublishedTemplateVisible !== "pass") {
      errors.push("authenticated client cannot see published template");
    }

    temporary.masked = {
      invitationA: maskId(clients.A.invitationId),
      invitationB: maskId(clients.B.invitationId),
      questionnaireA: maskId(clients.A.questionnaireId),
      questionnaireB: maskId(clients.B.questionnaireId),
      authA: maskId(clients.A.authUserId),
      authB: maskId(clients.B.authUserId),
    };
  } catch (error) {
    errors.push(String(error));
  } finally {
    // Hard deletes are blocked by triggers — soft-clean only.
    if (temporary.questionnaireIds.length) {
      const { error } = await sb
        .from("client_questionnaires")
        .update({
          status: "archived",
          archived_at: new Date().toISOString(),
        })
        .in("id", temporary.questionnaireIds);
      cleanup.questionnairesArchived = !error;
      if (error) cleanup.notes.push(`archive questionnaires: ${error.message}`);
    }
    if (temporary.invitationIds.length) {
      const { error } = await sb
        .from("client_invitations")
        .update({ revoked_at: new Date().toISOString() })
        .in("id", temporary.invitationIds)
        .is("revoked_at", null);
      // accepted invitations may reject revoke via check constraint
      if (error) {
        cleanup.notes.push(`invite revoke skipped/failed: ${error.message}`);
        cleanup.invitationsRevoked = false;
      } else {
        cleanup.invitationsRevoked = true;
      }
    }
    let authDeleted = 0;
    for (const authUserId of temporary.authUserIds) {
      const { error } = await sb.auth.admin.deleteUser(authUserId);
      if (!error) authDeleted += 1;
      else cleanup.notes.push(`auth delete ${maskId(authUserId)}: ${error.message}`);
    }
    cleanup.authUsersDeleted = authDeleted === temporary.authUserIds.length;
    cleanup.portalUsersResidual =
      "portal users retained (hard-delete protected); invitations may remain accepted";
    checks.cleanup = cleanup.questionnairesArchived ? "soft-cleaned" : "partial";
  }

  return {
    ok: errors.length === 0,
    checks,
    errors,
    temporary: {
      emails: temporary.emails,
      masked: temporary.masked || null,
      counts: {
        invitations: temporary.invitationIds.length,
        portalUsers: temporary.portalUserIds.length,
        questionnaires: temporary.questionnaireIds.length,
        authUsers: temporary.authUserIds.length,
      },
    },
    cleanup,
  };
}

async function main() {
  loadEnvLocal();
  const mode = process.argv[2] ?? "all";
  const out = { mode, ok: true };

  if (mode === "preflight" || mode === "all") out.preflight = await preflight();
  if (mode === "apply") out.apply = await applyMigration();
  if (mode === "verify" || mode === "all") out.verify = await verify();
  if (mode === "smoke" || mode === "all") out.smoke = await smoke();

  if (mode === "all") {
    out.note =
      "Mode 'all' runs preflight/verify/smoke only. Use mode 'apply' or SQL Editor for DDL.";
  }

  out.ok =
    (out.preflight?.ok ?? true) &&
    (out.apply?.ok ?? true) &&
    (out.verify?.ok ?? true) &&
    (out.smoke?.ok ?? true);

  console.log(JSON.stringify(out, null, 2));
  if (!out.ok) process.exit(1);
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error) }));
  process.exit(1);
});
