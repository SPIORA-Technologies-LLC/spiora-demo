import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  asksContractListQuery,
  asksContractQuery,
  extractContractClientNameTokens,
} from "@/lib/ai/contract-lookup";
import { asksIntakeClientFact } from "@/lib/ai/intake-client-lookup";
import { extractFieldHint } from "@/lib/ai/intake-field-match";
import { extractPersonNameTokens, scorePersonName } from "@/lib/ai/name-matching";

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

  it("detects plural contract list queries", () => {
    const query =
      "У каких еще клиентов есть проблема с договорами, где нужно подписать";
    assert.equal(asksContractListQuery(query), true);
  });

  it("does not treat list query words as client name", () => {
    const query =
      "У каких еще клиентов есть проблема с договорами, где нужно подписать";
    assert.deepEqual(extractContractClientNameTokens(query), []);
    assert.deepEqual(extractPersonNameTokens(query), []);
  });

  it("still extracts named client for single contract lookup", () => {
    assert.deepEqual(extractContractClientNameTokens("договор у Zlata Moroz"), [
      "zlata",
      "moroz",
    ]);
  });

  it("picks clear winner for genitive name query", () => {
    const mayaScore = scorePersonName("Майя", "Петрова", ["петровой", "майи"]);
    const alevtinaScore = scorePersonName("Алевтина", "Петрова", [
      "петровой",
      "майи",
    ]);
    assert.ok(mayaScore > alevtinaScore);
  });
});
