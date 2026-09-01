import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { formatTaskDate } from "@/lib/tasks/format.ts";
import { translateMessage } from "@/i18n/messages.ts";

function read(rel: string) {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("Task date locale formatting", () => {
  it("formats due dates as DD.MM.YYYY in Russian", () => {
    assert.equal(formatTaskDate("2026-09-01", "ru"), "01.09.2026");
  });

  it("formats due dates as MM/DD/YYYY in English", () => {
    assert.equal(formatTaskDate("2026-09-01", "en"), "09/01/2026");
  });

  it("TaskForm uses locale-aware QuestionnaireDateField", () => {
    const form = read("src/components/tasks/TaskForm.tsx");
    assert.match(form, /QuestionnaireDateField/);
    assert.match(form, /form\.datePlaceholder/);
    assert.doesNotMatch(form, /CalendarDateSelect/);
  });

  it("EN/RU date placeholders exist", () => {
    assert.match(
      translateMessage("ru", "tasks.form.datePlaceholder"),
      /ДД\.ММ\.ГГГГ/,
    );
    assert.match(
      translateMessage("en", "tasks.form.datePlaceholder"),
      /MM\/DD\/YYYY/,
    );
  });
});
