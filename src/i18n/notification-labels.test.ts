import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatNotificationTime,
  translateNotificationType,
} from "@/i18n/notification-labels.ts";

describe("notification labels", () => {
  it("EN: calendar notification labels without Cyrillic", () => {
    const label = translateNotificationType("en", "calendar_reminder");
    assert.match(label, /^[A-Za-z0-9 ,.-]+$/);
    assert.equal(label, "Calendar reminder");
  });

  it("RU: calendar notification labels in Russian", () => {
    assert.equal(
      translateNotificationType("ru", "calendar_video_invite"),
      "Видеовстреча",
    );
  });

  it("formats notification time per locale", () => {
    const iso = "2026-07-10T09:30:00.000Z";
    const en = formatNotificationTime(iso, "en");
    const ru = formatNotificationTime(iso, "ru");
    assert.match(en, /2026/);
    assert.match(ru, /2026/);
    assert.doesNotMatch(en, /[А-Яа-яЁё]/);
  });
});
