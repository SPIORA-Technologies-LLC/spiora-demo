import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  firstNameFromAuthMetadata,
  normalizeName,
  resolveClientFirstName,
  resolveInvitationDisplayFirstName,
  toGivenName,
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

  it("uses only the given name when a full name was stored", () => {
    assert.equal(toGivenName("Хана Ивамото"), "Хана");
    assert.equal(
      resolveClientFirstName({
        authFirstName: "Хана Ивамото",
        questionnaireFirstName: null,
      }),
      "Хана",
    );
    assert.equal(
      resolveClientFirstName({
        authFirstName: null,
        questionnaireFirstName: "Hana Iwamoto",
      }),
      "Hana",
    );
    assert.equal(toGivenName("Jean-Pierre"), "Jean-Pierre");
  });

  it("reads first_name from auth metadata", () => {
    assert.equal(firstNameFromAuthMetadata({ first_name: "Olga" }), "Olga");
    assert.equal(firstNameFromAuthMetadata({ firstName: "Ivan" }), "Ivan");
    assert.equal(firstNameFromAuthMetadata({}), null);
  });

  it("prefers case given name over invite-time surname label", () => {
    assert.equal(
      resolveInvitationDisplayFirstName({
        invitationFirstName: "Новак",
        caseFirstName: "Матео",
      }),
      "Матео",
    );
    assert.equal(
      resolveInvitationDisplayFirstName({
        invitationFirstName: "Новак",
        caseFirstName: null,
      }),
      "Новак",
    );
    assert.equal(
      resolveInvitationDisplayFirstName({
        invitationFirstName: null,
        caseFirstName: null,
      }),
      null,
    );
  });
});
