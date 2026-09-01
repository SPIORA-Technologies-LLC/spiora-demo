import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { translateMessage } from "@/i18n/messages.ts";

function read(rel: string) {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("Command Center contracts and finance panels", () => {
  it("briefing loads pending signatures and finance snapshot", () => {
    const mod = read("src/lib/dashboard/daily-briefing.ts");
    assert.match(mod, /listPendingContractSignatures/);
    assert.match(mod, /getCommandCenterFinanceSnapshot/);
    assert.match(mod, /pendingSignatures/);
    assert.match(mod, /finance: financeSnapshot/);
  });

  it("FirstImpressionView renders contracts and finance sections", () => {
    const view = read("src/components/dashboard/FirstImpressionView.tsx");
    assert.match(view, /contracts\.title/);
    assert.match(view, /finance\.title/);
    assert.match(view, /pendingSignatures\.map/);
  });

  it("team roster merges built-in finance manager when missing from Supabase profiles", () => {
    const mod = read("src/lib/team/store.ts");
    assert.match(mod, /builtInExtras/);
    assert.match(mod, /listTeamUsers\(\)/);
  });

  it("RU LLM prompt uses localized metric labels", () => {
    const llm = read("src/lib/dashboard/daily-briefing-llm.ts");
    assert.match(llm, /formatLlmMetrics/);
    assert.match(llm, /Заявок на рассмотрении/);
    assert.doesNotMatch(llm, /JSON\.stringify\(input\.metrics/);
  });

  it("EN/RU i18n keys exist for new panels", () => {
    assert.match(
      translateMessage("ru", "commandCenter.contracts.title"),
      /подпис/i,
    );
    assert.match(
      translateMessage("ru", "commandCenter.finance.debtorsTitle"),
      /остат/i,
    );
    assert.match(
      translateMessage("ru", "commandCenter.daily.priorities.portal"),
      /заявок на рассмотрении/,
    );
    assert.doesNotMatch(
      translateMessage("ru", "commandCenter.daily.priorities.portal"),
      /\bintake\b/i,
    );
  });
});
