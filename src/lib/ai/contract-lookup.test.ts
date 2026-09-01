import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  asksContractQuery,
} from "@/lib/ai/contract-lookup";
import { asksIntakeClientFact } from "@/lib/ai/intake-client-lookup";
import { extractFieldHint } from "@/lib/ai/intake-field-match";

describe("contract-lookup", () => {
  it("detects contract signing status questions", () => {
    const query =
      "С клиентом Zlata Moroz подписан договор? На какой он стадии";
    assert.equal(asksContractQuery(query), true);
  });

  it("does not treat contract questions as intake field lookup", () => {
    const query =
      "С клиентом Zlata Moroz подписан договор? На какой он стадии";
    assert.equal(asksIntakeClientFact(query), false);
  });

  it("strips contract noise from field hint extraction", () => {
    const hint = extractFieldHint(
      "С клиентом Zlata Moroz подписан договор? На какой он стадии",
      ["zlata", "moroz"],
    );
    assert.equal(hint, "");
  });

  it("detects agreement stage questions", () => {
    assert.equal(
      asksContractQuery("На какой стадии договор у Ivan Petrov"),
      true,
    );
  });

  it("does not flag unrelated status questions as contract", () => {
    assert.equal(
      asksContractQuery("Какой статус дела в кабинете у Белова?"),
      false,
    );
  });
});
