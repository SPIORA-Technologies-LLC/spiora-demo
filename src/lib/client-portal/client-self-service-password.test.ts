import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Phase D1 client self-service password recovery", () => {
  it("client login exposes Forgot password link to /client/forgot-password", () => {
    const login = read("src/components/client-portal/ClientPortalLogin.tsx");
    assert.match(login, /forgotPassword/);
    assert.match(login, /href="\/client\/forgot-password"/);
  });

  it("forgot/reset UX copy stays generic (no account enumeration)", () => {
    const en = read("src/i18n/dictionaries/en.json");
    const ru = read("src/i18n/dictionaries/ru.json");
    assert.match(
      en,
      /"sent": "A password recovery link has been sent to your email\. Please check your inbox and spam folder\."/,
    );
    assert.match(
      ru,
      /"sent": "Ссылка для восстановления пароля отправлена на вашу почту\. Проверьте входящие и папку «Спам»\."/,
    );
    const enForgot = en.match(/"forgot":\s*\{[\s\S]*?\n\s*\}/);
    const ruForgot = ru.match(/"forgot":\s*\{[\s\S]*?\n\s*\}/);
    assert.ok(enForgot);
    assert.ok(ruForgot);
    assert.doesNotMatch(enForgot[0], /not found|user not found/i);
    assert.doesNotMatch(ruForgot[0], /не найден/i);
  });

  it("client forgot/reset/confirm plane is isolated from employee", () => {
    assert.match(
      read("src/app/api/client/auth/password/forgot/route.ts"),
      /audience:\s*"client"/,
    );
    assert.match(
      read("src/app/api/client/auth/password/reset/route.ts"),
      /audience:\s*"client"/,
    );
    assert.match(
      read("src/app/auth/confirm/client/route.ts"),
      /audience:\s*"client"/,
    );
    assert.match(
      read("src/app/api/auth/password/forgot/route.ts"),
      /audience:\s*"employee"/,
    );
    assert.match(
      read("src/app/auth/confirm/employee/route.ts"),
      /audience:\s*"employee"/,
    );

    const handlers = read("src/lib/auth/password-handlers.ts");
    assert.match(handlers, /resolvePasswordPlaneForAudience/);
    assert.match(handlers, /signOut\(\)/);
    assert.match(handlers, /clearRecoveryGateCookie/);
    assert.match(handlers, /\{ ok: true \}/);
  });

  it("staff invitations UI has no password reset action", () => {
    const panel = read(
      "src/components/client-portal/ClientInvitationsPanel.tsx",
    );
    assert.doesNotMatch(panel, /send-password-reset|sendPasswordReset|onSendPasswordReset|resetLinkSent|resendPassword/);
    assert.match(panel, /inviteAgain/);
    assert.match(panel, /onDelete/);
  });

  it("staff password-reset API routes and helper are removed", () => {
    assert.equal(
      existsSync(
        path.join(
          root,
          "src/app/api/client-invitations/[id]/send-password-reset/route.ts",
        ),
      ),
      false,
    );
    assert.equal(
      existsSync(
        path.join(
          root,
          "src/app/api/client-invitations/[id]/reset-password/route.ts",
        ),
      ),
      false,
    );
    assert.equal(
      existsSync(
        path.join(root, "src/lib/client-portal/send-client-password-reset.ts"),
      ),
      false,
    );
    const rate = read("src/lib/auth/password-rate-limit.ts");
    assert.doesNotMatch(rate, /staff-forgot/);
  });

  it("create invitation still provisions temporary password until D2", () => {
    const invitations = read("src/lib/client-portal/invitations.ts");
    assert.match(invitations, /generateTemporaryPassword/);
    assert.match(invitations, /provisionClientPortalAuthUser/);
  });

  it("invitation copy separates first access from self-service recovery", () => {
    const en = read("src/i18n/dictionaries/en.json");
    const ru = read("src/i18n/dictionaries/ru.json");
    assert.match(en, /Forgot password/);
    assert.match(ru, /Забыли пароль/);
    assert.doesNotMatch(en, /Send password reset link/);
    assert.doesNotMatch(ru, /Отправить ссылку для сброса пароля/);
  });

  it("client portal home still links to change password", () => {
    const home = read("src/components/client-portal/ClientPortalHome.tsx");
    assert.match(home, /\/client\/account\/password/);
    assert.match(home, /home\.changePassword/);
  });

  it("Account / MFA nav only when showMfaSettings (flag-gated UX)", () => {
    const home = read("src/components/client-portal/ClientPortalHome.tsx");
    assert.match(home, /showMfaSettings/);
    assert.match(home, /home\.account/);
    assert.match(home, /\/client\/account\/mfa/);
    assert.doesNotMatch(home, /home\.security/);
    // Label + MFA link are inside the flag-true branch only.
    const accountBranch = home.slice(
      home.indexOf("showMfaSettings ? ("),
      home.indexOf(") : (", home.indexOf("showMfaSettings ? (")),
    );
    assert.match(accountBranch, /home\.account/);
    assert.match(accountBranch, /home\.twoFactor/);
    assert.match(accountBranch, /\/client\/account\/mfa/);
  });

  it("Phase B OAuth and Phase C employee MFA remain; D3 adds client MFA plane", () => {
    assert.ok(
      existsSync(path.join(root, "src/app/api/auth/oauth/google/route.ts")),
    );
    assert.ok(
      existsSync(
        path.join(root, "src/app/api/client/auth/oauth/google/route.ts"),
      ),
    );
    assert.ok(existsSync(path.join(root, "src/app/api/auth/mfa/status/route.ts")));
    assert.ok(existsSync(path.join(root, "src/app/api/client/auth/mfa")));
  });

  it("audit scrub strips password/token secrets", () => {
    const audit = read("src/lib/auth/security-audit.ts");
    assert.match(audit, /scrubAuditMetadata/);
    assert.match(audit, /password|token|secret/i);
  });
});
