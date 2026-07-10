import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CalendarEvent } from "./types";
import {
  canViewVideoMeeting,
  formatParticipantNames,
  getEffectiveVideoInviteMode,
  isUserInvitedToVideoMeeting,
  normalizeParticipantUserIds,
  resolveVideoMeetingReminderRecipientIds,
} from "./participants";

function videoEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "evt-video",
    companyId: "northstar-mobility",
    scope: "company",
    ownerUserId: null,
    title: "Sync",
    description: "",
    eventType: "video_meeting",
    videoInviteMode: "selected",
    participantUserIds: ["emma-wilson"],
    startAt: "2026-06-25T08:00:00.000Z",
    endAt: "2026-06-25T09:00:00.000Z",
    allDay: false,
    location: "",
    sendReminders: true,
    createdByUserId: "daniel-cooper",
    createdByName: "Злата",
    updatedByUserId: null,
    createdAt: "2026-06-20T10:00:00.000Z",
    updatedAt: "2026-06-20T10:00:00.000Z",
    ...overrides,
  };
}

describe("getEffectiveVideoInviteMode", () => {
  it("defaults company video meetings to all_team", () => {
    assert.equal(
      getEffectiveVideoInviteMode(
        videoEvent({ videoInviteMode: null, participantUserIds: [] }),
      ),
      "all_team",
    );
  });

  it("returns null for general events", () => {
    assert.equal(
      getEffectiveVideoInviteMode(
        videoEvent({ eventType: "general", videoInviteMode: null }),
      ),
      null,
    );
  });
});

describe("isUserInvitedToVideoMeeting", () => {
  it("allows selected participants and creator", () => {
    const event = videoEvent();
    assert.equal(isUserInvitedToVideoMeeting("daniel-cooper", event), true);
    assert.equal(isUserInvitedToVideoMeeting("emma-wilson", event), true);
    assert.equal(isUserInvitedToVideoMeeting("lucas-martin", event), false);
  });

  it("allows all team for company all_team mode", () => {
    const event = videoEvent({
      videoInviteMode: "all_team",
      participantUserIds: [],
    });
    assert.equal(isUserInvitedToVideoMeeting("lucas-martin", event), true);
  });
});

describe("canViewVideoMeeting", () => {
  it("hides selected company meetings from non-invited users", () => {
    const event = videoEvent();
    assert.equal(canViewVideoMeeting({ id: "lucas-martin" }, event), false);
  });
});

describe("normalizeParticipantUserIds", () => {
  it("dedupes and excludes creator", () => {
    assert.deepEqual(
      normalizeParticipantUserIds(
        ["emma-wilson", "emma-wilson", "daniel-cooper", "unknown"],
        "daniel-cooper",
      ),
      ["emma-wilson"],
    );
  });
});

describe("resolveVideoMeetingReminderRecipientIds", () => {
  const active = ["olivia-bennett", "daniel-cooper", "emma-wilson", "lucas-martin"];

  it("notifies only invited users for selected meetings", () => {
    assert.deepEqual(
      resolveVideoMeetingReminderRecipientIds(videoEvent(), active),
      ["daniel-cooper", "emma-wilson"],
    );
  });

  it("notifies all active users for all_team meetings", () => {
    assert.deepEqual(
      resolveVideoMeetingReminderRecipientIds(
        videoEvent({ videoInviteMode: "all_team", participantUserIds: [] }),
        active,
      ),
      active,
    );
  });
});

describe("formatParticipantNames", () => {
  it("shows all team label", () => {
    assert.equal(
      formatParticipantNames(
        videoEvent({ videoInviteMode: "all_team", participantUserIds: [] }),
        [
          { id: "daniel-cooper", name: "Злата" },
          { id: "emma-wilson", name: "Юля" },
        ],
      ),
      "Вся команда",
    );
  });
});
