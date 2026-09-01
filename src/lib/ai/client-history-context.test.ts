import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractClientNameFromHistory,
  hasPronounClientReference,
  resolveContextualClientQuery,
} from "@/lib/ai/client-history-context";
import { extractMeaningfulPersonNameTokens } from "@/lib/ai/name-matching";

describe("client-history-context", () => {
  const history = [
    { role: "user" as const, content: "Майя Петрова" },
    {
      role: "assistant" as const,
      content:
        "Заявка **Майя Петрова** есть в анкете (/clients/intake), статус: application_received.",
    },
  ];

  it("detects pronoun reference", () => {
    assert.equal(hasPronounClientReference("Какой у нее номер паспорта"), true);
  });

  it("extracts client name from recent history", () => {
    assert.equal(extractClientNameFromHistory(history), "майя петрова");
  });

  it("resolves pronoun follow-up to named client query", () => {
    const resolved = resolveContextualClientQuery(
      "Какой у нее номер паспорта",
      history,
    );
    assert.match(resolved, /майя/i);
    assert.match(resolved, /петрова/i);
    assert.match(resolved, /паспорт/i);
  });

  it("does not treat passport word as client name", () => {
    assert.deepEqual(
      extractMeaningfulPersonNameTokens("Какой у нее номер паспорта"),
      [],
    );
  });
});
