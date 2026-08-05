import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SessionUser } from "@/lib/auth/types";
import type { CalendarEvent } from "./types";
import {
  assertCanJoinMeeting,
  assertCanRecordMeetingAudit,
  getMeetingAccessPhase,
  getMeetingAccessWindow,
  isWithinMeetingWindow,
  MEETING_LATE_MINUTES,
  MeetingAccessError,
} from "./meeting-access";

const managerA: SessionUser = {
  id: "daniel-cooper",
  name: "Злата",
  email: "manager1@test.com",
  role: "manager",
};

const managerB: SessionUser = {
  id: "emma-wilson",
  name: "Юля",
  email: "manager2@test.com",
  role: "manager",
};

function videoEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "evt-video",
    companyId: "northstar-mobility",
    scope: "personal",
    ownerUserId: managerA.id,
    title: "Sync",
    description: "",
    eventType: "video_meeting",
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
    endAt: "2026-06-25T08:30:00.000Z",
    allDay: false,
    location: "",
    sendReminders: true,
    createdByUserId: managerA.id,
    createdByName: managerA.name,
    updatedByUserId: null,
    createdAt: "2026-06-20T10:00:00.000Z",
    updatedAt: "2026-06-20T10:00:00.000Z",
    ...overrides,
  };
}

describe("getMeetingAccessWindow", () => {
  it("opens immediately and closes 15 minutes after end", () => {
    const event = videoEvent();
    const { opensAt, closesAt } = getMeetingAccessWindow(event);

    assert.equal(opensAt.toISOString(), new Date(0).toISOString());
    assert.equal(
      closesAt.toISOString(),
      new Date(Date.parse(event.endAt) + MEETING_LATE_MINUTES * 60_000).toISOString(),
    );
  });
});

describe("isWithinMeetingWindow", () => {
  it("returns true inside the access window", () => {
    const event = videoEvent();
    assert.equal(
      isWithinMeetingWindow(event, new Date("2026-06-25T08:10:00.000Z")),
      true,
    );
  });

  it("returns true well before the scheduled start", () => {
    const event = videoEvent();
    assert.equal(
      isWithinMeetingWindow(event, new Date("2026-06-25T07:30:00.000Z")),
      true,
    );
  });

  it("returns false after the window closes", () => {
    const event = videoEvent();
    assert.equal(
      isWithinMeetingWindow(event, new Date("2026-06-25T09:00:00.000Z")),
      false,
    );
  });
});

describe("getMeetingAccessPhase", () => {
  it("reports open before start and closed after the late window", () => {
    const event = videoEvent();
    assert.equal(
      getMeetingAccessPhase(event, new Date("2026-06-25T07:30:00.000Z")),
      "open",
    );
    assert.equal(
      getMeetingAccessPhase(event, new Date("2026-06-25T08:10:00.000Z")),
      "open",
    );
    assert.equal(
      getMeetingAccessPhase(event, new Date("2026-06-25T09:00:00.000Z")),
      "closed",
    );
  });
});

describe("assertCanJoinMeeting", () => {
  it("allows owner of personal video meeting in window", () => {
    assert.doesNotThrow(() =>
      assertCanJoinMeeting(
        managerA,
        videoEvent(),
        new Date("2026-06-25T08:10:00.000Z"),
      ),
    );
  });

  it("allows any team member for company video meeting", () => {
    assert.doesNotThrow(() =>
      assertCanJoinMeeting(
        managerB,
        videoEvent({
          scope: "company",
          ownerUserId: null,
          createdByUserId: managerA.id,
        }),
        new Date("2026-06-25T08:10:00.000Z"),
      ),
    );
  });

  it("rejects another user's personal event", () => {
    assert.throws(
      () =>
        assertCanJoinMeeting(
          managerB,
          videoEvent(),
          new Date("2026-06-25T08:10:00.000Z"),
        ),
      (error: unknown) => {
        assert.ok(error instanceof MeetingAccessError);
        assert.equal(error.code, "forbidden");
        return true;
      },
    );
  });

  it("rejects general events", () => {
    assert.throws(
      () =>
        assertCanJoinMeeting(
          managerA,
          videoEvent({ eventType: "general" }),
          new Date("2026-06-25T08:10:00.000Z"),
        ),
      (error: unknown) => {
        assert.ok(error instanceof MeetingAccessError);
        assert.equal(error.code, "not_video_meeting");
        return true;
      },
    );
  });

  it("rejects joins outside the meeting window", () => {
    assert.throws(
      () =>
        assertCanJoinMeeting(
          managerA,
          videoEvent(),
          new Date("2026-06-25T09:00:00.000Z"),
        ),
      (error: unknown) => {
        assert.ok(error instanceof MeetingAccessError);
        assert.equal(error.code, "outside_window");
        return true;
      },
    );
  });
});

describe("assertCanRecordMeetingAudit", () => {
  it("requires meeting window for joined", () => {
    assert.throws(
      () =>
        assertCanRecordMeetingAudit(
          managerA,
          videoEvent(),
          "joined",
          new Date("2026-06-25T09:00:00.000Z"),
        ),
      (error: unknown) => {
        assert.ok(error instanceof MeetingAccessError);
        assert.equal(error.code, "outside_window");
        return true;
      },
    );
  });

  it("allows left after meeting window closes", () => {
    assert.doesNotThrow(() =>
      assertCanRecordMeetingAudit(
        managerA,
        videoEvent(),
        "left",
        new Date("2026-06-25T09:00:00.000Z"),
      ),
    );
  });
});
