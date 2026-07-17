import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateKbAiDraft } from "@/lib/knowledge-base/kb-ai-draft.ts";
import { slugifyKbTitle, suggestDuplicateSlug } from "@/lib/knowledge-base/kb-slug.ts";

describe("Knowledge Base slug helpers", () => {
  it("slugifyKbTitle normalizes case and spaces", () => {
    assert.equal(slugifyKbTitle("  New CRM Process  "), "new-crm-process");
  });

  it("suggestDuplicateSlug increments copy suffix", () => {
    assert.equal(suggestDuplicateSlug("my-article"), "my-article-copy");
    assert.equal(suggestDuplicateSlug("my-article", 2), "my-article-copy-2");
  });
});

describe("Knowledge Base AI draft generator", () => {
  it("returns bilingual draft with draft-safe slug", () => {
    const draft = generateKbAiDraft("CRM intake workflow for new clients");
    assert.match(draft.slug, /^[a-z0-9-]+$/);
    assert.ok(draft.translations.en.content.includes("##"));
    assert.ok(draft.translations.ru.content.includes("##"));
    assert.equal(draft.translations.en.title.length > 0, true);
    assert.equal(draft.translations.ru.title.length > 0, true);
  });
});
