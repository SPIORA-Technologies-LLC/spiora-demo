import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getMeetingRoomName, isVideoMeeting } from "./meeting";

describe("getMeetingRoomName", () => {
  it("uses spiora-cal prefix with event id", () => {
    assert.equal(getMeetingRoomName("evt_abc123"), "spiora-cal-evt_abc123");
  });
});

describe("isVideoMeeting", () => {
  it("returns true for video_meeting events", () => {
    assert.equal(isVideoMeeting({ eventType: "video_meeting" }), true);
  });

  it("returns false for general events", () => {
    assert.equal(isVideoMeeting({ eventType: "general" }), false);
  });
});
