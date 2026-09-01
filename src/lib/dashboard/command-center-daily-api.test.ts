import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  parseCommandCenterDayKey,
  resolveCommandCenterDayKey,
} from "@/lib/dashboard/daily-briefing.ts";
import { isTaskOverdueOnDay } from "@/lib/tasks/overdue.ts";
import type { Task } from "@/lib/tasks/types.ts";

function read(rel: string) {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("Command Center daily API (Phase 2)", () => {
  it("GET route exists and validates date query", () => {
    const route = read("src/app/api/command-center/daily/route.ts");
    assert.match(route, /export async function GET/);
    assert.match(route, /searchParams\.get\("date"\)/);
    assert.match(route, /parseCommandCenterDayKey/);
    assert.match(route, /getCommandCenterDailyBriefing/);
    assert.match(route, /status: 401/);
    assert.match(route, /status: 400/);
  });

  it("parseCommandCenterDayKey accepts Moscow YYYY-MM-DD only", () => {
    assert.equal(parseCommandCenterDayKey("2026-09-01"), "2026-09-01");
    assert.equal(parseCommandCenterDayKey("2026-09-01"), "2026-09-01");
    assert.equal(parseCommandCenterDayKey(" 2026-09-01 "), "2026-09-01");
    assert.equal(parseCommandCenterDayKey(""), null);
    assert.equal(parseCommandCenterDayKey(null), null);
    assert.equal(parseCommandCenterDayKey("01-09-2026"), null);
    assert.equal(parseCommandCenterDayKey("2026-13-01"), null);
    assert.equal(parseCommandCenterDayKey("not-a-date"), null);
  });

  it("resolveCommandCenterDayKey clamps future dates to today", () => {
    const now = new Date("2026-09-01T10:00:00+03:00");
    assert.equal(
      resolveCommandCenterDayKey("2026-12-31", now),
      "2026-09-01",
    );
    assert.equal(
      resolveCommandCenterDayKey(null, now),
      "2026-09-01",
    );
  });

  it("isTaskOverdueOnDay reflects backlog at end of that day", () => {
    const base: Task = {
      id: "t1",
      title: "Test",
      description: "",
      status: "in_progress",
      priority: "medium",
      createdAt: "2026-08-20T10:00:00+03:00",
      updatedAt: "2026-08-20T10:00:00+03:00",
      createdByUserId: "u1",
      createdByName: "User",
      assignees: [],
      reviewHistory: [],
      attachments: [],
      progressReports: [],
      dueDate: "2026-08-25",
      completedAt: null,
    };

    assert.equal(isTaskOverdueOnDay(base, "2026-08-26"), true);
    assert.equal(isTaskOverdueOnDay(base, "2026-08-24"), false);
    assert.equal(
      isTaskOverdueOnDay(
        {
          ...base,
          completedAt: "2026-08-26T18:00:00+03:00",
          status: "completed",
        },
        "2026-08-26",
      ),
      false,
    );
    assert.equal(
      isTaskOverdueOnDay(
        {
          ...base,
          completedAt: "2026-08-27T10:00:00+03:00",
          status: "completed",
        },
        "2026-08-26",
      ),
      true,
    );
    assert.equal(
      isTaskOverdueOnDay(
        {
          ...base,
          completedAt: "2026-08-25T10:00:00+03:00",
          status: "completed",
        },
        "2026-08-26",
      ),
      false,
    );
  });

  it("daily briefing aggregator accepts dayKey option", () => {
    const mod = read("src/lib/dashboard/daily-briefing.ts");
    assert.match(mod, /CommandCenterDailyBriefingOptions/);
    assert.match(mod, /clampActivityAnchor\(options\?\.dayKey/);
    assert.match(mod, /countAiUserMessagesForDashboardDay/);
    assert.match(mod, /isTaskOverdueOnDay/);
  });
});
