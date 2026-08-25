import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMeetingRecordingSavedRecipientIds } from "./emit";

describe("buildMeetingRecordingSavedRecipientIds", () => {
  it("keeps distinct team joiners and excludes guests", () => {
    assert.deepEqual(
      buildMeetingRecordingSavedRecipientIds(
        ["daniel-cooper", "guest-abc", "emma-wilson", "daniel-cooper"],
        "lucas-martin",
      ).sort(),
      ["daniel-cooper", "emma-wilson", "lucas-martin"],
    );
  });

  it("falls back to startedBy when no joiners were audited", () => {
    assert.deepEqual(
      buildMeetingRecordingSavedRecipientIds([], "daniel-cooper"),
      ["daniel-cooper"],
    );
  });

  it("returns empty when nobody eligible", () => {
    assert.deepEqual(buildMeetingRecordingSavedRecipientIds(["guest-1"], null), []);
  });
});
