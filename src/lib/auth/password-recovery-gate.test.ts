import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import {
  createRecoveryGateToken,
  verifyRecoveryGateToken,
  RECOVERY_GATE_MAX_AGE_SECONDS,
  EMPLOYEE_RECOVERY_COOKIE,
  CLIENT_RECOVERY_COOKIE,
  EMPLOYEE_RECOVERY_COOKIE_PATH,
  CLIENT_RECOVERY_COOKIE_PATH,
  recoveryCookieName,
  recoveryCookiePath,
  getRecoveryCookieOptions,
  hashAuditEmail,
} from "./password-recovery-gate";
import {
  buildPasswordRecoveryConfirmUrl,
  getCanonicalAppOrigin,
} from "./canonical-app-origin";
import { scrubAuditMetadata } from "./security-audit";
import {
  assertRecoveryRedirectToHasNoQuery,
  buildRecoveryEmailHref,
} from "./recovery-email-template";

describe("password recovery gate", () => {
  const prevSecret = process.env.AUTH_SECRET;

  before(() => {
    process.env.AUTH_SECRET = "unit-test-auth-secret-for-gate";
  });

  after(() => {
    if (prevSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = prevSecret;
  });

  it("verifies employee gate and rejects client audience", async () => {
    const token = await createRecoveryGateToken({
      authUserId: "user-1",
      audience: "employee",
    });
    const ok = await verifyRecoveryGateToken(token, "employee");
    assert.equal(ok?.sub, "user-1");
    assert.equal(ok?.audience, "employee");
    assert.equal(await verifyRecoveryGateToken(token, "client"), null);
  });

  it("rejects expired-style purpose mismatch via wrong secret", async () => {
    const token = await createRecoveryGateToken({
      authUserId: "user-1",
      audience: "client",
    });
    process.env.AUTH_SECRET = "other-secret";
    assert.equal(await verifyRecoveryGateToken(token, "client"), null);
    process.env.AUTH_SECRET = "unit-test-auth-secret-for-gate";
  });

  it("uses minimal cookie paths and matching clear path", () => {
    assert.equal(recoveryCookieName("employee"), EMPLOYEE_RECOVERY_COOKIE);
    assert.equal(recoveryCookieName("client"), CLIENT_RECOVERY_COOKIE);
    assert.equal(
      recoveryCookiePath("employee"),
      EMPLOYEE_RECOVERY_COOKIE_PATH,
    );
    assert.equal(recoveryCookiePath("client"), CLIENT_RECOVERY_COOKIE_PATH);
    assert.equal(
      getRecoveryCookieOptions("employee").path,
      EMPLOYEE_RECOVERY_COOKIE_PATH,
    );
    assert.equal(
      getRecoveryCookieOptions("employee").maxAge,
      RECOVERY_GATE_MAX_AGE_SECONDS,
    );
    assert.ok(RECOVERY_GATE_MAX_AGE_SECONDS <= 600);
  });
});

describe("canonical origin and recovery email href", () => {
  it("builds employee and client confirm URLs without query", () => {
    const env = {
      NEXT_PUBLIC_APP_URL: "https://spiora-demo.vercel.app",
    } as NodeJS.ProcessEnv;
    assert.equal(
      getCanonicalAppOrigin(env),
      "https://spiora-demo.vercel.app",
    );
    assert.equal(
      buildPasswordRecoveryConfirmUrl("employee", env),
      "https://spiora-demo.vercel.app/auth/confirm/employee",
    );
    assert.equal(
      buildPasswordRecoveryConfirmUrl("client", env),
      "https://spiora-demo.vercel.app/auth/confirm/client",
    );
  });

  it("builds recovery email href without duplicating query", () => {
    const redirectTo = "https://spiora-demo.vercel.app/auth/confirm/employee";
    assert.equal(assertRecoveryRedirectToHasNoQuery(redirectTo), true);
    const href = buildRecoveryEmailHref(redirectTo, "abcTOKEN");
    assert.equal(
      href,
      "https://spiora-demo.vercel.app/auth/confirm/employee?token_hash=abcTOKEN&type=recovery",
    );
    assert.equal(
      assertRecoveryRedirectToHasNoQuery(`${redirectTo}?x=1`),
      false,
    );
  });
});

describe("audit scrubber and email_hash", () => {
  it("recursively strips secret keys including nested arrays", () => {
    const scrubbed = scrubAuditMetadata({
      reason: "ok",
      password: "x",
      nested: {
        token: "t",
        keep: true,
        list: [{ code: "1", safe: 2 }, "plain"],
      },
      cookie: "c",
      authorization: "Bearer x",
    }) as Record<string, unknown>;

    assert.equal(scrubbed.reason, "ok");
    assert.equal("password" in scrubbed, false);
    assert.equal("cookie" in scrubbed, false);
    assert.equal("authorization" in scrubbed, false);
    const nested = scrubbed.nested as Record<string, unknown>;
    assert.equal(nested.keep, true);
    assert.equal("token" in nested, false);
    const list = nested.list as unknown[];
    assert.deepEqual(list[0], { safe: 2 });
    assert.equal(list[1], "plain");
  });

  it("email_hash is stable, distinct, and pepper-dependent", () => {
    const pepper = "audit-pepper-test";
    const a = hashAuditEmail("  Admin@Example.COM ", pepper);
    const b = hashAuditEmail("admin@example.com", pepper);
    const c = hashAuditEmail("other@example.com", pepper);
    assert.ok(a);
    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.notEqual(a, hashAuditEmail("admin@example.com", "other-pepper"));
    const prev = process.env.SPIORA_AUDIT_HMAC_PEPPER;
    delete process.env.SPIORA_AUDIT_HMAC_PEPPER;
    assert.equal(hashAuditEmail("admin@example.com"), null);
    if (prev === undefined) delete process.env.SPIORA_AUDIT_HMAC_PEPPER;
    else process.env.SPIORA_AUDIT_HMAC_PEPPER = prev;
  });
});
