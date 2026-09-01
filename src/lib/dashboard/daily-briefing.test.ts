import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getActivityDayKey } from "@/lib/presence/daily-activity-logic.ts";
import { translateMessage } from "@/i18n/messages.ts";

function read(rel: string) {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("Command Center daily briefing (Phase 1)", () => {
  it("dashboard page loads real briefing + health", () => {
    const page = read("src/app/(app)/dashboard/page.tsx");
    assert.match(page, /getCommandCenterDailyBriefing/);
    assert.match(page, /getCompanyHealthMetrics/);
    assert.match(page, /briefing={briefing}/);
  });

  it("FirstImpressionView renders briefing lines, not static seed cards", () => {
    const view = read("src/components/dashboard/FirstImpressionView.tsx");
    assert.match(view, /briefing\.summary\.map/);
    assert.match(view, /briefing\.priorities\.map/);
    assert.match(view, /briefing\.activity\.map/);
    assert.doesNotMatch(view, /PRIORITY_CARDS|AI_INSIGHTS|TEAM_ACTIVITY/);
    assert.match(view, /daily\.heroLead/);
    assert.match(view, /daily\.insightsTitle/);
  });

  it("aggregator pulls from real stores, not demo seed constants", () => {
    const mod = read("src/lib/dashboard/daily-briefing.ts");
    assert.match(mod, /listTasksForUser/);
    assert.match(mod, /listClientInvitations/);
    assert.match(mod, /listIntakeCases/);
    assert.match(mod, /collectPlatformActivityEvents/);
    assert.doesNotMatch(mod, /first-impression-seed|buildDemoOverviewAnalytics/);
  });

  it("EN/RU daily briefing i18n keys exist", () => {
    assert.match(
      translateMessage("en", "commandCenter.daily.summary.eventsToday"),
      /meeting/i,
    );
    assert.match(
      translateMessage("ru", "commandCenter.daily.summary.eventsToday"),
      /встреч/i,
    );
    assert.match(
      translateMessage("en", "commandCenter.daily.activity.taskCompleted"),
      /completed/i,
    );
    assert.match(
      translateMessage("ru", "commandCenter.daily.activity.taskCompleted"),
      /завершил/i,
    );
  });

  it("uses Moscow day key for today window", () => {
    const dayKey = getActivityDayKey(new Date("2026-09-01T10:00:00+03:00"));
    assert.match(dayKey, /^\d{4}-\d{2}-\d{2}$/);
  });
});
