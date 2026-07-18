import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  translateKnowledgeBaseArticle,
  translateKnowledgeBaseCategory,
  translateKnowledgeBaseTag,
} from "@/i18n/knowledge-base-messages.ts";
import {
  buildKbListQuery,
  pickKbTranslation,
  resolveKbRequestLocale,
} from "@/lib/knowledge-base/kb-locale.ts";
import { flattenKbTranslationRow } from "@/lib/knowledge-base/map-articles.ts";
import { searchDemoArticles } from "@/lib/knowledge-base/resolve-articles.ts";
import { DEMO_KB_ARTICLE_SEEDS } from "@/lib/knowledge-base/demo-articles.ts";

const SLUG = "internal-communication-guidelines";

function seedRecords() {
  return DEMO_KB_ARTICLE_SEEDS.map((seed) => ({
    ...seed,
    id: seed.slug,
    createdAt: "2026-01-01T00:00:00.000Z",
  }));
}

const bilingualJoin = {
  id: "1",
  slug: SLUG,
  category_id: "company-policies" as const,
  tag_keys: ["communication", "compliance"],
  author_key: "olivia-bennett",
  status: "published" as const,
  updated_at: "2026-04-10T09:00:00.000Z",
  published_at: "2026-04-10T09:00:00.000Z",
  archived_at: null,
  external_url: null,
  knowledge_base_article_translations: [
    {
      locale: "ru" as const,
      title: "Правила внутренней коммуникации",
      summary: "RU summary",
      content: "## RU body",
    },
    {
      locale: "en" as const,
      title: "Internal communication guidelines",
      summary: "EN summary",
      content: "## EN body",
    },
  ],
};

describe("Knowledge Base locale switching", () => {
  it("locale=en returns English article title/content", () => {
    const flat = flattenKbTranslationRow(bilingualJoin, "en");
    assert.ok(flat);
    assert.equal(flat.title, "Internal communication guidelines");
    assert.equal(flat.content, "## EN body");
    assert.equal(flat.resolvedLocale, "en");
    assert.equal(flat.fallbackUsed, false);
    assert.doesNotMatch(flat.title, /[А-Яа-яЁё]/);
  });

  it("locale=ru returns Russian article title/content", () => {
    const flat = flattenKbTranslationRow(bilingualJoin, "ru");
    assert.ok(flat);
    assert.equal(flat.title, "Правила внутренней коммуникации");
    assert.equal(flat.content, "## RU body");
    assert.equal(flat.resolvedLocale, "ru");
    assert.equal(flat.fallbackUsed, false);
    assert.match(flat.title, /[А-Яа-яЁё]/);
  });

  it("EN→RU query string changes (new fetch cache key)", () => {
    const enQs = buildKbListQuery({
      locale: "en",
      article: SLUG,
    });
    const ruQs = buildKbListQuery({
      locale: "ru",
      article: SLUG,
    });
    assert.match(enQs, /locale=en/);
    assert.match(ruQs, /locale=ru/);
    assert.notEqual(enQs, ruQs);
  });

  it("category/tag labels change with locale", () => {
    const en = searchDemoArticles(seedRecords(), "en", {});
    const ru = searchDemoArticles(seedRecords(), "ru", {});
    const enCat = en.categories.find((c) => c.id === "company-policies");
    const ruCat = ru.categories.find((c) => c.id === "company-policies");
    assert.equal(enCat?.label, translateKnowledgeBaseCategory("en", "company-policies"));
    assert.equal(ruCat?.label, translateKnowledgeBaseCategory("ru", "company-policies"));
    assert.notEqual(enCat?.label, ruCat?.label);
    assert.doesNotMatch(enCat?.label ?? "", /[А-Яа-яЁё]/);
    assert.match(ruCat?.label ?? "", /[А-Яа-яЁё]/);

    assert.equal(
      translateKnowledgeBaseTag("en", "communication"),
      "Communication",
    );
    assert.match(translateKnowledgeBaseTag("ru", "communication"), /[А-Яа-яЁё]/);
  });

  it("deep link keeps selected language in list query", () => {
    const qs = buildKbListQuery({
      locale: "en",
      article: "quality-review-process",
      category: "company-policies",
    });
    assert.match(qs, /locale=en/);
    assert.match(qs, /article=quality-review-process/);
    assert.match(qs, /category=company-policies/);
  });

  it("fallback does not replace EN with RU when EN translation exists", () => {
    // RU listed first in join — must still pick EN when requested
    const picked = pickKbTranslation(
      bilingualJoin.knowledge_base_article_translations,
      "en",
    );
    assert.ok(picked);
    assert.equal(picked.resolvedLocale, "en");
    assert.equal(picked.fallbackUsed, false);
    assert.equal(picked.translation.title, "Internal communication guidelines");

    const flat = flattenKbTranslationRow(bilingualJoin, "en");
    assert.equal(flat?.title, "Internal communication guidelines");
    assert.equal(flat?.fallbackUsed, false);
  });

  it("EN UI does not show Cyrillic title stored in en translation", () => {
    const cyrillicInEn = {
      ...bilingualJoin,
      knowledge_base_article_translations: [
        {
          locale: "en" as const,
          title: "Рабочая этика",
          summary: "Draft guide generated from: Рабочая этика",
          content: "## Overview\n\nРабочая этика",
        },
        {
          locale: "ru" as const,
          title: "Рабочая этика",
          summary: "RU",
          content: "## RU",
        },
      ],
    };
    const flat = flattenKbTranslationRow(cyrillicInEn, "en");
    assert.ok(flat);
    assert.doesNotMatch(flat.title, /[А-Яа-яЁё]/);
    assert.equal(flat.title, "Work Ethics");
    assert.doesNotMatch(flat.title, /Rabochaya|Etika/i);
    assert.equal(flat.fallbackUsed, true);
  });

  it("explicit fallback reports resolvedLocale when preferred missing", () => {
    const ruOnly = {
      ...bilingualJoin,
      knowledge_base_article_translations: [
        bilingualJoin.knowledge_base_article_translations[0]!,
      ],
    };
    const flat = flattenKbTranslationRow(ruOnly, "en");
    assert.ok(flat);
    assert.equal(flat.requestedLocale, "en");
    assert.equal(flat.resolvedLocale, "ru");
    assert.equal(flat.fallbackUsed, true);
    assert.equal(flat.title, "Правила внутренней коммуникации");
  });

  it("query locale overrides cookie locale", () => {
    assert.equal(resolveKbRequestLocale("en", "ru"), "en");
    assert.equal(resolveKbRequestLocale("ru", "en"), "ru");
    assert.equal(resolveKbRequestLocale(null, "ru"), "ru");
    assert.equal(resolveKbRequestLocale("de", "en"), "en");
  });

  it("embedded listing EN/RU titles differ for same slug", () => {
    const en = searchDemoArticles(seedRecords(), "en", { article: SLUG });
    const ru = searchDemoArticles(seedRecords(), "ru", { article: SLUG });
    assert.equal(
      en.selectedArticle?.title,
      translateKnowledgeBaseArticle("en", SLUG, "title"),
    );
    assert.equal(
      ru.selectedArticle?.title,
      translateKnowledgeBaseArticle("ru", SLUG, "title"),
    );
    assert.notEqual(en.selectedArticle?.title, ru.selectedArticle?.title);
    assert.equal(en.requestedLocale, "en");
    assert.equal(ru.requestedLocale, "ru");
    assert.equal(en.fallbackUsed, false);
  });
});
