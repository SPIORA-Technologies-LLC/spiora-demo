import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDemoEventTitle,
  isDemoEventTitle,
  resolveCalendarEventTitle,
} from "./demo-event-title.ts";

describe("demo event titles", () => {
  it("resolves EN demo titles", () => {
    const stored = buildDemoEventTitle("teamMeeting");
    assert.equal(isDemoEventTitle(stored), true);
    assert.equal(resolveCalendarEventTitle(stored, "en"), "Team Meeting");
  });

  it("resolves RU demo titles", () => {
    const stored = buildDemoEventTitle("clientConsultation");
    assert.equal(resolveCalendarEventTitle(stored, "ru"), "Консультация с клиентом");
  });

  it("passes through non-demo titles", () => {
    assert.equal(resolveCalendarEventTitle("Custom Event", "en"), "Custom Event");
  });
});
