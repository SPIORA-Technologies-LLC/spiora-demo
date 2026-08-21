import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  composeQuestionnairePhone,
  normalizeQuestionnairePhone,
  splitQuestionnairePhone,
} from "./questionnaire-phone.ts";

describe("questionnaire phone helpers", () => {
  it("normalizes to plus and digits", () => {
    assert.equal(normalizeQuestionnairePhone("+351 928 112 502"), "+351928112502");
    assert.equal(normalizeQuestionnairePhone(""), "");
  });

  it("splits an existing E.164-like number by dial code", () => {
    const parsed = splitQuestionnairePhone("+351928112502", "PT", "ru");
    assert.equal(parsed.iso, "PT");
    assert.equal(parsed.dial, "351");
    assert.equal(parsed.national, "928112502");
  });

  it("prefers residence country when ambiguous or empty", () => {
    const empty = splitQuestionnairePhone("", "PT", "en");
    assert.equal(empty.iso, "PT");
    assert.equal(empty.dial, "351");
    assert.equal(empty.national, "");
  });

  it("composes dial and national into stored phone", () => {
    assert.equal(composeQuestionnairePhone("351", "928 112 502"), "+351928112502");
    assert.equal(composeQuestionnairePhone("351", ""), "");
  });
});
