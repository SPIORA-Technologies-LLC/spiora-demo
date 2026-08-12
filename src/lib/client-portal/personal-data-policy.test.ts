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
});
