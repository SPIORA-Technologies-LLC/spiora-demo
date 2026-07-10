import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDemoCalendarEvents } from "./demo-events.ts";

describe("demo calendar events", () => {
  it("создаёт не менее 25 demo-событий", () => {
    const events = buildDemoCalendarEvents(new Date("2026-07-06T12:00:00.000Z"));
    assert.ok(events.length >= 25);
  });

  it("включает personal и company события", () => {
    const events = buildDemoCalendarEvents(new Date("2026-07-06T12:00:00.000Z"));
    assert.ok(events.some((event) => event.scope === "personal"));
    assert.ok(events.some((event) => event.scope === "company"));
  });

  it("включает general и video_meeting", () => {
    const events = buildDemoCalendarEvents(new Date("2026-07-06T12:00:00.000Z"));
    assert.ok(events.some((event) => event.eventType === "general"));
    assert.ok(events.some((event) => event.eventType === "video_meeting"));
  });

  it("включает all-day событие", () => {
    const events = buildDemoCalendarEvents(new Date("2026-07-06T12:00:00.000Z"));
    assert.ok(events.some((event) => event.allDay));
  });

  it("stores demo titles as dictionary keys", () => {
    const events = buildDemoCalendarEvents(new Date("2026-07-06T12:00:00.000Z"));
    assert.ok(events.every((event) => event.title.startsWith("demo:")));
  });
});
