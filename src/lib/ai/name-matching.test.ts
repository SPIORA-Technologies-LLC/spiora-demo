import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractClientEntityFromQuery } from "@/lib/ai/client-entity-extract";
import {
  extractPersonNameTokens,
  scorePersonName,
} from "@/lib/ai/name-matching";

describe("name-matching — genitive case", () => {
  const query = "У Петровой Майи как обстоят дела с договором?";

  it("extracts only name tokens without trailing verbs", () => {
    assert.deepEqual(extractPersonNameTokens(query), ["петровой", "майи"]);
  });

  it("stops entity phrase before service words", () => {
    const entity = extractClientEntityFromQuery(query);
    assert.equal(entity?.extractedPhrase, "Петровой Майи");
    assert.deepEqual(entity?.tokens, ["петровой", "майи"]);
  });

  it("scores full name higher than surname-only match", () => {
    const mayaScore = scorePersonName("Майя", "Петрова", ["петровой", "майи"]);
    const alevtinaScore = scorePersonName("Алевтина", "Петрова", [
      "петровой",
      "майи",
    ]);
    assert.ok(mayaScore > alevtinaScore);
  });
});
