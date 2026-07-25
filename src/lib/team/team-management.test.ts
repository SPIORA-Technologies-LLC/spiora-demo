import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SessionUser } from "@/lib/auth/types.ts";
import {
  canDeleteTeamMember,
  canManageTeam,
} from "@/lib/team/permissions.ts";
import {
  applyHeartbeatToDailyActivity,
  getActivityDayKey,
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
});
