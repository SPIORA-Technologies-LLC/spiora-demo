import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  firstNameFromAuthMetadata,
  normalizeName,
  resolveClientFirstName,
} from "./display-name.ts";

describe("client display name", () => {
  it("normalizes and rejects empty names", () => {
    assert.equal(normalizeName("  Olga  "), "Olga");
    assert.equal(normalizeName("   "), null);
    assert.equal(normalizeName(123), null);
  });

  it("prefers auth metadata over questionnaire", () => {
    assert.equal(
      resolveClientFirstName({
        authFirstName: "Olga",
        questionnaireFirstName: "Anna",
      }),
      "Olga",
    );
    assert.equal(
      resolveClientFirstName({
        authFirstName: null,
        questionnaireFirstName: "Anna",
      }),
      "Anna",
    );
  });

  it("reads first_name from auth metadata", () => {
    assert.equal(firstNameFromAuthMetadata({ first_name: "Olga" }), "Olga");
    assert.equal(firstNameFromAuthMetadata({ firstName: "Ivan" }), "Ivan");
    assert.equal(firstNameFromAuthMetadata({}), null);
  });
});
