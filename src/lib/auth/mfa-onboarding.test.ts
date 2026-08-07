import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  EMPLOYEE_MFA_ONBOARDING_STORAGE_PREFIX,
  employeeMfaOnboardingStorageKey,
  hasSeenEmployeeMfaOnboarding,
  markEmployeeMfaOnboardingSeen,
} from "./mfa-onboarding.ts";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key() {
      return null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

describe("employee MFA onboarding storage (C.2)", () => {
  it("keys are scoped per employee user", () => {
    assert.equal(
      employeeMfaOnboardingStorageKey("emp-a"),
      `${EMPLOYEE_MFA_ONBOARDING_STORAGE_PREFIX}emp-a`,
    );
    assert.notEqual(
      employeeMfaOnboardingStorageKey("emp-a"),
      employeeMfaOnboardingStorageKey("emp-b"),
    );
  });

  it("marks and reads seen flag", () => {
    const store = memoryStorage();
    assert.equal(hasSeenEmployeeMfaOnboarding("u1", store), false);
    markEmployeeMfaOnboardingSeen("u1", store);
    assert.equal(hasSeenEmployeeMfaOnboarding("u1", store), true);
    assert.equal(hasSeenEmployeeMfaOnboarding("u2", store), false);
  });

  it("UX-only: employee surfaces exist; client portal and MFA logic untouched", () => {
    const root = process.cwd();
    const onboarding = readFileSync(
      path.join(root, "src/lib/auth/mfa-onboarding.ts"),
      "utf8",
    );
    assert.doesNotMatch(onboarding, /mfa-service|middleware|SPIORA_MFA/);

    const panel = readFileSync(
      path.join(root, "src/components/auth/MfaSettingsPanel.tsx"),
      "utf8",
    );
    assert.match(panel, /MfaEducationModal/);
    assert.match(panel, /onboarding\.infoBlurb/);
    assert.match(panel, /onboarding\.enabledSuccessTitle/);
    assert.match(panel, /onboarding\.disabledTitle/);

    const shell = readFileSync(
      path.join(root, "src/components/layout/AppShell.tsx"),
      "utf8",
    );
    assert.match(shell, /EmployeeMfaOnboardingHost/);

    const home = readFileSync(
      path.join(root, "src/components/client-portal/ClientPortalHome.tsx"),
      "utf8",
    );
    assert.doesNotMatch(home, /MfaEducationModal|EmployeeMfaOnboardingHost/);

    const en = readFileSync(path.join(root, "src/i18n/dictionaries/en.json"), "utf8");
    const ru = readFileSync(path.join(root, "src/i18n/dictionaries/ru.json"), "utf8");
    assert.match(en, /Protect your work account with two-factor authentication/);
    assert.match(ru, /Защитите рабочий аккаунт с помощью двухфакторной аутентификации/);
    assert.match(en, /strongly recommend using two-factor authentication/);
    assert.match(ru, /настоятельно рекомендуем использовать двухфакторную аутентификацию/);
  });
});
