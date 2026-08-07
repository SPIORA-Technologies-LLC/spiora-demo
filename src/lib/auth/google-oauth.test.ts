import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  buildGoogleOAuthCallbackUrl,
  evaluateGoogleOAuthAccess,
  googleOAuthDenyPath,
  googleOAuthSuccessPath,
} from "./google-oauth-access";
import { buildGoogleOAuthStartParts } from "./google-oauth-response";
import {
  isSecurityAuditOauthEnabled,
  isSecurityAuditPasswordEnabled,
  scrubAuditMetadata,
} from "./security-audit";
import {
  EMPLOYEE_RECOVERY_COOKIE,
  CLIENT_RECOVERY_COOKIE,
} from "./password-recovery-gate";

describe("google oauth access plane", () => {
  const activeEmployee = {
    status: "active",
    archivedAt: null,
    role: "manager",
  };
  const portalClient = {
    preferredLocale: "ru",
    invitationId: "inv-1",
  };

  it("allows active employee without client row", () => {
    assert.deepEqual(
      evaluateGoogleOAuthAccess({
        audience: "employee",
        employee: activeEmployee,
        client: null,
      }),
      { ok: true },
    );
  });

  it("allows portal client without employee row", () => {
    assert.deepEqual(
      evaluateGoogleOAuthAccess({
        audience: "client",
        employee: null,
        client: portalClient,
      }),
      { ok: true },
    );
  });

  it("denies missing profiles", () => {
    assert.equal(
      evaluateGoogleOAuthAccess({
        audience: "employee",
        employee: null,
        client: null,
      }).ok,
      false,
    );
    assert.equal(
      evaluateGoogleOAuthAccess({
        audience: "client",
        employee: null,
        client: null,
      }).ok,
      false,
    );
  });

  it("denies client-only on employee callback and employee-only on client", () => {
    assert.equal(
      (
        evaluateGoogleOAuthAccess({
          audience: "employee",
          employee: null,
          client: portalClient,
        }) as { reason: string }
      ).reason,
      "client_profile_present",
    );
    assert.equal(
      (
        evaluateGoogleOAuthAccess({
          audience: "client",
          employee: activeEmployee,
          client: null,
        }) as { reason: string }
      ).reason,
      "employee_profile_present",
    );
  });

  it("denies dual profiles", () => {
    assert.equal(
      (
        evaluateGoogleOAuthAccess({
          audience: "employee",
          employee: activeEmployee,
          client: portalClient,
        }) as { reason: string }
      ).reason,
      "ambiguous",
    );
  });

  it("denies inactive / unsupported employee roles", () => {
    assert.equal(
      evaluateGoogleOAuthAccess({
        audience: "employee",
        employee: { status: "suspended", archivedAt: null, role: "manager" },
        client: null,
      }).ok,
      false,
    );
    assert.equal(
      evaluateGoogleOAuthAccess({
        audience: "employee",
        employee: { status: "active", archivedAt: null, role: "consultant" },
        client: null,
      }).ok,
      false,
    );
  });

  it("denies client row without invitation or valid locale", () => {
    assert.equal(
      evaluateGoogleOAuthAccess({
        audience: "client",
        employee: null,
        client: { preferredLocale: "ru", invitationId: "" },
      }).ok,
      false,
    );
    assert.equal(
      evaluateGoogleOAuthAccess({
        audience: "client",
        employee: null,
        client: { preferredLocale: "de", invitationId: "inv-1" },
      }).ok,
      false,
    );
  });
});

describe("google oauth fixed redirects", () => {
  it("builds callback URLs from NEXT_PUBLIC_APP_URL only", () => {
    const env = {
      NEXT_PUBLIC_APP_URL: "https://www.spiora.ai",
    } as NodeJS.ProcessEnv;
    assert.equal(
      buildGoogleOAuthCallbackUrl("employee", env),
      "https://www.spiora.ai/auth/callback/employee",
    );
    assert.equal(
      buildGoogleOAuthCallbackUrl("client", env),
      "https://www.spiora.ai/auth/callback/client",
    );
    assert.equal(buildGoogleOAuthCallbackUrl("employee", {} as NodeJS.ProcessEnv), null);
  });

  it("uses fixed success and deny paths", () => {
    assert.equal(googleOAuthSuccessPath("employee"), "/dashboard?enter=1");
    assert.equal(googleOAuthSuccessPath("client"), "/client?enter=1");
    assert.equal(googleOAuthDenyPath("employee"), "/login?error=google_access_denied");
    assert.equal(
      googleOAuthDenyPath("client"),
      "/client/login?error=google_access_denied",
    );
  });
});

describe("google oauth start response cookies", () => {
  it("includes provider URL and Set-Cookie from collector mutations", () => {
    const parts = buildGoogleOAuthStartParts(
      "https://accounts.google.com/o/oauth2/v2/auth?state=pkce",
      [
        {
          name: "sb-test-auth-token-code-verifier",
          value: "verifier-value",
          options: { path: "/", httpOnly: true, sameSite: "lax" },
        },
      ],
    );
    assert.equal(
      parts.body.url,
      "https://accounts.google.com/o/oauth2/v2/auth?state=pkce",
    );
    assert.equal(parts.setCookie.length, 1);
    assert.match(parts.setCookie[0]!, /sb-test-auth-token-code-verifier/);
    assert.match(parts.setCookie[0]!, /verifier-value/);
    assert.match(parts.setCookie[0]!, /HttpOnly/);
  });
});

describe("google oauth source invariants", () => {
  it("deprecated /auth/callback never exchanges code or redirects to dashboard", () => {
    const file = readFileSync(
      path.join(process.cwd(), "src/app/auth/callback/route.ts"),
      "utf8",
    );
    assert.doesNotMatch(file, /exchangeCodeForSession/);
    assert.doesNotMatch(file, /getUser\(/);
    assert.doesNotMatch(file, /\/dashboard/);
    assert.match(file, /unsupported_callback/);
    assert.doesNotMatch(file, /applyRecoveryGateCookie|spiora_.*_pw_recovery/);
  });

  it("employee and client callbacks are plane-fixed and never mint recovery", () => {
    const employee = readFileSync(
      path.join(process.cwd(), "src/app/auth/callback/employee/route.ts"),
      "utf8",
    );
    const client = readFileSync(
      path.join(process.cwd(), "src/app/auth/callback/client/route.ts"),
      "utf8",
    );
    assert.match(employee, /audience: "employee"/);
    assert.match(client, /audience: "client"/);
    const helper = readFileSync(
      path.join(process.cwd(), "src/lib/auth/google-oauth.ts"),
      "utf8",
    );
    assert.match(helper, /exchangeCodeForSession/);
    assert.match(helper, /getUser\(/);
    assert.match(helper, /signOut\(\{\s*scope:\s*"global"/);
    assert.doesNotMatch(helper, /applyRecoveryGateCookie/);
    assert.doesNotMatch(helper, /insert into user_profiles|from\("user_profiles"\)\.insert/i);
    assert.doesNotMatch(helper, /from\("client_portal_users"\)\.insert/i);
  });

  it("start routes fix redirectTo and do not accept audience from body", () => {
    const employeeStart = readFileSync(
      path.join(process.cwd(), "src/app/api/auth/oauth/google/route.ts"),
      "utf8",
    );
    const clientStart = readFileSync(
      path.join(process.cwd(), "src/app/api/client/auth/oauth/google/route.ts"),
      "utf8",
    );
    assert.match(employeeStart, /audience: "employee"/);
    assert.match(clientStart, /audience: "client"/);
    const helper = readFileSync(
      path.join(process.cwd(), "src/lib/auth/google-oauth.ts"),
      "utf8",
    );
    assert.match(helper, /skipBrowserRedirect:\s*true/);
    assert.match(helper, /jsonWithAuthCookies\(\{\s*url:\s*data\.url/);
    assert.doesNotMatch(helper, /spiora_google_oauth/);
  });

  it("SQL 042 has four google events and no identity_linked", () => {
    const sql = readFileSync(
      path.join(
        process.cwd(),
        "SPIORA_SUPABASE_PATCH_042_SECURITY_AUDIT_GOOGLE_OAUTH.sql",
      ),
      "utf8",
    );
    assert.match(sql, /google_oauth_started/);
    assert.match(sql, /google_oauth_success/);
    assert.match(sql, /google_oauth_denied/);
    assert.match(sql, /google_oauth_failed/);
    assert.doesNotMatch(sql, /'google_identity_linked'/);
  });

  it("audit scrub drops secrets; oauth flag independent of password flag", () => {
    const scrubbed = scrubAuditMetadata({
      provider: "google",
      code: "secret",
      token: "x",
      reason: "missing",
    }) as Record<string, unknown>;
    assert.equal(scrubbed.provider, "google");
    assert.equal(scrubbed.reason, "missing");
    assert.equal(scrubbed.code, undefined);
    assert.equal(scrubbed.token, undefined);

    const prevPass = process.env.SPIORA_SECURITY_AUDIT_PASSWORD;
    const prevOauth = process.env.SPIORA_SECURITY_AUDIT_OAUTH;
    const prevAuth = process.env.SPIORA_SECURITY_AUDIT_AUTH;
    try {
      delete process.env.SPIORA_SECURITY_AUDIT_AUTH;
      process.env.SPIORA_SECURITY_AUDIT_PASSWORD = "true";
      delete process.env.SPIORA_SECURITY_AUDIT_OAUTH;
      assert.equal(isSecurityAuditPasswordEnabled(), true);
      assert.equal(isSecurityAuditOauthEnabled(), false);

      delete process.env.SPIORA_SECURITY_AUDIT_PASSWORD;
      process.env.SPIORA_SECURITY_AUDIT_OAUTH = "true";
      assert.equal(isSecurityAuditPasswordEnabled(), false);
      assert.equal(isSecurityAuditOauthEnabled(), true);

      process.env.SPIORA_SECURITY_AUDIT_AUTH = "true";
      assert.equal(isSecurityAuditPasswordEnabled(), true);
      assert.equal(isSecurityAuditOauthEnabled(), true);
    } finally {
      if (prevPass === undefined) delete process.env.SPIORA_SECURITY_AUDIT_PASSWORD;
      else process.env.SPIORA_SECURITY_AUDIT_PASSWORD = prevPass;
      if (prevOauth === undefined) delete process.env.SPIORA_SECURITY_AUDIT_OAUTH;
      else process.env.SPIORA_SECURITY_AUDIT_OAUTH = prevOauth;
      if (prevAuth === undefined) delete process.env.SPIORA_SECURITY_AUDIT_AUTH;
      else process.env.SPIORA_SECURITY_AUDIT_AUTH = prevAuth;
    }
  });

  it("recovery cookie names remain distinct from oauth flow", () => {
    assert.equal(EMPLOYEE_RECOVERY_COOKIE.startsWith("spiora_"), true);
    assert.equal(CLIENT_RECOVERY_COOKIE.startsWith("spiora_"), true);
  });
});

describe("manual identity linking checklist (docs-as-test)", () => {
  it("documents required manual production verification", () => {
    // Manual ops (not automated against live Google):
    // 1) Create password employee with confirmed email + user_profiles row.
    // 2) Sign in with Google using the same confirmed email.
    // 3) Expect same auth.users id (Supabase automatic linking).
    // 4) Expect a single user_profiles row for that auth_user_id.
    // 5) Expect employee access granted via existing profile only.
    // 6) Brand-new Google user without profile → deny + global signOut; no profile insert.
    const helper = readFileSync(
      path.join(process.cwd(), "src/lib/auth/google-oauth.ts"),
      "utf8",
    );
    assert.doesNotMatch(helper, /\.insert\(/);
    assert.match(helper, /evaluateGoogleOAuthAccess/);
    assert.ok(true);
  });
});
