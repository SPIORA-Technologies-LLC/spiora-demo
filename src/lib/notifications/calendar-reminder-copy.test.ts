import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CalendarEvent } from "@/lib/calendar/types";
import {
  buildCalendarReminderNotificationContent,
  buildCalendarEventCreatedNotificationContent,
  buildVideoMeetingInviteNotificationContent,
  decodeCalendarReminderMessage,
  encodeCalendarReminderMessage,
  formatCalendarReminderDisplayMessage,
  getCalendarReminderTitle,
} from "./calendar-reminder-copy";

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "evt-42",
    companyId: "northstar-mobility",
    scope: "personal",
    ownerUserId: "olivia-bennett",
    title: "Созвон с клиентом",
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
    createdByUserId: "olivia-bennett",
    createdByName: "Вероника",
    updatedByUserId: null,
    createdAt: "2026-06-20T10:00:00.000Z",
    updatedAt: "2026-06-20T10:00:00.000Z",
    ...overrides,
  };
}

describe("calendar reminder notification copy", () => {
  it("builds titles for fixed offsets in ru", () => {
    assert.equal(getCalendarReminderTitle(1440, "ru"), "За 24 часа");
    assert.equal(getCalendarReminderTitle(60, "ru"), "За 1 час");
    assert.equal(getCalendarReminderTitle(10, "ru"), "За 10 минут");
  });

  it("builds titles for fixed offsets in en", () => {
    assert.equal(getCalendarReminderTitle(1440, "en"), "24 hours before");
    assert.equal(getCalendarReminderTitle(60, "en"), "1 hour before");
    assert.equal(getCalendarReminderTitle(10, "en"), "10 minutes before");
  });

  it("formats timed and all-day messages", () => {
    const timed = formatCalendarReminderDisplayMessage(event(), "ru");
    assert.match(timed, /^\d{2}:\d{2} – \d{2}:\d{2} — Созвон с клиентом$/);

    const allDay = formatCalendarReminderDisplayMessage(
      event({ allDay: true, title: "Выходной" }),
      "ru",
    );
    assert.equal(allDay, "Весь день — Выходной");
  });

  it("encodes event id for navigation without changing display text", () => {
    const { title, message } = buildCalendarReminderNotificationContent(
      event(),
      60,
      "ru",
    );

    assert.equal(title, "За 1 час");
    const decoded = decodeCalendarReminderMessage(message);
    assert.equal(decoded.eventId, "evt-42");
    assert.equal(decoded.isVideoMeeting, false);
    assert.match(decoded.display, /Созвон с клиентом$/);
  });

  it("encodes video meeting flag for video events", () => {
    const { message } = buildCalendarReminderNotificationContent(
      event({ eventType: "video_meeting", title: "Синк команды" }),
      60,
      "ru",
    );

    const decoded = decodeCalendarReminderMessage(message);
    assert.equal(decoded.eventId, "evt-42");
    assert.equal(decoded.isVideoMeeting, true);
    assert.match(decoded.display, /Синк команды$/);
  });

  it("decodes legacy two-part messages without video flag", () => {
    const legacy = "10:00 – 11:00 — Старый формат\u2063evt-old";
    const decoded = decodeCalendarReminderMessage(legacy);
    assert.equal(decoded.eventId, "evt-old");
    assert.equal(decoded.isVideoMeeting, false);
    assert.equal(decoded.display, "10:00 – 11:00 — Старый формат");
  });

  it("round-trips explicit video flag encoding", () => {
    const message = encodeCalendarReminderMessage(
      "10:00 – 11:00 — Синк",
      "evt-video",
      { isVideoMeeting: true },
    );
    const decoded = decodeCalendarReminderMessage(message);
    assert.equal(decoded.eventId, "evt-video");
    assert.equal(decoded.isVideoMeeting, true);
  });

  it("builds instant video meeting invite copy", () => {
    const { title, message } = buildVideoMeetingInviteNotificationContent(
      event({ eventType: "video_meeting", title: "Синк команды" }),
      "ru",
    );

    assert.equal(title, "Приглашение на видеовстречу");
    const decoded = decodeCalendarReminderMessage(message);
    assert.equal(decoded.eventId, "evt-42");
    assert.equal(decoded.isVideoMeeting, true);
    assert.match(decoded.display, /Синк команды$/);
  });

  it("builds event-created copy for general meetings", () => {
    const { title } = buildCalendarEventCreatedNotificationContent(event(), "en");
    assert.equal(title, "Event created");
  });
});
