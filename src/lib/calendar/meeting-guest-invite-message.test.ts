import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CalendarEvent } from "./types";
import { buildGuestMeetingInviteText } from "./meeting-guest-invite-message";

const event: CalendarEvent = {
  id: "evt-video",
  companyId: "northstar-mobility",
  scope: "company",
  ownerUserId: null,
  title: "Relocation consultation",
  description: "",
  eventType: "video_meeting",
  videoInviteMode: "all_team",
  guestWaitingRoom: true,
  guestMaxCount: 10,
  guestAccessPasswordHash: null,
  guestAccessPasswordSet: false,
  linkedClientId: null,
  linkedClientName: null,
  externalInvitees: [],
  participantUserIds: [],
  startAt: "2026-07-08T13:00:00.000Z",
  endAt: "2026-07-08T14:00:00.000Z",
  allDay: false,
  location: "",
  sendReminders: true,
  createdByUserId: "daniel-cooper",
  createdByName: "Daniel Cooper",
  updatedByUserId: null,
  createdAt: "2026-07-01T10:00:00.000Z",
  updatedAt: "2026-07-01T10:00:00.000Z",
};

describe("buildGuestMeetingInviteText", () => {
  it("builds a full RU invite with greeting, schedule and link", () => {
    const text = buildGuestMeetingInviteText(
      event,
      "https://example.com/join/abc123",
      { recipientName: "Anna", timeZone: "Europe/Moscow", locale: "ru" },
    );

    assert.match(text, /Добрый день, Anna!/);
    assert.match(text, /Relocation consultation/);
    assert.match(text, /Когда:/);
    assert.match(text, /https:\/\/example\.com\/join\/abc123/);
    assert.match(text, /Команда Northstar Mobility/);
  });

  it("builds a full EN invite without Cyrillic UI strings", () => {
    const text = buildGuestMeetingInviteText(
      event,
      "https://example.com/join/abc123",
      { recipientName: "Anna", timeZone: "Europe/Moscow", locale: "en" },
    );

    assert.doesNotMatch(text, /[А-Яа-яЁё]/);
    assert.match(text, /Good (morning|afternoon|evening), Anna!/);
    assert.match(text, /When:/);
    assert.match(text, /https:\/\/example\.com\/join\/abc123/);
  });
});
