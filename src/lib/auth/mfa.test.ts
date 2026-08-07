import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, before, after } from "node:test";
import { isEmployeeMfaEnabled, MFA_MAX_VERIFIED_TOTP_FACTORS } from "./mfa-config";
import {
  needsMfaChallenge,
  isAal2,
  reconcileAalWithVerifiedFactors,
} from "./mfa-aal";
import {
  isMfaExemptApiPath,
  isMfaGatePath,
  isEmployeeApiPath,
} from "./mfa-paths";
import {
  formatRecoveryCode,
  generateRecoveryCodes,
  getMfaRecoveryPepper,
  hashRecoveryCode,
  normalizeRecoveryCode,
  recoveryCodesMatch,
} from "./mfa-recovery-codes";

describe("employee MFA config", () => {
  it("defaults off unless SPIORA_MFA_EMPLOYEE=true", () => {
    assert.equal(isEmployeeMfaEnabled({}), false);
    assert.equal(isEmployeeMfaEnabled({ SPIORA_MFA_EMPLOYEE: "false" }), false);
    assert.equal(isEmployeeMfaEnabled({ SPIORA_MFA_EMPLOYEE: "true" }), true);
  });

  it("v1 allows one verified TOTP factor", () => {
    assert.equal(MFA_MAX_VERIFIED_TOTP_FACTORS, 1);
  });
});

describe("MFA AAL helpers", () => {
  it("needs challenge only for aal1→aal2", () => {
    assert.equal(
      needsMfaChallenge({ currentLevel: "aal1", nextLevel: "aal2" }),
      true,
    );
    assert.equal(
      needsMfaChallenge({ currentLevel: "aal2", nextLevel: "aal2" }),
      false,
    );
    assert.equal(
      needsMfaChallenge({ currentLevel: "aal1", nextLevel: "aal1" }),
      false,
    );
    assert.equal(needsMfaChallenge(null), false);
  });

  it("detects aal2", () => {
    assert.equal(isAal2({ currentLevel: "aal2", nextLevel: "aal2" }), true);
    assert.equal(isAal2({ currentLevel: "aal1", nextLevel: "aal2" }), false);
  });

  it("regression: verified TOTP + fresh AAL1 password session (empty session.user.factors) → challenge", () => {
    // auth-js without JWT leaves nextLevel=aal1 when session.user.factors is empty
    // even though auth.mfa_factors has a verified TOTP row.
    const staleAal = { currentLevel: "aal1", nextLevel: "aal1" };
    assert.equal(needsMfaChallenge(staleAal), false);

    const reconciled = reconcileAalWithVerifiedFactors(staleAal, 1);
    assert.deepEqual(reconciled, { currentLevel: "aal1", nextLevel: "aal2" });
    assert.equal(needsMfaChallenge(reconciled), true);
    // Post-login / middleware must send /mfa/challenge, not /dashboard.
  });

  it("reconcile does not downgrade aal2 or invent factors", () => {
    assert.deepEqual(
      reconcileAalWithVerifiedFactors(
        { currentLevel: "aal2", nextLevel: "aal2" },
        1,
      ),
      { currentLevel: "aal2", nextLevel: "aal2" },
    );
    assert.deepEqual(
      reconcileAalWithVerifiedFactors(
        { currentLevel: "aal1", nextLevel: "aal1" },
        0,
      ),
      { currentLevel: "aal1", nextLevel: "aal1" },
    );
  });
});

describe("MFA path allowlists", () => {
  it("gate paths cover /mfa only", () => {
    assert.equal(isMfaGatePath("/mfa/challenge"), true);
    assert.equal(isMfaGatePath("/mfa/recovery"), true);
    assert.equal(isMfaGatePath("/settings/mfa"), false);
    assert.equal(isMfaGatePath("/dashboard"), false);
  });

  it("exempts MFA and public auth APIs from AAL2 API gate", () => {
    assert.equal(isMfaExemptApiPath("/api/auth/mfa/challenge"), true);
    assert.equal(isMfaExemptApiPath("/api/auth/mfa/recovery"), true);
    assert.equal(isMfaExemptApiPath("/api/auth/password/forgot"), true);
    assert.equal(isMfaExemptApiPath("/api/client/auth/oauth/google"), true);
    assert.equal(isMfaExemptApiPath("/api/clients"), false);
    assert.equal(isEmployeeApiPath("/api/tasks"), true);
    assert.equal(isEmployeeApiPath("/api/client/cases"), false);
  });
});

describe("recovery codes", () => {
  const prev = {
    pepper: process.env.SPIORA_MFA_RECOVERY_PEPPER,
    audit: process.env.SPIORA_AUDIT_HMAC_PEPPER,
    auth: process.env.AUTH_SECRET,
  };

  before(() => {
    process.env.SPIORA_MFA_RECOVERY_PEPPER = "unit-test-mfa-pepper";
    delete process.env.SPIORA_AUDIT_HMAC_PEPPER;
  });

  after(() => {
    if (prev.pepper === undefined) delete process.env.SPIORA_MFA_RECOVERY_PEPPER;
    else process.env.SPIORA_MFA_RECOVERY_PEPPER = prev.pepper;
    if (prev.audit === undefined) delete process.env.SPIORA_AUDIT_HMAC_PEPPER;
    else process.env.SPIORA_AUDIT_HMAC_PEPPER = prev.audit;
    if (prev.auth === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = prev.auth;
  });

  it("normalizes and formats codes", () => {
    assert.equal(normalizeRecoveryCode("ab12-cd34"), "AB12CD34");
    assert.equal(formatRecoveryCode("AB12CD34"), "AB12-CD34");
  });

  it("hashes stably and compares safely", () => {
    const pepper = getMfaRecoveryPepper()!;
    const a = hashRecoveryCode("AB12-CD34", pepper);
    const b = hashRecoveryCode("ab12cd34", pepper);
    assert.equal(a, b);
    assert.equal(recoveryCodesMatch(a, b), true);
    assert.equal(recoveryCodesMatch(a, hashRecoveryCode("ZZZZ-ZZZZ", pepper)), false);
  });

  it("generates unique formatted codes", () => {
    const codes = generateRecoveryCodes(10);
    assert.equal(codes.length, 10);
    assert.equal(new Set(codes).size, 10);
    for (const code of codes) {
      assert.match(code, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    }
  });
});

describe("Phase C source invariants", () => {
  it("recovery flow uses admin deleteFactor, not fake AAL2 / bypass cookie", () => {
    const recovery = readFileSync(
      path.join(process.cwd(), "src/lib/auth/mfa-recovery.ts"),
      "utf8",
    );
    assert.match(recovery, /admin\.mfa\.deleteFactor/);
    assert.doesNotMatch(recovery, /aal2.*bypass|mfa_bypass|fake.?aal/i);
    assert.match(recovery, /signOut/);
    assert.match(recovery, /mfa_reenroll_required/);
  });

  it("does not treat recovery codes as Supabase second factor", () => {
    const recovery = readFileSync(
      path.join(process.cwd(), "src/lib/auth/mfa-recovery.ts"),
      "utf8",
    );
    assert.doesNotMatch(recovery, /challengeAndVerify/);
    assert.doesNotMatch(recovery, /getAuthenticatorAssuranceLevel/);
  });

  it("feature flag documented default off in env examples", () => {
    const example = readFileSync(
      path.join(process.cwd(), ".env.spiora.example"),
      "utf8",
    );
    assert.match(example, /SPIORA_MFA_EMPLOYEE/);
    assert.match(example, /SPIORA_MFA_EMPLOYEE=false/);
  });

  it("no client MFA API routes under client plane", () => {
    assert.equal(
      existsSync(path.join(process.cwd(), "src/app/api/client/auth/mfa")),
      false,
    );
  });

  it("AAL readers pass JWT / reconcile verified factors (password-session bug)", () => {
    const service = readFileSync(
      path.join(process.cwd(), "src/lib/auth/mfa-service.ts"),
      "utf8",
    );
    assert.match(service, /getAuthenticatorAssuranceLevel\(\s*\n?\s*session\.access_token/);
    assert.match(service, /reconcileAalWithVerifiedFactors/);
    assert.match(service, /listFactors/);

    const middlewareAuth = readFileSync(
      path.join(process.cwd(), "src/lib/supabase/middleware-auth.ts"),
      "utf8",
    );
    assert.match(
      middlewareAuth,
      /getAuthenticatorAssuranceLevel\(accessToken\)/,
    );
    assert.match(middlewareAuth, /reconcileAalWithVerifiedFactors/);
  });
});
