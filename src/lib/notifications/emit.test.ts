import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCalendarEventCreatedRecipientIds } from "./emit";

describe("buildCalendarEventCreatedRecipientIds", () => {
  it("always includes the organizer even for personal events", () => {
    assert.deepEqual(
      buildCalendarEventCreatedRecipientIds(
        {
          id: "evt-1",
          companyId: "northstar-mobility",
          scope: "personal",
          ownerUserId: "daniel-cooper",
          title: "Client call",
          description: "",
          eventType: "general",
          videoInviteMode: null,
          guestWaitingRoom: true,
          guestMaxCount: null,
          guestAccessPasswordHash: null,
          guestAccessPasswordSet: false,
          linkedClientId: null,
          linkedClientName: null,
          externalInvitees: [],
          participantUserIds: [],
          startAt: "2026-06-25T08:00:00.000Z",
          endAt: "2026-06-25T09:00:00.000Z",
          allDay: false,
          location: "",
          sendReminders: true,
          createdByUserId: "daniel-cooper",
          createdByName: "Daniel Cooper",
          updatedByUserId: null,
          createdAt: "2026-06-20T10:00:00.000Z",
          updatedAt: "2026-06-20T10:00:00.000Z",
        },
        ["daniel-cooper", "emma-wilson"],
      ),
      ["daniel-cooper"],
    );
  });
});
