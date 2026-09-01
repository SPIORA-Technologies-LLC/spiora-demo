import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  encodeActivityFeedCursor,
  paginatePlatformActivity,
  parseActivityFeedCursor,
  type PlatformActivityEvent,
} from "@/lib/dashboard/platform-activity-feed.ts";
import { translateMessage } from "@/i18n/messages.ts";

function read(rel: string) {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

function sampleEvents(): PlatformActivityEvent[] {
  return [
    {
      id: "b",
      type: "chat_message",
      at: "2026-09-01T12:00:00.000Z",
      actor: "Anna",
      key: "daily.activity.chatMessage",
      values: { name: "Anna" },
      href: "/team-chat",
    },
    {
      id: "a",
      type: "task_completed",
      at: "2026-09-01T12:00:00.000Z",
      actor: "Ben",
      key: "daily.activity.taskCompleted",
      values: { name: "Ben", title: "Review" },
      href: "/tasks",
    },
    {
      id: "c",
      type: "client_created",
      at: "2026-09-01T10:00:00.000Z",
      actor: null,
      key: "daily.activity.clientCreated",
      values: { name: "Client" },
      href: "/clients/1",
    },
  ];
}

describe("Command Center platform activity feed (Phase 3)", () => {
  it("GET /api/command-center/activity route validates date and cursor", () => {
    const route = read("src/app/api/command-center/activity/route.ts");
    assert.match(route, /export async function GET/);
    assert.match(route, /listPlatformActivityForDay/);
    assert.match(route, /parseActivityFeedCursor/);
    assert.match(route, /status: 400/);
  });

  it("aggregator unions sources in platform-activity-feed module", () => {
    const mod = read("src/lib/dashboard/platform-activity-feed.ts");
    assert.match(mod, /collectPlatformActivityEvents/);
    assert.match(mod, /task_completed/);
    assert.match(mod, /document_uploaded/);
    assert.match(mod, /calendar_event/);
    assert.match(mod, /listDocumentsUploadedOnDay/);
    assert.doesNotMatch(mod, /first-impression-seed/);
  });

  it("daily briefing uses unified feed collector", () => {
    const mod = read("src/lib/dashboard/daily-briefing.ts");
    assert.match(mod, /collectPlatformActivityEvents/);
    assert.doesNotMatch(mod, /buildActivityFeed|collectChatActivity/);
  });

  it("paginatePlatformActivity sorts desc and pages with cursor", () => {
    const first = paginatePlatformActivity(sampleEvents(), { limit: 2 });
    assert.equal(first.items.length, 2);
    assert.equal(first.total, 3);
    assert.ok(first.nextCursor);

    const second = paginatePlatformActivity(sampleEvents(), {
      limit: 2,
      cursor: first.nextCursor,
    });
    assert.equal(second.items.length, 1);
    assert.equal(second.items[0]?.id, "c");
    assert.equal(second.nextCursor, null);
  });

  it("activity feed cursor round-trips", () => {
    const encoded = encodeActivityFeedCursor("2026-09-01T10:00:00.000Z", "event-1");
    assert.deepEqual(parseActivityFeedCursor(encoded), {
      at: "2026-09-01T10:00:00.000Z",
      id: "event-1",
    });
    assert.equal(parseActivityFeedCursor("not-valid"), null);
  });

  it("EN/RU i18n keys exist for new activity types", () => {
    assert.match(
      translateMessage("en", "commandCenter.daily.activity.taskCreated"),
      /created/i,
    );
    assert.match(
      translateMessage("ru", "commandCenter.daily.activity.documentUploaded"),
      /загрузил/i,
    );
    assert.match(
      translateMessage("en", "commandCenter.daily.activity.calendarEvent"),
      /scheduled/i,
    );
  });
});
