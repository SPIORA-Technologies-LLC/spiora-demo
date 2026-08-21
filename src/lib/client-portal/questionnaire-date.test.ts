import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatQuestionnaireDate,
  isCompleteQuestionnaireDateInput,
  parseQuestionnaireDate,
} from "./questionnaire-date.ts";

describe("questionnaire date locale helpers", () => {
  it("formats ISO for RU as dd.mm.yyyy", () => {
    assert.equal(formatQuestionnaireDate("1990-01-05", "ru"), "05.01.1990");
  });

  it("formats ISO for EN as mm/dd/yyyy", () => {
    assert.equal(formatQuestionnaireDate("1990-01-05", "en"), "01/05/1990");
  });

  it("parses Russian day-first dates", () => {
    assert.equal(parseQuestionnaireDate("05.01.1990", "ru"), "1990-01-05");
    assert.equal(parseQuestionnaireDate("5.1.1990", "ru"), "1990-01-05");
  });

  it("parses English month-first dates", () => {
    assert.equal(parseQuestionnaireDate("01/05/1990", "en"), "1990-01-05");
    assert.equal(parseQuestionnaireDate("1/5/1990", "en"), "1990-01-05");
  });

  it("always accepts ISO", () => {
    assert.equal(parseQuestionnaireDate("1990-01-05", "ru"), "1990-01-05");
    assert.equal(parseQuestionnaireDate("1990-01-05", "en"), "1990-01-05");
  });

  it("expands two-digit years only for complete triples", () => {
    assert.equal(parseQuestionnaireDate("09.09.19", "ru"), "2019-09-09");
    assert.equal(parseQuestionnaireDate("09.09.85", "ru"), "1985-09-09");
    assert.equal(parseQuestionnaireDate("09/09/19", "en"), "2019-09-09");
  });

  it("detects incomplete years while typing", () => {
    assert.equal(isCompleteQuestionnaireDateInput("09.09.19"), false);
    assert.equal(isCompleteQuestionnaireDateInput("09.09.198"), false);
    assert.equal(isCompleteQuestionnaireDateInput("09.09.1985"), true);
    assert.equal(isCompleteQuestionnaireDateInput("1990-01-05"), true);
  });

  it("rejects impossible dates", () => {
    assert.equal(parseQuestionnaireDate("31.02.1990", "ru"), null);
    assert.equal(parseQuestionnaireDate("02/31/1990", "en"), null);
  });
});
