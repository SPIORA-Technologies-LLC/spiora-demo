import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isEmptyKbAiContext,
  rankKbArticlesForAi,
  scoreKbTextForAiQuery,
  tokenizeKbAiQuery,
} from "./kb-ai-retrieve.ts";

describe("kb AI retrieve", () => {
  it("drops question stop-words and keeps topic tokens", () => {
    const tokens = tokenizeKbAiQuery(
      "Что потребуется для Визы цифрового кочевника в Испанию",
    );
    assert.ok(tokens.includes("визы") || tokens.includes("виза"));
    assert.ok(tokens.some((t) => t.startsWith("цифров")));
    assert.ok(tokens.some((t) => t.startsWith("кочевн")));
    assert.ok(tokens.some((t) => t.startsWith("испан")));
    assert.equal(tokens.includes("что"), false);
    assert.equal(tokens.includes("для"), false);
    assert.equal(tokens.includes("потребуется"), false);
  });

  it("ranks Spain digital-nomad article above unrelated material", () => {
    const ranked = rankKbArticlesForAi(
      [
        {
          slug: "croatia-nomad",
          title: "Digital Nomad Croatia",
          categoryLabel: "Programs",
          summary: "Croatia temporary stay",
          content: "Requirements for Croatia digital nomad permit",
        },
        {
          slug: "spain-nomad-client",
          title: "Виза цифрового кочевника в Испанию",
          categoryLabel: "Programs",
          summary: "Список документов для Испании",
          content:
            "Для визы цифрового кочевника в Испанию нужны паспорт, страховка и подтверждение дохода.",
        },
        {
          slug: "privacy",
          title: "Privacy policy",
          categoryLabel: "Policies",
          summary: "GDPR notes",
          content: "How we process personal data",
        },
      ],
      "Что потребуется для Визы цифрового кочевника в Испанию",
      3,
    );
    assert.equal(ranked[0]?.slug, "spain-nomad-client");
    assert.ok(scoreKbTextForAiQuery(ranked[0]!.content, "виза Испанию") > 0);
  });

  it("detects empty AI context placeholders", () => {
    assert.equal(isEmptyKbAiContext(""), true);
    assert.equal(
      isEmptyKbAiContext("База данных (PostgreSQL):\nПодходящие демо-материалы не найдены."),
      true,
    );
    assert.equal(
      isEmptyKbAiContext("--- Spain nomad\nPassport and insurance required"),
      false,
    );
  });
});
