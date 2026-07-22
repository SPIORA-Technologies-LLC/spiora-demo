import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GENERAL_CLIENT_ONBOARDING_SCHEMA } from "./questionnaire-demo-template.ts";
import {
  CanonicalJsonError,
  GENERAL_CLIENT_ONBOARDING_SCHEMA_HASH,
  GENERAL_CLIENT_ONBOARDING_SCHEMA_HASH_LEGACY,
  canonicalizeJson,
  hashCanonicalJson,
  hashQuestionnaireSchema,
} from "./questionnaire-schema-hash.ts";

describe("canonical questionnaire schema hash", () => {
  it("produces identical hash for different top-level object key order", () => {
    const a = { b: 1, a: 2, nested: { y: true, x: false } };
    const b = { nested: { x: false, y: true }, a: 2, b: 1 };
    assert.equal(hashCanonicalJson(a), hashCanonicalJson(b));
  });

  it("produces identical hash for nested object key reordering", () => {
    const left = {
      sections: [
        {
          id: "s1",
          title: { ru: "А", en: "A" },
          questions: [{ id: "q1", type: "text", label: { en: "Name", ru: "Имя" } }],
        },
      ],
    };
    const right = {
      sections: [
        {
          questions: [{ label: { ru: "Имя", en: "Name" }, type: "text", id: "q1" }],
          title: { en: "A", ru: "А" },
          id: "s1",
        },
      ],
    };
    assert.equal(hashCanonicalJson(left), hashCanonicalJson(right));
  });

  it("changes hash when array order changes", () => {
    assert.notEqual(
      hashCanonicalJson({ items: ["a", "b"] }),
      hashCanonicalJson({ items: ["b", "a"] }),
    );
  });

  it("matches hash after PostgreSQL-style key reordering round-trip", () => {
    const source = GENERAL_CLIENT_ONBOARDING_SCHEMA;
    const canonicalText = canonicalizeJson(source);
    const reordered = JSON.parse(canonicalText);
    // Simulate another reorder pass (as jsonb may present keys differently).
    const again = JSON.parse(JSON.stringify(reordered));
    assert.equal(hashQuestionnaireSchema(source), hashQuestionnaireSchema(reordered));
    assert.equal(hashQuestionnaireSchema(source), hashQuestionnaireSchema(again));
  });

  it("changes hash when label or value changes", () => {
    const base = hashQuestionnaireSchema(GENERAL_CLIENT_ONBOARDING_SCHEMA);
    const mutated = structuredClone(GENERAL_CLIENT_ONBOARDING_SCHEMA);
    mutated.title.en = `${mutated.title.en}!`;
    assert.notEqual(hashQuestionnaireSchema(mutated), base);
  });

  it("rejects invalid JSON values", () => {
    assert.throws(() => canonicalizeJson({ x: undefined }), CanonicalJsonError);
    assert.throws(() => canonicalizeJson({ x: () => 1 }), CanonicalJsonError);
    assert.throws(() => canonicalizeJson({ x: 1n }), CanonicalJsonError);
    assert.throws(() => canonicalizeJson({ x: Number.NaN }), CanonicalJsonError);
    assert.throws(() => canonicalizeJson({ x: Number.POSITIVE_INFINITY }), CanonicalJsonError);
  });

  it("locks the demo template canonical hash", () => {
    const hash = hashQuestionnaireSchema(GENERAL_CLIENT_ONBOARDING_SCHEMA);
    assert.equal(
      hash,
      "50bec4ccae383615d9a84d5658cebbe33cbee27852da2395d89c7ab080b882f9",
    );
    assert.equal(hash, GENERAL_CLIENT_ONBOARDING_SCHEMA_HASH);
    assert.equal(hash.length, 64);
    assert.ok(
      GENERAL_CLIENT_ONBOARDING_SCHEMA_HASH_LEGACY.includes(
        "222a220a4f8ef5ddbdca34849ef57145208425060a9dfc12b5668132d40a24ac",
      ),
    );
  });
});
