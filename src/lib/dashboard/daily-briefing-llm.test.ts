import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  parseLlmSummaryBlocks,
  splitLlmSummaryParagraphs,
} from "@/lib/dashboard/daily-briefing-llm-format.ts";
import { translateMessage } from "@/i18n/messages.ts";

function read(rel: string) {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("Command Center LLM daily summary (Phase 4)", () => {
  it("llm module sends metrics-only payload to createChatCompletion", () => {
    const mod = read("src/lib/dashboard/daily-briefing.ts");
    assert.match(mod, /buildLlmDailySummary/);
    assert.match(mod, /llmSummary/);
    assert.match(mod, /llmSummarySource/);

    const llm = read("src/lib/dashboard/daily-briefing-llm.ts");
    assert.match(llm, /createChatCompletion/);
    assert.match(llm, /formatLlmMetrics/);
    assert.match(llm, /metrics: DailyBriefingMetrics/);
    assert.doesNotMatch(llm, /collectPlatformActivityEvents|BriefingActivityItem/);
  });

  it("daily API passes locale and supports llm=0 opt-out", () => {
    const route = read("src/app/api/command-center/daily/route.ts");
    assert.match(route, /getRequestLocale/);
    assert.match(route, /includeLlm/);
    assert.match(route, /llm.*!== "0"/);
  });

  it("FirstImpressionView prefers llmSummary over template lines", () => {
    const view = read("src/components/dashboard/FirstImpressionView.tsx");
    assert.match(view, /parseLlmSummaryBlocks/);
    assert.match(view, /summarySubheading/);
    assert.match(view, /daily\.llmSummaryNote/);
  });

  it("parseLlmSummaryBlocks turns markdown titles into subheadings", () => {
    const blocks = parseLlmSummaryBlocks(
      "**Сводка на 1 сентября**\n\nСегодня спокойный день.\n\n**Текущая очередь:**\n\n11 заявок на рассмотрении.",
    );
    assert.equal(blocks[0]?.kind, "subheading");
    assert.equal(blocks[0]?.kind === "subheading" ? blocks[0].text : "", "Сводка на 1 сентября");
    assert.equal(blocks[1]?.kind, "paragraph");
    assert.equal(blocks[2]?.kind, "subheading");
    assert.equal(
      blocks[2]?.kind === "subheading" ? blocks[2].text : "",
      "Текущая очередь",
    );
  });

  it("splitLlmSummaryParagraphs splits on blank lines", () => {
    assert.deepEqual(
      splitLlmSummaryParagraphs("First paragraph.\n\nSecond paragraph."),
      ["First paragraph.", "Second paragraph."],
    );
  });

  it("EN/RU llm summary note exists", () => {
    assert.match(
      translateMessage("en", "commandCenter.daily.llmSummaryNote"),
      /metrics only/i,
    );
    assert.match(
      translateMessage("ru", "commandCenter.daily.llmSummaryNote"),
      /агрегат/i,
    );
  });
});
