import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  needsMfaChallenge,
  reconcileAalWithVerifiedFactors,
} from "@/lib/auth/mfa-aal";
import {
  CLIENT_MFA_RECOVERY_HMAC_PREFIX,
  hashRecoveryCode,
  normalizeRecoveryCode,
} from "@/lib/auth/mfa-recovery-codes";
import {
  isClientApiPath,
  isClientMfaExemptApiPath,
  isClientMfaGatePath,
  isMfaExemptApiPath,
  isMfaGatePath,
} from "@/lib/auth/mfa-paths";
import { isClientMfaEnabled } from "@/lib/client-portal/mfa-config";
import { resolveClientPostMfaPath } from "@/lib/client-portal/mfa-redirect";

function read(rel: string) {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("client MFA flag", () => {
  it("defaults off; only true enables", () => {
    assert.equal(isClientMfaEnabled({}), false);
    assert.equal(isClientMfaEnabled({ SPIORA_MFA_CLIENT: "false" }), false);
    assert.equal(isClientMfaEnabled({ SPIORA_MFA_CLIENT: "true" }), true);
  });
});

describe("client MFA AAL regression (password-session bug)", () => {
  it("fresh AAL1 + empty factors signal + verified TOTP ⇒ challenge REQUIRED", () => {
    // Simulated getAuthenticatorAssuranceLevel without JWT (stale empty factors).
    const stale = { currentLevel: "aal1", nextLevel: "aal1" };
    assert.equal(needsMfaChallenge(stale), false);

    const reconciled = reconcileAalWithVerifiedFactors(stale, 1);
    assert.deepEqual(reconciled, { currentLevel: "aal1", nextLevel: "aal2" });
    assert.equal(needsMfaChallenge(reconciled), true);
  });

  it("shared evaluate helper uses JWT + listFactors reconcile", () => {
    const evaluate = read("src/lib/auth/mfa-evaluate.ts");
    assert.match(evaluate, /getAuthenticatorAssuranceLevel\(\s*\n?\s*session\.access_token/);
    assert.match(evaluate, /listFactors/);
    assert.match(evaluate, /reconcileAalWithVerifiedFactors/);
  });
});

describe("client MFA path isolation", () => {
  it("uses client MFA routes only", () => {
    assert.equal(isClientMfaGatePath("/client/mfa/challenge"), true);
    assert.equal(isClientMfaGatePath("/client/mfa/recovery"), true);
    assert.equal(isClientMfaGatePath("/mfa/challenge"), false);
    assert.equal(isMfaGatePath("/client/mfa/challenge"), false);
    assert.equal(isMfaGatePath("/mfa/challenge"), true);
  });

  it("employee API gate still exempts all /api/client", () => {
    assert.equal(isMfaExemptApiPath("/api/client/case"), true);
    assert.equal(isMfaExemptApiPath("/api/client/auth/mfa/status"), true);
  });

  it("client MFA API exempt allowlist is narrow", () => {
    assert.equal(isClientApiPath("/api/client/case"), true);
    assert.equal(isClientMfaExemptApiPath("/api/client/auth/mfa/status"), true);
    assert.equal(isClientMfaExemptApiPath("/api/client/session"), true);
    assert.equal(isClientMfaExemptApiPath("/api/client/logout"), true);
    assert.equal(isClientMfaExemptApiPath("/api/client/auth/password/forgot"), true);
    assert.equal(isClientMfaExemptApiPath("/api/client/auth/password/reset"), true);
    assert.equal(isClientMfaExemptApiPath("/api/client/auth/oauth/google"), true);
    assert.equal(isClientMfaExemptApiPath("/api/client/invite/x"), true);
    assert.equal(isClientMfaExemptApiPath("/api/client/case"), false);
    assert.equal(isClientMfaExemptApiPath("/api/client/questionnaire"), false);
    assert.equal(isClientMfaExemptApiPath("/api/client/assistant"), false);
    assert.equal(isClientMfaExemptApiPath("/api/client/auth/password/change"), false);
  });

  it("post-challenge redirect stays on client plane", () => {
    assert.match(resolveClientPostMfaPath("/client"), /\/client\?enter=1|\/client\?.*enter=1/);
    assert.match(resolveClientPostMfaPath("/client/account/password"), /enter=1/);
    assert.match(resolveClientPostMfaPath("/dashboard"), /\/client/);
    assert.match(resolveClientPostMfaPath("//evil.com"), /\/client/);
    assert.match(resolveClientPostMfaPath("/client/mfa/challenge"), /\/client\?/);
  });
});

describe("client recovery HMAC domain separation", () => {
  it("prefixes client hashes; employee hashes unchanged", () => {
    const pepper = "unit-test-pepper";
    const code = "AB12-CD34";
    const employee = hashRecoveryCode(code, pepper);
    const client = hashRecoveryCode(
      code,
      pepper,
      CLIENT_MFA_RECOVERY_HMAC_PREFIX,
    );
    assert.notEqual(employee, client);
    assert.equal(
      client,
      hashRecoveryCode(
        normalizeRecoveryCode(code),
        pepper,
        CLIENT_MFA_RECOVERY_HMAC_PREFIX,
      ),
    );
  });
});

describe("client MFA source invariants", () => {
  it("SQL 045 defines client recovery table + reenroll column", () => {
    const sql = read("SPIORA_SUPABASE_PATCH_045_CLIENT_MFA_RECOVERY.sql");
    assert.match(sql, /client_mfa_recovery_codes/);
    assert.match(sql, /mfa_reenroll_required/);
    assert.match(sql, /client_portal_users/);
    assert.match(sql, /service_role/);
    assert.doesNotMatch(sql, /create table if not exists public\.employee_mfa_recovery_codes/);
    assert.doesNotMatch(sql, /alter table public\.user_profiles/);
  });

  it("flag documented default off", () => {
    const example = read(".env.spiora.example");
    assert.match(example, /SPIORA_MFA_CLIENT/);
    assert.match(example, /SPIORA_MFA_CLIENT=false/);
  });

  it("client MFA API and UI surfaces exist on client plane only", () => {
    assert.equal(
      existsSync(path.join(process.cwd(), "src/app/api/client/auth/mfa")),
      true,
    );
    assert.equal(
      existsSync(path.join(process.cwd(), "src/app/client/mfa/challenge/page.tsx")),
      true,
    );
    assert.equal(
      existsSync(path.join(process.cwd(), "src/app/client/mfa/recovery/page.tsx")),
      true,
    );
    assert.equal(
      existsSync(
        path.join(process.cwd(), "src/app/client/(portal)/account/mfa/page.tsx"),
      ),
      true,
    );
    assert.equal(
      existsSync(path.join(process.cwd(), "src/app/api/auth/mfa")),
      true,
    );
  });

  it("middleware enforces client MFA pages and APIs separately", () => {
    const mw = read("middleware.ts");
    assert.match(mw, /clientMfaChallengeRequired/);
    assert.match(mw, /isClientMfaExemptApiPath/);
    assert.match(mw, /isClientMfaGatePath/);
    assert.match(mw, /\/client\/mfa\/challenge/);
    assert.match(mw, /MFA_REQUIRED/);
  });

  it("Google client callback evaluates MFA; employee path preserved", () => {
    const oauth = read("src/lib/auth/google-oauth.ts");
    assert.match(oauth, /audience === "client"/);
    assert.match(oauth, /\/client\/mfa\/challenge/);
    assert.match(oauth, /\/mfa\/challenge/);
    assert.match(oauth, /evaluateMfaChallengeRequired/);
  });

  it("password login checks challengeRequired from session", () => {
    const login = read("src/components/client-portal/ClientPortalLogin.tsx");
    assert.match(login, /challengeRequired/);
    assert.match(login, /\/client\/mfa\/challenge/);
  });

  it("getClientSession fail-closed on dual plane", () => {
    const session = read("src/lib/client-portal/session.ts");
    assert.match(session, /resolvePasswordPlaneForAudience/);
    assert.match(session, /"client"/);
  });

  it("recovery uses client store and login reenroll redirect", () => {
    const recovery = read("src/lib/client-portal/mfa-recovery.ts");
    assert.match(recovery, /client_portal_users/);
    assert.match(recovery, /mfa_reenroll_required/);
    assert.match(recovery, /wipeClientRecoveryCodes/);
    assert.match(recovery, /audience: "client"/);
    assert.doesNotMatch(recovery, /employee_mfa_recovery_codes/);
    assert.doesNotMatch(recovery, /user_profiles/);

    const route = read("src/app/api/client/auth/mfa/recovery/route.ts");
    assert.match(route, /\/client\/login\?mfa_reenroll=1/);
  });

  it("disable requires AAL2 and clears reenroll", () => {
    const service = read("src/lib/client-portal/mfa-service.ts");
    assert.match(service, /aal2_required/);
    assert.match(service, /isAal2/);
    assert.match(service, /mfa_reenroll_required: false/);
  });

  it("D1 password reset path does not unenroll MFA factors", () => {
    const handlers = read("src/lib/auth/password-handlers.ts");
    assert.doesNotMatch(handlers, /mfa\.unenroll|deleteFactor/);
  });

  it("RU+EN client MFA copy present", () => {
    const en = read("src/i18n/dictionaries/en.json");
    const ru = read("src/i18n/dictionaries/ru.json");
    assert.match(en, /"clientPortal"[\s\S]*"mfa"/);
    assert.match(ru, /"clientPortal"[\s\S]*"mfa"/);
    assert.match(en, /Enable two-factor authentication/);
    assert.match(ru, /Включить двухфакторную аутентификацию/);
  });

  it("audit reuses 044 actions with client audience (no new action names)", () => {
    const sql044 = read("SPIORA_SUPABASE_PATCH_044_SECURITY_AUDIT_MFA.sql");
    assert.match(sql044, /mfa_challenge_success/);
    assert.doesNotMatch(sql044, /mfa_enroll_failed/);
    const enroll = read("src/app/api/client/auth/mfa/enroll/route.ts");
    assert.match(enroll, /audience: "client"/);
    assert.match(enroll, /mfa_enroll_started/);
  });
});
