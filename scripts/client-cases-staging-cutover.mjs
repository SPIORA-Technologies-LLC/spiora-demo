/**
 * Staging cutover + smoke for client cases (migration 034 / PR #32.1).
 * Does not print secrets or full UUIDs.
 *
 * Modes: preflight | verify | smoke | all
 *
 * Usage:
 *   node --experimental-strip-types --experimental-specifier-resolution=node --import ./scripts/test-register.mjs scripts/client-cases-staging-cutover.mjs smoke
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const PATCH_FILE = "SPIORA_SUPABASE_PATCH_034_CLIENT_CASES.sql";
const BUCKET = "task-attachments";

function maskId(id) {
  if (!id || typeof id !== "string") return "<none>";
  if (id.length < 12) return "<short>";
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

function sha256Hex(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
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

function passFail(ok) {
  return ok ? "pass" : "fail";
}

async function smoke() {
  const schema = await verify();
  const checks = {
    schema: passFail(schema.ok),
  };
  const errors = [];
  const temporary = {
    emails: [],
    invitationIds: [],
    portalUserIds: [],
    questionnaireIds: [],
    caseIds: [],
    authUserIds: [],
    storagePaths: [],
    commentIds: [],
    documentIds: [],
  };
  const cleanup = {
    documentsArchived: false,
    storageRemoved: false,
    casesArchived: false,
    questionnairesArchived: false,
    invitationsRevoked: false,
    authUsersDeleted: false,
    notes: [],
  };

  if (!schema.ok) {
    errors.push("Case schema missing on staging");
    return { ok: false, result: "SMOKE_FAILED", checks, errors, temporary, cleanup };
  }

  const sb = admin();
  const stamp = Date.now();
  const password = `Smoke034!${stamp}`;

  const { data: profiles, error: profilesErr } = await sb
    .from("user_profiles")
    .select("id, role, status, archived_at, display_name")
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
      result: "SMOKE_FAILED",
      checks,
      errors: ["No active owner/manager profiles for smoke"],
      temporary,
      cleanup,
    };
  }

  const { data: versionRow, error: versionErr } = await sb
    .from("questionnaire_template_versions")
    .select("id, status, version")
    .eq("status", "published")
    .eq("version", 1)
    .limit(1)
    .maybeSingle();
  if (versionErr || !versionRow) {
    errors.push("published questionnaire version missing");
    return { ok: false, result: "SMOKE_FAILED", checks, errors, temporary, cleanup };
  }

  // Anon baseline
  {
    const anon = anonClient();
    const { data: anonRows, error: anonError } = await anon
      .from("client_cases")
      .select("id")
      .limit(5);
    checks.anonymousSelectDenied = passFail(
      Boolean(anonError) || (anonRows?.length ?? 0) === 0,
    );
    if (checks.anonymousSelectDenied === "fail") {
      errors.push("anonymous could list cases");
    }
  }

  const clients = {};

  try {
    for (const label of ["A", "B"]) {
      const email = `case-smoke-${label.toLowerCase()}-${stamp}@example.com`;
      temporary.emails.push(email);

      const { data: createdAuth, error: authErr } = await sb.auth.admin.createUser({
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
          token_hash: sha256Hex(`smoke034_${label}_${stamp}`),
          preferred_locale: "en",
          service_type: "consultation",
          assigned_to: manager.id,
          questionnaire_template_key: "general_client_onboarding",
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
          created_by: owner.id,
          create_request_id: `smoke034-${label}-${stamp}`,
          accepted_at: new Date().toISOString(),
          accepted_by_user_id: authUserId,
        })
        .select("id")
        .single();
      if (invErr) throw new Error(`invite ${label}: ${invErr.message}`);
      temporary.invitationIds.push(inv.id);

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

      const { data: draft, error: draftErr } = await sb
        .from("client_questionnaires")
        .insert({
          client_portal_user_id: portal.id,
          invitation_id: inv.id,
          template_version_id: versionRow.id,
          status: "draft",
          answers: {
            first_name: label === "A" ? "Alice" : "Bob",
            last_name: "CaseSmoke",
            email,
            phone: "+1000000000",
            service_goal: "consultation",
          },
          revision: 1,
          started_at: new Date().toISOString(),
          last_saved_at: new Date().toISOString(),
        })
        .select("id, revision")
        .single();
      if (draftErr) throw new Error(`draft ${label}: ${draftErr.message}`);
      temporary.questionnaireIds.push(draft.id);

      clients[label] = {
        email,
        authUserId,
        invitationId: inv.id,
        portalUserId: portal.id,
        questionnaireId: draft.id,
        revision: draft.revision,
      };
    }
    checks.fixturesCreated = "pass";

    // Atomic submit for A and B
    for (const label of ["A", "B"]) {
      const c = clients[label];
      const { data: rpcData, error: rpcErr } = await sb.rpc("spiora_submit_client_case", {
        p_questionnaire_id: c.questionnaireId,
        p_portal_user_id: c.portalUserId,
        p_invitation_id: c.invitationId,
        p_base_revision: c.revision,
        p_assigned_to: manager.id,
        p_service_type: "consultation",
        p_first_name: label === "A" ? "Alice" : "Bob",
        p_last_name: "CaseSmoke",
        p_email: c.email,
        p_phone: "+1000000000",
        p_submitted_at: new Date().toISOString(),
        p_documents: [],
      });
      if (rpcErr) throw new Error(`submit ${label}: ${rpcErr.message}`);
      const payload = rpcData;
      if (!payload?.ok || !payload.case_id) {
        throw new Error(`submit ${label} payload: ${JSON.stringify(payload)}`);
      }
      c.caseId = payload.case_id;
      temporary.caseIds.push(payload.case_id);
      checks[`submit${label}`] = passFail(Boolean(payload.created));
    }

    // Idempotent duplicate submit A
    {
      const c = clients.A;
      const { data: again, error: againErr } = await sb.rpc("spiora_submit_client_case", {
        p_questionnaire_id: c.questionnaireId,
        p_portal_user_id: c.portalUserId,
        p_invitation_id: c.invitationId,
        p_base_revision: 999,
        p_assigned_to: manager.id,
        p_service_type: "consultation",
        p_first_name: "Alice",
        p_last_name: "CaseSmoke",
        p_email: c.email,
        p_phone: "+1000000000",
        p_submitted_at: new Date().toISOString(),
        p_documents: [],
      });
      if (againErr) throw new Error(`duplicate submit: ${againErr.message}`);
      checks.idempotentSubmit = passFail(
        again?.ok === true && again.created === false && again.case_id === c.caseId,
      );
      if (checks.idempotentSubmit === "fail") {
        errors.push("duplicate submit did not return same case");
      }
    }

    // Questionnaire immutable
    {
      const { data: q } = await sb
        .from("client_questionnaires")
        .select("status, case_id, submitted_at")
        .eq("id", clients.A.questionnaireId)
        .maybeSingle();
      checks.questionnaireSubmitted = passFail(q?.status === "submitted");
      checks.questionnaireCaseLinked = passFail(q?.case_id === clients.A.caseId);
      const { data: stale } = await sb
        .from("client_questionnaires")
        .update({ answers: { first_name: "Hacked" }, revision: 99 })
        .eq("id", clients.A.questionnaireId)
        .eq("status", "draft")
        .select("id")
        .maybeSingle();
      checks.immutableDraftUpdateBlocked = passFail(!stale);
    }

    // Employee intake (service role — same path as Next APIs)
    {
      const { data: intake, error: intakeErr } = await sb
        .from("client_cases")
        .select("id, first_name, email, current_status, assigned_to")
        .is("archived_at", null)
        .ilike("email", `%case-smoke%${stamp}%`)
        .order("submitted_at", { ascending: false });
      if (intakeErr) throw new Error(`intake: ${intakeErr.message}`);
      const ids = new Set((intake ?? []).map((r) => r.id));
      checks.employeeIntakeSeesBoth = passFail(
        ids.has(clients.A.caseId) && ids.has(clients.B.caseId),
      );
      if (checks.employeeIntakeSeesBoth === "fail") {
        errors.push("employee intake missing smoke cases");
      }
    }

    // Authenticated client RLS
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
        `client sign-in failed: ${signA.error?.message || signB.error?.message}`,
      );
    }
    checks.authenticatedSignIn = "pass";

    {
      const { data: ownA, error: ownAErr } = await clientA
        .from("client_cases")
        .select("id, current_status")
        .eq("id", clients.A.caseId)
        .maybeSingle();
      checks.rlsOwnCaseReadA = passFail(Boolean(ownA) && !ownAErr);
      if (!ownA) errors.push("client A cannot read own case");

      const { data: cross, error: crossErr } = await clientA
        .from("client_cases")
        .select("id, current_status")
        .eq("id", clients.B.caseId)
        .maybeSingle();
      checks.rlsCrossCaseDenied = passFail(!cross);
      if (cross) errors.push("client A could read client B case");
      checks.rlsCrossCaseErrorCode = crossErr?.code || null;

      const { data: ownB } = await clientB
        .from("client_cases")
        .select("id")
        .eq("id", clients.B.caseId)
        .maybeSingle();
      checks.rlsOwnCaseReadB = passFail(Boolean(ownB));
    }

    // Status change + client sync
    {
      const { data: updated, error: statusErr } = await sb
        .from("client_cases")
        .update({
          current_status: "initial_review",
          updated_at: new Date().toISOString(),
        })
        .eq("id", clients.A.caseId)
        .select("id, current_status")
        .maybeSingle();
      if (statusErr || !updated) throw new Error(`status update: ${statusErr?.message}`);

      await sb.from("client_case_status_history").insert({
        case_id: clients.A.caseId,
        from_status: "application_received",
        to_status: "initial_review",
        changed_by: manager.id,
        actor_role: "employee",
        client_visible_key: "initial_review",
        note: "smoke status",
      });
      await sb.from("client_case_activity").insert({
        case_id: clients.A.caseId,
        activity_type: "status_changed",
        actor_type: "employee",
        actor_id: manager.id,
        metadata: { toStatus: "initial_review" },
      });
      checks.employeeStatusUpdate = "pass";

      const { data: seen } = await clientA
        .from("client_cases")
        .select("id, current_status")
        .eq("id", clients.A.caseId)
        .maybeSingle();
      checks.clientSeesUpdatedStatus = passFail(seen?.current_status === "initial_review");
      if (checks.clientSeesUpdatedStatus === "fail") {
        errors.push("client A did not see updated status");
      }

      const { data: hist } = await clientA
        .from("client_case_status_history")
        .select("id, to_status, client_visible_key, note")
        .eq("case_id", clients.A.caseId);
      checks.clientSeesStatusHistory = passFail((hist?.length ?? 0) > 0);
    }

    // Internal comments isolation
    {
      const { data: comment, error: commentErr } = await sb
        .from("client_case_comments")
        .insert({
          case_id: clients.A.caseId,
          author_user_id: manager.id,
          author_name: manager.display_name || "Smoke Manager",
          body: "INTERNAL smoke note — client must not see",
          visibility: "internal",
        })
        .select("id, visibility")
        .single();
      if (commentErr) throw new Error(`comment: ${commentErr.message}`);
      temporary.commentIds.push(comment.id);
      checks.employeeCommentCreated = "pass";

      const { data: clientComments } = await clientA
        .from("client_case_comments")
        .select("id, body, visibility")
        .eq("case_id", clients.A.caseId);
      const leaked = (clientComments ?? []).some(
        (row) => row.visibility === "internal" || String(row.body || "").includes("INTERNAL"),
      );
      checks.clientCannotSeeInternalComments = passFail(!leaked);
      if (leaked) errors.push("client A could see internal comments");

      const { data: staffComments } = await sb
        .from("client_case_comments")
        .select("id, visibility")
        .eq("case_id", clients.A.caseId)
        .eq("visibility", "internal");
      checks.employeeSeesInternalComments = passFail((staffComments?.length ?? 0) > 0);
    }

    // Client cannot mutate status
    {
      const { data: hack } = await clientA
        .from("client_cases")
        .update({ current_status: "approved" })
        .eq("id", clients.A.caseId)
        .select("id, current_status")
        .maybeSingle();
      checks.clientCannotChangeStatus = passFail(
        !hack || hack.current_status !== "approved",
      );
      if (hack?.current_status === "approved") {
        errors.push("client A changed status via RLS");
      }
    }

    // Employee document upload + signed URL
    {
      const storagePath = `cases/${clients.A.caseId}/smoke-${stamp}.txt`;
      temporary.storagePaths.push(storagePath);
      const bytes = Buffer.from(`smoke-doc-${stamp}`, "utf8");
      const { error: upErr } = await sb.storage.from(BUCKET).upload(storagePath, bytes, {
        contentType: "text/plain",
        upsert: false,
      });
      if (upErr) throw new Error(`storage upload: ${upErr.message}`);
      checks.employeeStorageUpload = "pass";

      const { data: doc, error: docErr } = await sb
        .from("client_case_documents")
        .insert({
          case_id: clients.A.caseId,
          uploader_role: "employee",
          uploaded_by: manager.id,
          uploaded_by_name: manager.display_name || "Smoke Manager",
          file_name: "smoke.txt",
          mime_type: "text/plain",
          size_bytes: bytes.length,
          storage_bucket: BUCKET,
          storage_path: storagePath,
          document_type: "employee_upload",
          category: "smoke",
          visibility: "internal",
        })
        .select("id, visibility, storage_path")
        .single();
      if (docErr) {
        await sb.storage.from(BUCKET).remove([storagePath]);
        throw new Error(`document metadata: ${docErr.message}`);
      }
      temporary.documentIds.push(doc.id);
      checks.employeeDocumentMetadata = "pass";

      const { data: signed, error: signedErr } = await sb.storage
        .from(BUCKET)
        .createSignedUrl(storagePath, 120);
      checks.signedDownloadUrl = passFail(Boolean(signed?.signedUrl) && !signedErr);
      if (!signed?.signedUrl) errors.push("signed URL failed");

      const { data: clientDocs } = await clientA
        .from("client_case_documents")
        .select("id, visibility, file_name")
        .eq("case_id", clients.A.caseId);
      const docLeak = (clientDocs ?? []).some(
        (row) => row.visibility === "internal" || row.file_name === "smoke.txt",
      );
      checks.clientCannotSeeInternalDocs = passFail(!docLeak);
      if (docLeak) errors.push("client A could see internal employee docs");
    }
  } catch (error) {
    errors.push(String(error.message || error));
    checks.runtimeError = "fail";
  } finally {
    // Cleanup / soft-neutralization
    try {
      if (temporary.documentIds.length) {
        await sb
          .from("client_case_documents")
          .update({ archived_at: new Date().toISOString() })
          .in("id", temporary.documentIds);
        cleanup.documentsArchived = true;
      }
      if (temporary.storagePaths.length) {
        const { error } = await sb.storage.from(BUCKET).remove(temporary.storagePaths);
        cleanup.storageRemoved = !error;
        if (error) cleanup.notes.push(`storage cleanup: ${error.message}`);
      }
      if (temporary.caseIds.length) {
        await sb
          .from("client_cases")
          .update({ archived_at: new Date().toISOString() })
          .in("id", temporary.caseIds);
        cleanup.casesArchived = true;
      }
      if (temporary.questionnaireIds.length) {
        await sb
          .from("client_questionnaires")
          .update({
            archived_at: new Date().toISOString(),
            status: "archived",
          })
          .in("id", temporary.questionnaireIds);
        cleanup.questionnairesArchived = true;
      }
      if (temporary.invitationIds.length) {
        await sb
          .from("client_invitations")
          .update({ revoked_at: new Date().toISOString() })
          .in("id", temporary.invitationIds);
        cleanup.invitationsRevoked = true;
      }
      for (const authUserId of temporary.authUserIds) {
        const { error } = await sb.auth.admin.deleteUser(authUserId);
        if (error) cleanup.notes.push(`auth delete ${maskId(authUserId)}: ${error.message}`);
      }
      cleanup.authUsersDeleted = temporary.authUserIds.length > 0;
    } catch (cleanupErr) {
      cleanup.notes.push(String(cleanupErr.message || cleanupErr));
    }
  }

  const failedChecks = Object.entries(checks)
    .filter(([, v]) => v === "fail")
    .map(([k]) => k);

  return {
    ok: errors.length === 0 && failedChecks.length === 0,
    result: errors.length === 0 && failedChecks.length === 0 ? "SMOKE_OK" : "SMOKE_FAILED",
    checks,
    failedChecks,
    errors,
    temporary: {
      emails: temporary.emails,
      invitationIds: temporary.invitationIds.map(maskId),
      portalUserIds: temporary.portalUserIds.map(maskId),
      questionnaireIds: temporary.questionnaireIds.map(maskId),
      caseIds: temporary.caseIds.map(maskId),
      authUserIds: temporary.authUserIds.map(maskId),
      documentIds: temporary.documentIds.map(maskId),
      storagePaths: temporary.storagePaths.map((p) => p.replace(/[0-9a-f-]{36}/gi, maskId)),
    },
    cleanup,
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
