import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeExternalInviteeEmail,
  normalizeExternalInviteeName,
  normalizeExternalInvitees,
} from "./external-invitees";

describe("normalizeExternalInvitees", () => {
  it("keeps valid name/email pairs and drops invalid ones", () => {
    assert.deepEqual(
      normalizeExternalInvitees([
        { name: "  Alex Partner ", email: "Alex@Example.com" },
        { name: "x", email: "bad" },
        { name: "No Email", email: "" },
        { name: "No Email", email: null },
        "skip",
      ]),
      [
        { name: "Alex Partner", email: "alex@example.com" },
        { name: "No Email", email: null },
      ],
    );
  });

  it("caps the list size", () => {
    const input = Array.from({ length: 25 }, (_, index) => ({
      name: `Person ${index + 10}`,
      email: null,
    }));
    assert.equal(normalizeExternalInvitees(input).length, 20);
  });
});

describe("normalizeExternalInviteeName / Email", () => {
  it("rejects short names and invalid emails", () => {
    assert.equal(normalizeExternalInviteeName("A"), null);
    assert.equal(normalizeExternalInviteeEmail("not-an-email"), null);
    assert.equal(normalizeExternalInviteeEmail("ok@example.com"), "ok@example.com");
  });
});
