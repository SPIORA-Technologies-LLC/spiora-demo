import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, before, after } from "node:test";
import {
  createRecoveryGateToken,
  verifyRecoveryGateToken,
  EMPLOYEE_RECOVERY_COOKIE,
  EMPLOYEE_RECOVERY_COOKIE_PATH,
  CLIENT_RECOVERY_COOKIE_PATH,
  getRecoveryCookieOptions,
  recoveryCookiePath,
} from "./password-recovery-gate";
import { buildPasswordRecoveryConfirmUrl } from "./canonical-app-origin";
import { SPIORA_RECOVERY_EMAIL_TEMPLATE_HTML } from "./recovery-email-template";

describe("password phase A invariants", () => {
  const prevSecret = process.env.AUTH_SECRET;
  before(() => {
    process.env.AUTH_SECRET = "unit-test-auth-secret-for-gate";
  });
  after(() => {
    if (prevSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = prevSecret;
  });

  it("employee and client forgot redirectTo targets fixed confirm routes", () => {
    const env = {
      NEXT_PUBLIC_APP_URL: "https://spiora-demo.vercel.app",
    } as NodeJS.ProcessEnv;
    assert.match(
      buildPasswordRecoveryConfirmUrl("employee", env)!,
      /\/auth\/confirm\/employee$/,
    );
    assert.match(
      buildPasswordRecoveryConfirmUrl("client", env)!,
      /\/auth\/confirm\/client$/,
    );
  });

  it("recovery email template uses RedirectTo?token_hash without next=", () => {
    assert.match(
      SPIORA_RECOVERY_EMAIL_TEMPLATE_HTML,
      /\{\{\s*\.RedirectTo\s*\}\}\?token_hash=\{\{\s*\.TokenHash\s*\}\}&type=recovery/,
    );
    assert.doesNotMatch(SPIORA_RECOVERY_EMAIL_TEMPLATE_HTML, /next=/);
  });

  it("auth/callback source never mints recovery gate and is deprecated deny", () => {
    const file = readFileSync(
      path.join(process.cwd(), "src/app/auth/callback/route.ts"),
      "utf8",
    );
    assert.doesNotMatch(file, /applyRecoveryGateCookie|spiora_.*_pw_recovery/);
    assert.doesNotMatch(file, /exchangeCodeForSession/);
    assert.match(file, /unsupported_callback/);
  });

  it("confirm routes are plane-specific and only recovery", () => {
    const employee = readFileSync(
      path.join(process.cwd(), "src/app/auth/confirm/employee/route.ts"),
      "utf8",
    );
    const client = readFileSync(
      path.join(process.cwd(), "src/app/auth/confirm/client/route.ts"),
      "utf8",
    );
    assert.match(employee, /audience: "employee"/);
    assert.match(client, /audience: "client"/);
  });

  it("gate audience mismatch is rejected; cookie paths are minimal and stable for clear", async () => {
    const employeeToken = await createRecoveryGateToken({
      authUserId: "u1",
      audience: "employee",
    });
    assert.equal(await verifyRecoveryGateToken(employeeToken, "client"), null);
    assert.equal(
      (await verifyRecoveryGateToken(employeeToken, "employee"))?.sub,
      "u1",
    );

    assert.equal(recoveryCookiePath("employee"), EMPLOYEE_RECOVERY_COOKIE_PATH);
    assert.equal(recoveryCookiePath("client"), CLIENT_RECOVERY_COOKIE_PATH);
    assert.equal(
      getRecoveryCookieOptions("employee").path,
      EMPLOYEE_RECOVERY_COOKIE_PATH,
    );
    assert.equal(
      getRecoveryCookieOptions("client").path,
      CLIENT_RECOVERY_COOKIE_PATH,
    );
    // clear must use same options.path (enforced by clearRecoveryGateCookie implementation)
    const clearSrc = readFileSync(
      path.join(process.cwd(), "src/lib/auth/password-recovery-gate.ts"),
      "utf8",
    );
    assert.match(clearSrc, /getRecoveryCookieOptions\(audience\)/);
    assert.match(clearSrc, /maxAge: 0/);
    assert.ok(clearSrc.includes(EMPLOYEE_RECOVERY_COOKIE));
  });

  it("reset handler clears gate after global signOut and keeps cookie collector", () => {
    const handlers = readFileSync(
      path.join(process.cwd(), "src/lib/auth/password-handlers.ts"),
      "utf8",
    );
    assert.match(handlers, /signOut\(\)/);
    assert.match(handlers, /clearRecoveryGateCookie/);
    assert.match(handlers, /jsonWithAuthCookies/);
    assert.match(handlers, /signOut\(\{\s*scope:\s*"others"\s*\}\)/);
    assert.doesNotMatch(handlers, /user\.identities/);
  });
});
