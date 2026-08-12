import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDemoEventTitle,
  isDemoEventTitle,
  resolveCalendarEventTitle,
  translateRussianEventTitle,
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

  it("passes through non-demo Latin titles", () => {
    assert.equal(resolveCalendarEventTitle("Custom Event", "en"), "Custom Event");
  });

  it("keeps Cyrillic titles in RU locale", () => {
    assert.equal(
      resolveCalendarEventTitle("Тестирование", "ru"),
      "Тестирование",
    );
  });

  it("shows English for Cyrillic titles in EN locale", () => {
    assert.equal(resolveCalendarEventTitle("Тестирование...", "en"), "Testing...");
    assert.equal(
      resolveCalendarEventTitle("Тестируем вид...", "en"),
      "Testing the view...",
    );
  });
});

describe("translateRussianEventTitle", () => {
  it("maps common event phrases", () => {
    assert.equal(translateRussianEventTitle("Встреча"), "Meeting");
    assert.equal(translateRussianEventTitle("Видеозвонок"), "Video call");
  });

  it("latinizes unknown Cyrillic tokens", () => {
    const result = translateRussianEventTitle("Абракадабра");
    assert.match(result, /^[A-Za-z]+$/);
    assert.doesNotMatch(result, /[А-Яа-яЁё]/);
  });
});
