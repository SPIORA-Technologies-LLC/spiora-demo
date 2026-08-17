import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildConsultingAgreementPreview,
  extractConsultingAgreementParty,
  formatPersonFullName,
  isoDateToAgreementNumber,
} from "./consulting-agreement-fields.ts";
import { GENERAL_CLIENT_ONBOARDING_SCHEMA } from "./questionnaire-demo-template.ts";
import { validateAnswersAgainstSchema } from "./questionnaire-validation.ts";

describe("consulting agreement merge fields", () => {
  it("formats Russian FIO last-first-patronymic", () => {
    assert.equal(
      formatPersonFullName({
        firstName: "Иван",
        lastName: "Иванов",
        patronymic: "Иванович",
        locale: "ru",
      }),
      "Иванов Иван Иванович",
    );
  });

  it("fills party fields from questionnaire answers", () => {
    const party = extractConsultingAgreementParty(
      {
        first_name: "Ivan",
        last_name: "Ivanov",
        patronymic: "Ivanovich",
        passport_number: "AB123456",
        passport_issue_date: "2020-01-15",
        country_of_residence: "HR",
        postal_code: "10000",
        city: "Zagreb",
        address: "Ilica 1",
        email: "ivan@example.com",
        phone: "+385123456",
      },
      "en",
    );
    assert.equal(party.fullName, "Ivan Ivanovich Ivanov");
    assert.equal(party.passportNumber, "AB123456");
    assert.match(party.passportIssueDate, /15/);
    assert.match(party.country.toLowerCase(), /croatia/);
    assert.equal(party.postalCode, "10000");
    assert.equal(party.city, "Zagreb");
    assert.equal(party.address, "Ilica 1");
    assert.equal(party.email, "ivan@example.com");
    assert.equal(party.phone, "+385123456");
    assert.equal(isoDateToAgreementNumber("2026-08-14"), "2026/08/14");
  });

  it("requires explicit true for agreement consent", () => {
    const base = {
      first_name: "Ivan",
      last_name: "Ivanov",
      date_of_birth: "1990-01-01",
      citizenship: "UA",
      phone: "+3801234567",
      country_of_residence: "HR",
      postal_code: "10000",
      city: "Zagreb",
      address: "Zagreb",
      passport_number: "AB123456",
      passport_issue_date: "2020-01-15",
      employment_status: "employed",
      service_goal: "consultation",
      target_country: "HR",
      data_accuracy_confirmation: true,
      privacy_acknowledgement: true,
      consulting_agreement_acknowledgement: false,
    };
    const errors = validateAnswersAgainstSchema(
      GENERAL_CLIENT_ONBOARDING_SCHEMA,
      base,
      "en",
    );
    assert.ok(
      errors.some((item) => item.questionId === "consulting_agreement_acknowledgement"),
    );
    const preview = buildConsultingAgreementPreview(base, "en");
    assert.equal(preview.clientAccepted, false);
  });
});
