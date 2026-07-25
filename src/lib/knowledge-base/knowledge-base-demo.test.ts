import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  countKnowledgeBaseLeafKeys,
  translateKnowledgeBaseArticle,
  translateKnowledgeBaseCategory,
  translateKnowledgeBaseMessage,
  translateKnowledgeBaseTag,
} from "@/i18n/knowledge-base-messages.ts";
import { DEMO_KB_ARTICLE_SEEDS } from "@/lib/knowledge-base/demo-articles.ts";
import {
  buildDemoAiKnowledgeBaseText,
  searchDemoArticles,
} from "@/lib/knowledge-base/resolve-articles.ts";
import {
  getDemoKnowledgeBaseTextForAi,
  listDemoKnowledgeBase,
  resetDemoKnowledgeBaseStore,
  seedDemoKnowledgeBaseIfNeeded,
} from "@/lib/knowledge-base/store.ts";

function seedRecords() {
  return DEMO_KB_ARTICLE_SEEDS.map((seed) => ({
    ...seed,
    id: seed.slug,
    createdAt: "2026-01-01T00:00:00.000Z",
  }));
}

describe("Knowledge Base i18n EN", () => {
  it("title without Cyrillic", () => {
    assert.equal(translateKnowledgeBaseMessage("en", "title"), "Database");
    assert.doesNotMatch(translateKnowledgeBaseMessage("en", "title"), /[А-Яа-яЁё]/);
  });

  it("upload disabled message without Cyrillic", () => {
    const msg = translateKnowledgeBaseMessage("en", "upload.disabled");
    assert.match(msg, /disabled in the public demo/i);
    assert.doesNotMatch(msg, /[А-Яа-яЁё]/);
  });

  it("categories EN without Cyrillic", () => {
    assert.equal(
      translateKnowledgeBaseCategory("en", "company-policies"),
      "Company Policies",
    );
    assert.equal(
      translateKnowledgeBaseCategory("en", "ai-automation"),
      "AI & Automation",
    );
  });
});

describe("Knowledge Base i18n RU", () => {
  it("title in Russian", () => {
    assert.equal(translateKnowledgeBaseMessage("ru", "title"), "База данных");
    assert.match(translateKnowledgeBaseMessage("ru", "title"), /[А-Яа-яЁё]/);
  });

  it("upload disabled in Russian", () => {
    assert.equal(
      translateKnowledgeBaseMessage("ru", "upload.disabled"),
      "Загрузка файлов отключена в публичной демоверсии.",
    );
  });

  it("categories RU localized", () => {
    assert.equal(
      translateKnowledgeBaseCategory("ru", "client-workflow"),
      "Работа с клиентами",
    );
    assert.equal(
      translateKnowledgeBaseCategory("ru", "team-onboarding"),
      "Адаптация сотрудников",
    );
  });
});

describe("Knowledge Base demo materials", () => {
  it("has 15 demo articles in 5 categories", () => {
    assert.equal(DEMO_KB_ARTICLE_SEEDS.length, 15);
    const categories = new Set(DEMO_KB_ARTICLE_SEEDS.map((a) => a.categoryId));
    assert.equal(categories.size, 5);
  });

  it("EN/RU article titles localized", () => {
    const slug = "client-onboarding-checklist";
    const enTitle = translateKnowledgeBaseArticle("en", slug, "title");
    const ruTitle = translateKnowledgeBaseArticle("ru", slug, "title");
    assert.doesNotMatch(enTitle, /[А-Яа-яЁё]/);
    assert.match(ruTitle, /[А-Яа-яЁё]/);
  });

  it("demo content has no production folder IDs", () => {
    const records = seedRecords();
    const enText = buildDemoAiKnowledgeBaseText(records, "en", "onboarding");
    assert.doesNotMatch(enText, /GOOGLE_DRIVE|folderId|service account|spreadsheet/i);
    assert.match(enText, /\/knowledge-base\?article=/);
  });
});

describe("Knowledge Base search", () => {
  const records = seedRecords();

  it("finds articles by English query", () => {
    const result = searchDemoArticles(records, "en", { q: "onboarding checklist" });
    assert.ok(result.articles.some((a) => a.slug === "client-onboarding-checklist"));
  });

  it("finds articles by Russian query", () => {
    const result = searchDemoArticles(records, "ru", { q: "эскалац" });
    assert.ok(result.articles.some((a) => a.slug === "escalation-procedure"));
  });

  it("returns empty state for unknown query", () => {
    const result = searchDemoArticles(records, "en", { q: "zzzznotfound12345" });
    assert.equal(result.articles.length, 0);
  });

  it("filters by category", () => {
    const result = searchDemoArticles(records, "en", {
      category: "ai-automation",
    });
    assert.ok(result.articles.every((a) => a.categoryId === "ai-automation"));
    assert.ok(result.articles.length >= 2);
  });

  it("filters by tag", () => {
    const result = searchDemoArticles(records, "en", { tag: "security" });
    assert.ok(result.articles.some((a) => a.slug === "data-security-basics"));
  });
});

describe("Knowledge Base demo mode store", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup, SPIORA_DEMO_MODE: "true" };
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("seeds demo articles without Google Drive", async () => {
    await resetDemoKnowledgeBaseStore();
    const articles = await seedDemoKnowledgeBaseIfNeeded();
    assert.equal(articles.length, 15);
  });

  it("AI receives only demo KB context", async () => {
    await resetDemoKnowledgeBaseStore();
    const text = await getDemoKnowledgeBaseTextForAi("en", "AI Workspace");
    assert.match(text, /Database \(demo materials\)|demo materials/i);
    assert.ok(text.includes("working-with-ai-workspace") || text.includes("AI Workspace"));
    assert.doesNotMatch(text, /GOOGLE_DRIVE_KB_FOLDER_ID/);
  });

  it("listDemoKnowledgeBase returns embedded source", async () => {
    await resetDemoKnowledgeBaseStore();
    const listing = await listDemoKnowledgeBase("en", {});
    assert.equal(listing.source, "embedded");
    assert.equal(listing.demo, true);
    assert.equal(listing.uploadDisabled, true);
    assert.equal(listing.readOnly, true);
    assert.equal(listing.articles.length, 15);
  });
});

describe("Knowledge Base demo guards", () => {
  it("EN upload guard without Cyrillic", () => {
    const msg = translateKnowledgeBaseMessage("en", "demoGuard.upload");
    assert.match(msg, /disabled in the public demo/i);
    assert.doesNotMatch(msg, /[А-Яа-яЁё]/);
  });

  it("RU edit guard in Russian", () => {
    assert.match(translateKnowledgeBaseMessage("ru", "demoGuard.edit"), /[А-Яа-яЁё]/);
  });
});

describe("Knowledge Base security", () => {
  it("article content does not expose raw HTML script tags in translation", () => {
    const content = translateKnowledgeBaseArticle(
      "en",
      "data-security-basics",
      "content",
    );
    assert.doesNotMatch(content, /<script/i);
  });

  it("tags are localized labels not raw IDs in search results", () => {
    const records = seedRecords();
    const result = searchDemoArticles(records, "en", { tag: "ai" });
    for (const article of result.articles) {
      assert.ok(article.tagLabels.length > 0);
      assert.doesNotMatch(article.tagLabels.join(" "), /^(ai|workflow)$/);
    }
    assert.ok(
      result.articles.some((a) =>
        a.tagLabels.some((label) => label === translateKnowledgeBaseTag("en", "ai")),
      ),
    );
  });
});

describe("Knowledge Base mixed-language audit", () => {
  it("EN UI keys without Cyrillic", () => {
    const keys = [
      "search.placeholder",
      "search.noResults",
      "actions.copyLink",
      "empty.selectArticle",
      "errors.accessDenied",
      "demoBadge",
    ];
    for (const key of keys) {
      const value = translateKnowledgeBaseMessage("en", key);
      assert.doesNotMatch(value, /[А-Яа-яЁё]/, `key ${key} leaked Cyrillic: ${value}`);
    }
  });

  it("RU UI keys without English UI leakage", () => {
    const keys = [
      "search.placeholder",
      "search.noResults",
      "actions.copyLink",
      "empty.selectArticle",
      "errors.accessDenied",
    ];
    for (const key of keys) {
      const value = translateKnowledgeBaseMessage("ru", key);
      assert.match(value, /[А-Яа-яЁё]/, `key ${key} not localized: ${value}`);
    }
  });
});

describe("Knowledge Base i18n key count", () => {
  it("has substantial knowledgeBase namespace", () => {
    const count = countKnowledgeBaseLeafKeys();
    assert.ok(count >= 100, `expected >= 100 keys, got ${count}`);
  });
});
