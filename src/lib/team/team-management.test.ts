import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SessionUser } from "@/lib/auth/types.ts";
import {
  canDeleteTeamMember,
  canManageTeam,
  canViewTeamMemberActivity,
} from "@/lib/team/permissions.ts";
import {
  applyHeartbeatToDailyActivity,
  buildActivityCalendarCells,
  buildMemberActivityStats,
  getActivityDayKey,
  normalizeDailyActivityStore,
  pruneActivityDays,
  toTeamMemberDailyActivity,
} from "@/lib/presence/daily-activity-logic.ts";

const owner: SessionUser = {
  id: "olivia-bennett",
  email: "olivia@spiora.demo",
  name: "Olivia Bennett",
  role: "owner",
};

const manager: SessionUser = {
  id: "emma-wilson",
  email: "emma@spiora.demo",
  name: "Emma Wilson",
  role: "manager",
};

describe("team owner management permissions", () => {
  it("only owner can manage team", () => {
    assert.equal(canManageTeam(owner), true);
    assert.equal(canManageTeam(manager), false);
  });

  it("maps demo owner email to roster id used by Team presence reads", async () => {
    const { findUserByEmail } = await import("@/lib/auth/users.ts");
    assert.equal(findUserByEmail("olivia@spiora.demo")?.id, "olivia-bennett");
  });

  it("owner can delete managers but not self or other owners", () => {
    assert.equal(
      canDeleteTeamMember(owner, { id: "emma-wilson", role: "manager" }),
      true,
    );
    assert.equal(
      canDeleteTeamMember(owner, { id: "olivia-bennett", role: "owner" }),
      false,
    );
  });

  it("manager cannot delete anyone", () => {
    assert.equal(
      canDeleteTeamMember(manager, { id: "daniel-cooper", role: "manager" }),
      false,
    );
    assert.equal(
      canDeleteTeamMember(manager, { id: "olivia-bennett", role: "owner" }),
      false,
    );
  });

  it("only owner can open activity stats for non-owner teammates", () => {
    assert.equal(
      canViewTeamMemberActivity(owner, {
        id: "emma-wilson",
        role: "manager",
      }),
      true,
    );
    assert.equal(
      canViewTeamMemberActivity(owner, {
        id: "sofia-reyes",
        role: "finance_manager",
      }),
      true,
    );
    assert.equal(
      canViewTeamMemberActivity(owner, {
        id: "olivia-bennett",
        role: "owner",
      }),
      false,
    );
    assert.equal(
      canViewTeamMemberActivity(manager, {
        id: "daniel-cooper",
        role: "manager",
      }),
      false,
    );
  });
});

describe("daily presence activity", () => {
  it("starts a new day record on first heartbeat", () => {
    const now = "2026-07-25T10:00:00.000Z";
    const record = applyHeartbeatToDailyActivity(null, now, {
      dayKey: "2026-07-25",
      onlineThresholdMs: 90_000,
    });
    assert.equal(record.date, "2026-07-25");
    assert.equal(record.firstActiveAt, now);
    assert.equal(record.lastActiveAt, now);
    assert.equal(record.onlineMs, 0);
  });

  it("accumulates online time within threshold", () => {
    const first = applyHeartbeatToDailyActivity(null, "2026-07-25T10:00:00.000Z", {
      dayKey: "2026-07-25",
      onlineThresholdMs: 90_000,
    });
    const second = applyHeartbeatToDailyActivity(
      first,
      "2026-07-25T10:00:45.000Z",
      { dayKey: "2026-07-25", onlineThresholdMs: 90_000 },
    );
    assert.equal(second.onlineMs, 45_000);
    assert.equal(second.firstActiveAt, first.firstActiveAt);
  });

  it("does not count offline gaps above threshold", () => {
    const first = applyHeartbeatToDailyActivity(null, "2026-07-25T10:00:00.000Z", {
      dayKey: "2026-07-25",
      onlineThresholdMs: 90_000,
    });
    const second = applyHeartbeatToDailyActivity(
      first,
      "2026-07-25T10:05:00.000Z",
      { dayKey: "2026-07-25", onlineThresholdMs: 90_000 },
    );
    assert.equal(second.onlineMs, 0);
    assert.equal(second.lastActiveAt, "2026-07-25T10:05:00.000Z");
  });

  it("resets when the day key changes", () => {
    const yesterday = applyHeartbeatToDailyActivity(
      null,
      "2026-07-24T20:00:00.000Z",
      { dayKey: "2026-07-24", onlineThresholdMs: 90_000 },
    );
    const today = applyHeartbeatToDailyActivity(
      yesterday,
      "2026-07-25T08:00:00.000Z",
      { dayKey: "2026-07-25", onlineThresholdMs: 90_000 },
    );
    assert.equal(today.date, "2026-07-25");
    assert.equal(today.onlineMs, 0);
    assert.equal(today.firstActiveAt, "2026-07-25T08:00:00.000Z");
  });

  it("maps missing day activity to empty state", () => {
    const mapped = toTeamMemberDailyActivity(
      {
        date: "2026-07-24",
        firstActiveAt: "2026-07-24T10:00:00.000Z",
        lastActiveAt: "2026-07-24T11:00:00.000Z",
        onlineMs: 3_600_000,
      },
      "2026-07-25",
    );
    assert.equal(mapped.hasActivity, false);
    assert.equal(mapped.startedAt, null);
  });

  it("returns a stable Moscow day key", () => {
    assert.match(getActivityDayKey(new Date("2026-07-25T12:00:00.000Z")), /^\d{4}-\d{2}-\d{2}$/);
  });

  it("aggregates calendar week and month online hours from day history", () => {
    const now = new Date("2026-07-30T12:00:00+03:00");
    const byDate = {
      "2026-07-30": {
        date: "2026-07-30",
        firstActiveAt: "2026-07-30T09:00:00.000Z",
        lastActiveAt: "2026-07-30T10:00:00.000Z",
        onlineMs: 3_600_000,
      },
      "2026-07-29": {
        date: "2026-07-29",
        firstActiveAt: "2026-07-29T09:00:00.000Z",
        lastActiveAt: "2026-07-29T11:00:00.000Z",
        onlineMs: 7_200_000,
      },
      "2026-07-01": {
        date: "2026-07-01",
        firstActiveAt: "2026-07-01T09:00:00.000Z",
        lastActiveAt: "2026-07-01T10:00:00.000Z",
        onlineMs: 1_800_000,
      },
      "2026-01-15": {
        date: "2026-01-15",
        firstActiveAt: "2026-01-15T09:00:00.000Z",
        lastActiveAt: "2026-01-15T10:00:00.000Z",
        onlineMs: 900_000,
      },
    };

    const day = buildMemberActivityStats(byDate, "day", now);
    assert.equal(day.days.length, 1);
    assert.equal(day.days[0]?.date, "2026-07-30");
    assert.equal(day.onlineMs, 3_600_000);
    assert.equal(day.anchor, "2026-07-30");

    const week = buildMemberActivityStats(byDate, "week", now);
    assert.equal(week.days.length, 7);
    assert.equal(week.days[0]?.date, "2026-07-27");
    assert.equal(week.days[6]?.date, "2026-08-02");
    assert.equal(week.onlineMs, 10_800_000);

    const month = buildMemberActivityStats(byDate, "month", now);
    assert.equal(month.days.length, 31);
    assert.equal(month.days[0]?.date, "2026-07-01");
    assert.equal(month.days[30]?.date, "2026-07-31");
    assert.equal(month.onlineMs, 12_600_000);

    const year = buildMemberActivityStats(byDate, "year", now);
    assert.equal(year.months.length, 12);
    assert.equal(year.months[0]?.onlineMs, 900_000);
    assert.equal(year.months[6]?.onlineMs, 12_600_000);
    assert.equal(year.onlineMs, 13_500_000);

    const monthCells = buildActivityCalendarCells(month.days, "month");
    assert.equal(monthCells[0], null);
    assert.equal(monthCells[1], null);
    assert.equal(monthCells[2]?.date, "2026-07-01");
    assert.equal(monthCells.length % 7, 0);
  });

  it("prunes activity older than one year retention window", () => {
    const now = new Date("2026-07-30T12:00:00+03:00");
    const pruned = pruneActivityDays(
      {
        "2026-07-30": {
          date: "2026-07-30",
          firstActiveAt: "2026-07-30T09:00:00.000Z",
          lastActiveAt: "2026-07-30T10:00:00.000Z",
          onlineMs: 1_000,
        },
        "2025-07-31": {
          date: "2025-07-31",
          firstActiveAt: "2025-07-31T09:00:00.000Z",
          lastActiveAt: "2025-07-31T10:00:00.000Z",
          onlineMs: 2_000,
        },
        "2025-07-30": {
          date: "2025-07-30",
          firstActiveAt: "2025-07-30T09:00:00.000Z",
          lastActiveAt: "2025-07-30T10:00:00.000Z",
          onlineMs: 3_000,
        },
      },
      365,
      now,
    );
    assert.ok(pruned["2026-07-30"]);
    assert.ok(pruned["2025-07-31"]);
    assert.equal(pruned["2025-07-30"], undefined);
  });
});

describe("daily activity store migration", () => {
  it("normalizes legacy flat per-user records into day maps", () => {
    const store = normalizeDailyActivityStore({
      byUser: {
        "emma-wilson": {
          date: "2026-07-29",
          firstActiveAt: "2026-07-29T09:00:00.000Z",
          lastActiveAt: "2026-07-29T10:00:00.000Z",
          onlineMs: 3_600_000,
        },
      },
    });
    assert.equal(store.byUser["emma-wilson"]?.["2026-07-29"]?.onlineMs, 3_600_000);
  });
});
