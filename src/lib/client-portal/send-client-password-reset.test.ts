import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Phase D1 staff client password reset (source invariants)", () => {
  it("exposes send-password-reset route and disables legacy reset-password generation", () => {
    const send = read(
      "src/app/api/client-invitations/[id]/send-password-reset/route.ts",
    );
    const legacy = read(
      "src/app/api/client-invitations/[id]/reset-password/route.ts",
    );
    assert.match(send, /sendClientInvitationPasswordReset/);
    assert.match(send, /getSession/);
    assert.match(send, /ORIGIN_MISMATCH/);
    assert.match(send, /!originHeader/);
    assert.doesNotMatch(send, /temporaryPassword|generateTemporaryPassword|updateUserById/);
    assert.doesNotMatch(send, /body\.email|input\.email/);

    assert.match(legacy, /status: 410/);
    assert.match(legacy, /send-password-reset/);
    assert.doesNotMatch(legacy, /generateTemporaryPassword|temporaryPassword|updateUserById/);
  });

  it("helper never generates passwords and uses client recovery redirect", () => {
    const helper = read(
      "src/lib/client-portal/send-client-password-reset.ts",
    );
    assert.match(helper, /buildPasswordRecoveryConfirmUrl\("client"\)/);
    assert.match(helper, /trySendLocalizedPasswordRecoveryEmail/);
    assert.match(helper, /resetPasswordForEmail/);
    assert.match(helper, /password_reset_requested/);
    assert.match(helper, /source:\s*"staff_invitation"/);
    assert.match(helper, /staff-forgot/);
    assert.doesNotMatch(helper, /generateTemporaryPassword/);
    assert.doesNotMatch(helper, /updateUserById/);
    assert.doesNotMatch(helper, /temporaryPassword/);
    assert.doesNotMatch(helper, /provisionClientPortalAuthUser/);
  });

  it("invitations create still provisions temporary password (D2 unchanged)", () => {
    const invitations = read("src/lib/client-portal/invitations.ts");
    assert.match(invitations, /generateTemporaryPassword/);
    assert.match(invitations, /provisionClientPortalAuthUser/);
    assert.doesNotMatch(invitations, /resetClientInvitationCredentials/);
  });

  it("staff panel uses send-password-reset without password modal for reset", () => {
    const panel = read(
      "src/components/client-portal/ClientInvitationsPanel.tsx",
    );
    assert.match(panel, /send-password-reset/);
    assert.match(panel, /sendPasswordReset/);
    assert.match(panel, /passwordResetLinkSent/);
    assert.match(panel, /confirmSendPasswordReset/);
    assert.doesNotMatch(panel, /\/reset-password/);
    assert.doesNotMatch(panel, /titleKey:\s*"resetTitle"/);
    assert.doesNotMatch(panel, /onResetPassword/);
  });

  it("i18n has RU/EN send-reset copy without claiming staff sees password", () => {
    const en = read("src/i18n/dictionaries/en.json");
    const ru = read("src/i18n/dictionaries/ru.json");
    assert.match(en, /"sendPasswordReset": "Send password reset link"/);
    assert.match(
      ru,
      /"sendPasswordReset": "Отправить ссылку для сброса пароля"/,
    );
    assert.match(
      en,
      /"passwordResetLinkSent": "Password reset link has been sent to the client's email\."/,
    );
    assert.match(
      ru,
      /"passwordResetLinkSent": "Ссылка для сброса пароля отправлена на email клиента\."/,
    );
  });

  it("client portal home links to change password", () => {
    const home = read("src/components/client-portal/ClientPortalHome.tsx");
    assert.match(home, /\/client\/account\/password/);
    assert.match(home, /home\.changePassword/);
  });

  it("client self-service forgot/reset path preserved", () => {
    const login = read("src/components/client-portal/ClientPortalLogin.tsx");
    const handlers = read("src/lib/auth/password-handlers.ts");
    assert.match(login, /\/client\/forgot-password/);
    assert.match(handlers, /handlePasswordForgot/);
    assert.match(handlers, /handlePasswordReset/);
    assert.match(handlers, /signOut\(\)/);
    assert.match(handlers, /clearRecoveryGateCookie/);
    assert.match(
      read("src/app/api/client/auth/password/forgot/route.ts"),
      /audience:\s*"client"/,
    );
    assert.match(
      read("src/app/api/client/auth/password/reset/route.ts"),
      /audience:\s*"client"/,
    );
  });

  it("employee password and Google OAuth routes unchanged by D1 staff reset", () => {
    assert.ok(
      existsSync(path.join(root, "src/app/api/auth/password/forgot/route.ts")),
    );
    assert.ok(
      existsSync(path.join(root, "src/app/api/auth/oauth/google/route.ts")),
    );
    assert.ok(
      existsSync(
        path.join(root, "src/app/api/client/auth/oauth/google/route.ts"),
      ),
    );
    const employeeForgot = read("src/app/api/auth/password/forgot/route.ts");
    assert.match(employeeForgot, /audience:\s*"employee"/);
  });

  it("Phase C MFA employee APIs remain; no client MFA API", () => {
    assert.ok(existsSync(path.join(root, "src/app/api/auth/mfa/status/route.ts")));
    assert.equal(
      existsSync(path.join(root, "src/app/api/client/auth/mfa")),
      false,
    );
  });

  it("audit scrub still strips password/token keys", () => {
    const audit = read("src/lib/auth/security-audit.ts");
    assert.match(audit, /scrubAuditMetadata/);
    assert.match(audit, /password|token|secret/i);
  });
});
