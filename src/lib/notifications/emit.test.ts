import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildVideoMeetingInviteNotificationOptions } from "./emit";

describe("buildVideoMeetingInviteNotificationOptions", () => {
  it("keeps the organizer in the explicit recipient allowlist", () => {
    assert.deepEqual(
      buildVideoMeetingInviteNotificationOptions([
        "daniel-cooper",
        "emma-wilson",
      ]),
      {
        onlyUserIds: ["daniel-cooper", "emma-wilson"],
      },
    );
  });
});
