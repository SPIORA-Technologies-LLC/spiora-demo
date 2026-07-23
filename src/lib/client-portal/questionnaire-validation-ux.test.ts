import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { GENERAL_CLIENT_ONBOARDING_SCHEMA } from "./questionnaire-demo-template.ts";
import { validateAnswersAgainstSchema } from "./questionnaire-validation.ts";
import {
  buildValidationFailurePayload,
  mapValidationCodeToReason,
} from "./questionnaire-validation-payload.ts";
import {
  buildSectionFocusHref,
  fieldLabelFromSchema,
  getNextValidationError,
  orderValidationErrors,
  readFocusQuestionIdFromSearch,
  revalidateAnswersLocally,
} from "./questionnaire-validation-ui.ts";

describe("questionnaire validation UX payload", () => {
  it("marks stale select options as OPTION_NO_LONGER_EXISTS", () => {
    const errors = validateAnswersAgainstSchema(
      GENERAL_CLIENT_ONBOARDING_SCHEMA,
      {
        gender: "legacy_gender",
        income_currency: "RUR",
      },
      "en",
    );
    const gender = errors.find((e) => e.questionId === "gender");
    const currency = errors.find((e) => e.questionId === "income_currency");
    assert.ok(gender);
    assert.equal(gender?.code, "INVALID_OPTION");
    assert.equal(gender?.reason, "OPTION_NO_LONGER_EXISTS");
    assert.ok(gender?.fieldLabel);
    assert.notEqual(gender?.fieldLabel, "gender");
    assert.ok(currency);
    assert.equal(currency?.code, "INVALID_OPTION");
    assert.equal(currency?.reason, "INVALID_CURRENCY");
  });

  it("builds structured validation failure payload with localized labels", () => {
    const errors = validateAnswersAgainstSchema(
      GENERAL_CLIENT_ONBOARDING_SCHEMA,
      {
        citizenship: "NotARealCountryXYZ",
        country_of_residence: "???",
        income_currency: "RUR",
        target_country: "NopeLand",
      },
      "ru",
    ).filter((e) =>
      [
        "citizenship",
        "country_of_residence",
        "income_currency",
        "target_country",
      ].includes(e.questionId),
    );
    const payload = buildValidationFailurePayload(errors);
    assert.equal(payload.code, "QUESTIONNAIRE_VALIDATION_FAILED");
    assert.match(payload.message, /invalid answers/i);
    assert.ok(payload.invalidFields.includes("citizenship"));
    assert.ok(payload.invalidFields.includes("income_currency"));
    assert.equal(payload.invalidFields.length, payload.invalidFieldDetails.length);
    for (const detail of payload.invalidFieldDetails) {
      assert.ok(detail.field);
      assert.ok(detail.section);
      assert.ok(detail.reason);
      assert.ok(detail.label);
      assert.notEqual(detail.label, detail.field);
    }
    const currency = payload.invalidFieldDetails.find(
      (d) => d.field === "income_currency",
    );
    assert.equal(currency?.reason, "INVALID_CURRENCY");
    const citizenship = payload.invalidFieldDetails.find(
      (d) => d.field === "citizenship",
    );
    assert.equal(citizenship?.reason, "INVALID_COUNTRY");
  });

  it("accepts country names and normalizes them to ISO codes", () => {
    const errors = validateAnswersAgainstSchema(
      GENERAL_CLIENT_ONBOARDING_SCHEMA,
      {
        citizenship: "Россия",
        country_of_residence: "Armenia",
        target_country: "Croatia",
      },
      "ru",
    ).filter((e) =>
      ["citizenship", "country_of_residence", "target_country"].includes(
        e.questionId,
      ),
    );
    assert.equal(errors.length, 0);
  });

  it("maps validation codes to stable reasons for future UX", () => {
    assert.equal(mapValidationCodeToReason("REQUIRED"), "MISSING_REQUIRED");
    assert.equal(
      mapValidationCodeToReason("INVALID_OPTION"),
      "OPTION_NO_LONGER_EXISTS",
    );
    assert.equal(
      mapValidationCodeToReason("INVALID_OPTION", "income_currency"),
      "INVALID_CURRENCY",
    );
    assert.equal(mapValidationCodeToReason("INVALID_COUNTRY"), "INVALID_COUNTRY");
    assert.equal(
      mapValidationCodeToReason("QUESTIONNAIRE_SCHEMA_INVALID"),
      "SCHEMA_VERSION_MISMATCH",
    );
  });
});

describe("questionnaire validation UX navigation helpers", () => {
  it("orders errors by schema question order", () => {
    const unordered = [
      {
        sectionId: "service_information",
        questionId: "target_country",
        code: "INVALID_COUNTRY",
        message: "x",
      },
      {
        sectionId: "personal_information",
        questionId: "citizenship",
        code: "INVALID_COUNTRY",
        message: "y",
      },
    ];
    const ordered = orderValidationErrors(
      GENERAL_CLIENT_ONBOARDING_SCHEMA,
      unordered,
    );
    assert.equal(ordered[0]?.questionId, "citizenship");
    assert.equal(ordered[1]?.questionId, "target_country");
  });

  it("jumps to next invalid field and wraps around", () => {
    const errors = [
      {
        sectionId: "personal_information",
        questionId: "citizenship",
        code: "INVALID_COUNTRY",
        message: "a",
      },
      {
        sectionId: "contact_information",
        questionId: "country_of_residence",
        code: "INVALID_COUNTRY",
        message: "b",
      },
    ];
    const next = getNextValidationError(
      GENERAL_CLIENT_ONBOARDING_SCHEMA,
      errors,
      "citizenship",
    );
    assert.equal(next?.questionId, "country_of_residence");
    const wrap = getNextValidationError(
      GENERAL_CLIENT_ONBOARDING_SCHEMA,
      errors,
      "country_of_residence",
    );
    assert.equal(wrap?.questionId, "citizenship");
  });

  it("builds focus href and parses focus query", () => {
    const href = buildSectionFocusHref("personal_information", "citizenship");
    assert.equal(
      href,
      "/client/questionnaire/personal_information?focus=citizenship",
    );
    assert.equal(
      readFocusQuestionIdFromSearch("?focus=citizenship"),
      "citizenship",
    );
    assert.equal(readFocusQuestionIdFromSearch(""), null);
  });

  it("returns localized field labels from schema", () => {
    const en = fieldLabelFromSchema(
      GENERAL_CLIENT_ONBOARDING_SCHEMA,
      "citizenship",
      "en",
    );
    const ru = fieldLabelFromSchema(
      GENERAL_CLIENT_ONBOARDING_SCHEMA,
      "citizenship",
      "ru",
    );
    assert.equal(en, "Citizenship");
    assert.equal(ru, "Гражданство");
  });

  it("clears a fixed field during local revalidation", () => {
    const invalid = revalidateAnswersLocally(
      GENERAL_CLIENT_ONBOARDING_SCHEMA,
      { income_currency: "RUR" },
      "en",
    );
    assert.ok(invalid.some((e) => e.questionId === "income_currency"));

    const fixed = revalidateAnswersLocally(
      GENERAL_CLIENT_ONBOARDING_SCHEMA,
      { income_currency: "EUR" },
      "en",
    );
    assert.equal(
      fixed.some((e) => e.questionId === "income_currency"),
      false,
    );
  });
});

describe("questionnaire validation UX localization keys", () => {
  function loadDict(name: "en" | "ru") {
    const raw = readFileSync(
      path.join(process.cwd(), `src/i18n/dictionaries/${name}.json`),
      "utf8",
    );
    return JSON.parse(raw) as {
      clientPortal: {
        questionnaire: {
          validation: Record<string, unknown>;
        };
      };
    };
  }

  it("includes EN validation UX keys", () => {
    const en = loadDict("en").clientPortal.questionnaire.validation;
    assert.equal(typeof en.summaryTitle, "string");
    assert.equal(typeof en.fixErrors, "string");
    assert.equal(typeof en.nextError, "string");
    assert.equal(typeof en.questionnaireUpdated, "string");
    assert.equal(typeof en.invalidOption, "string");
    const reasons = en.reasons as Record<string, string>;
    assert.equal(typeof reasons.OPTION_NO_LONGER_EXISTS, "string");
    assert.equal(typeof reasons.MISSING_REQUIRED, "string");
  });

  it("includes RU validation UX keys", () => {
    const ru = loadDict("ru").clientPortal.questionnaire.validation;
    assert.match(String(ru.summaryTitle), /устаревш/i);
    assert.match(String(ru.fixErrors), /Исправить/i);
    assert.match(String(ru.nextError), /Следующ/i);
    const reasons = ru.reasons as Record<string, string>;
    assert.match(String(reasons.OPTION_NO_LONGER_EXISTS), /недоступен/i);
  });
});
