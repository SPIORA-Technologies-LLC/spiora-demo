import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateKbAiDraft } from "@/lib/knowledge-base/kb-ai-draft.ts";
import { slugifyKbTitle, suggestDuplicateSlug } from "@/lib/knowledge-base/kb-slug.ts";

describe("Knowledge Base slug helpers", () => {
  it("slugifyKbTitle normalizes case and spaces", () => {
    assert.equal(slugifyKbTitle("  New CRM Process  "), "new-crm-process");
  });

  it("slugifyKbTitle strips non-ASCII so slug matches API normalize", () => {
    assert.equal(slugifyKbTitle("Новая политика компании"), "article");
    assert.equal(slugifyKbTitle("Policy 2026 — CRM"), "policy-2026-crm");
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

  it("Russian prompt translates into real English EN title (not transliteration)", () => {
    const draft = generateKbAiDraft("Рабочая этика");
    assert.doesNotMatch(draft.translations.en.title, /[А-Яа-яЁё]/);
    assert.match(draft.translations.ru.title, /Рабочая этика/);
    assert.equal(draft.translations.en.title, "Work Ethics");
    assert.doesNotMatch(draft.translations.en.title, /Rabochaya|Etika/i);
    assert.doesNotMatch(draft.translations.en.content.split("\n")[2] ?? "", /[А-Яа-яЁё]/);
  });

  it("Corporate ethics prompt gets English translation", () => {
    const draft = generateKbAiDraft("Корпоративная Этика");
    assert.equal(draft.translations.en.title, "Corporate Ethics");
    assert.doesNotMatch(draft.translations.en.title, /Korporativ/i);
  });
});
