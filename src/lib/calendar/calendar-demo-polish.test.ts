import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { translateMessage } from "@/i18n/messages.ts";

describe("calendar demo polish i18n", () => {
  it("EN: meet guest invite block strings", () => {
    assert.equal(
      translateMessage("en", "calendar.meet.guestInvite.title"),
      "Client invite link",
    );
    assert.equal(
      translateMessage("en", "calendar.meet.guestHistory.title"),
      "Guests via link",
    );
    assert.doesNotMatch(
      translateMessage("en", "calendar.meet.accessGate.waitingTitle"),
      /[А-Яа-яЁё]/,
    );
  });

  it("EN: demo event titles", () => {
    assert.equal(
      translateMessage("en", "calendar.demoEvents.teamMeeting"),
      "Team Meeting",
    );
    assert.doesNotMatch(
      translateMessage("en", "calendar.demoEvents.crmReview"),
      /[А-Яа-яЁё]/,
    );
  });

  it("RU: demo event titles", () => {
    assert.equal(
      translateMessage("ru", "calendar.demoEvents.teamMeeting"),
      "Командное совещание",
    );
    assert.match(
      translateMessage("ru", "calendar.demoEvents.clientConsultation"),
      /[А-Яа-яЁё]/,
    );
  });

  it("Dashboard upcoming events EN", () => {
    assert.equal(
      translateMessage("en", "dashboard.upcomingEvents.title"),
      "Upcoming events",
    );
    assert.equal(
      translateMessage("en", "dashboard.upcomingEvents.viewCalendar"),
      "View calendar",
    );
    assert.equal(
      translateMessage("en", "dashboard.upcomingEvents.videoBadge"),
      "Video meeting",
    );
  });

  it("Dashboard upcoming events RU", () => {
    assert.equal(
      translateMessage("ru", "dashboard.upcomingEvents.title"),
      "Ближайшие события",
    );
    assert.equal(
      translateMessage("ru", "dashboard.upcomingEvents.viewCalendar"),
      "Открыть календарь",
    );
  });

  it("Dashboard upcoming events empty state", () => {
    assert.equal(
      translateMessage("en", "dashboard.upcomingEvents.empty"),
      "No upcoming events",
    );
    assert.equal(
      translateMessage("ru", "dashboard.upcomingEvents.empty"),
      "Нет предстоящих событий",
    );
  });
});
