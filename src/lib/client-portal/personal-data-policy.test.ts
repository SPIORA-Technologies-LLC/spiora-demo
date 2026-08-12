import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getPersonalDataPolicy,
  personalDataPolicyPageTitle,
} from "./personal-data-policy.ts";

describe("personal data policy", () => {
  it("returns localized titles", () => {
    assert.equal(
      personalDataPolicyPageTitle("ru"),
      "Политика обработки персональных данных",
    );
    assert.equal(
      personalDataPolicyPageTitle("en"),
      "Personal Data Processing Policy",
    );
  });

  it("uses English registered address format", () => {
    const company = getPersonalDataPolicy("en").find(
      (block) => block.type === "company",
    );
    assert.ok(company && company.type === "company");
    assert.deepEqual(company.addressLines, [
      "9, Politekhnicheskaya Street,",
      "Oktyabrsky District, Bishkek, 720044,",
      "Kyrgyzstan",
    ]);
  });

  it("keeps Russian legal address for RU locale", () => {
    const company = getPersonalDataPolicy("ru").find(
      (block) => block.type === "company",
    );
    assert.ok(company && company.type === "company");
    assert.match(company.addressLines.join(" "), /Политехническая/);
  });

  it("includes cookies and local storage section in both locales", () => {
    const ru = getPersonalDataPolicy("ru");
    const en = getPersonalDataPolicy("en");
    assert.ok(
      ru.some(
        (block) =>
          block.type === "heading" &&
          block.text === "13. Cookies и локальное хранилище браузера",
      ),
    );
    assert.ok(
      en.some(
        (block) =>
          block.type === "heading" &&
          block.text === "13. Cookies and Browser Local Storage",
      ),
    );
    assert.ok(
      ru.some(
        (block) =>
          block.type === "heading" &&
          block.text === "14. Подтверждение ознакомления",
      ),
    );
    assert.ok(
      en.some(
        (block) =>
          block.type === "heading" && block.text === "14. Acknowledgement",
      ),
    );
    const ruText = JSON.stringify(ru);
    assert.match(ruText, /SPIORA_LOCALE/);
    assert.match(ruText, /Supabase/);
    assert.match(ruText, /MFA/);
    assert.doesNotMatch(ruText, /рекламн\w* сет/i);
  });
});
