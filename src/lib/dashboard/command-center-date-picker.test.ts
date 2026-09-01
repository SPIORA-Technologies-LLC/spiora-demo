import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { translateMessage } from "@/i18n/messages.ts";

function read(rel: string) {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("Command Center dashboard date picker", () => {
  it("dashboard page reads ?date= and passes day bounds", () => {
    const page = read("src/app/(app)/dashboard/page.tsx");
    assert.match(page, /searchParams/);
    assert.match(page, /resolveCommandCenterDayKey/);
    assert.match(page, /CommandCenterDashboard/);
    assert.match(page, /getActivityRetentionCutoff/);
    assert.match(page, /getActivityDayKey/);
  });

  it("client dashboard fetches daily briefing API on day change", () => {
    const dashboard = read("src/components/dashboard/CommandCenterDashboard.tsx");
    assert.match(dashboard, /"use client"/);
    assert.match(dashboard, /\/api\/command-center\/daily\?date=/);
    assert.match(dashboard, /router\.replace/);
  });

  it("date picker exposes prev/next, input, and today action", () => {
    const picker = read("src/components/dashboard/CommandCenterDatePicker.tsx");
    assert.match(picker, /type="date"/);
    assert.match(picker, /shiftActivityDayKey/);
    assert.match(picker, /prevDay/);
    assert.match(picker, /nextDay/);
    assert.match(picker, /today/);
  });

  it("EN/RU date picker copy exists", () => {
    assert.equal(
      translateMessage("en", "commandCenter.daily.datePicker.today"),
      "Today",
    );
    assert.equal(
      translateMessage("ru", "commandCenter.daily.datePicker.today"),
      "Сегодня",
    );
    assert.match(
      translateMessage("en", "commandCenter.daily.heroLeadPast"),
      /Live summary/i,
    );
  });
});
