import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countryLabel,
  getCountryOptions,
  normalizeCountryAnswers,
  resolveCountryToIso,
} from "./questionnaire-countries.ts";
import { GENERAL_CLIENT_ONBOARDING_SCHEMA } from "./questionnaire-demo-template.ts";
import { applyAnswerOperations } from "./questionnaire-validation.ts";

describe("questionnaire countries", () => {
  it("resolves ISO codes and localized names", () => {
    assert.equal(resolveCountryToIso("HR"), "HR");
    assert.equal(resolveCountryToIso("hr"), "HR");
    assert.equal(resolveCountryToIso("Croatia"), "HR");
    assert.equal(resolveCountryToIso("Хорватия"), "HR");
    assert.equal(resolveCountryToIso("Россия"), "RU");
    assert.equal(resolveCountryToIso("Armenia"), "AM");
    assert.equal(resolveCountryToIso("NotACountry"), null);
  });

  it("builds localized option lists with ISO values", () => {
    const ru = getCountryOptions("ru");
    const en = getCountryOptions("en");
    assert.ok(ru.length > 100);
    assert.ok(en.some((o) => o.value === "HR"));
    const hrRu = ru.find((o) => o.value === "HR");
    assert.ok(hrRu);
    assert.match(hrRu!.label, /Хорват/i);
    assert.equal(countryLabel("HR", "en").toLowerCase().includes("croatia"), true);
  });

  it("normalizes country answers in schema payloads", () => {
    const normalized = normalizeCountryAnswers(GENERAL_CLIENT_ONBOARDING_SCHEMA, {
      citizenship: "Russia",
      country_of_residence: "армения",
      target_country: "HR",
      first_name: "Ada",
    });
    assert.equal(normalized.citizenship, "RU");
    assert.equal(normalized.country_of_residence, "AM");
    assert.equal(normalized.target_country, "HR");
    assert.equal(normalized.first_name, "Ada");
  });

  it("persists ISO codes when applying country answer operations", () => {
    const result = applyAnswerOperations(
      GENERAL_CLIENT_ONBOARDING_SCHEMA,
      [{ op: "set", questionId: "citizenship", value: "Хорватия" }],
      {},
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.merged.citizenship, "HR");
    }
  });
});
