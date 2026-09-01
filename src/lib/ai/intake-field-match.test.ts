import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractFieldHint,
  rankIntakeFieldsForQuery,
} from "@/lib/ai/intake-field-match";

describe("intake-field-match", () => {
  const fields = [
    {
      questionId: "address",
      label: "Адрес",
      value: "Zagreb, Ilica 1",
    },
    {
      questionId: "passport_number",
      label: "Номер паспорта",
      value: "123456789",
    },
    {
      questionId: "marital_status",
      label: "Семейное положение",
      value: "В браке",
    },
  ];

  it("extracts field hint without client name tokens", () => {
    assert.equal(
      extractFieldHint("Какой адрес у Новак Матео", ["новак", "матео"]),
      "адрес",
    );
  });

  it("ranks address field for address query", () => {
    const ranked = rankIntakeFieldsForQuery(
      "Какой адрес у Новак Матео",
      fields,
      ["новак", "матео"],
    );
    assert.equal(ranked[0]?.questionId, "address");
  });

  it("ranks marital status for family question", () => {
    const ranked = rankIntakeFieldsForQuery(
      "Какое семейное положение у Ivan Ivanov",
      fields,
      ["ivan"],
    );
    assert.equal(ranked[0]?.questionId, "marital_status");
  });
});
