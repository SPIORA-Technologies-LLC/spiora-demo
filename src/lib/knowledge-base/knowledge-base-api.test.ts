import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { DEMO_KB_ARTICLE_SEEDS } from "@/lib/knowledge-base/demo-articles.ts";
import {
  isXssSafeMarkdownInput,
  KB_VALID_AUTHOR_KEYS,
  KB_VALID_CATEGORIES,
  KB_VALID_TAG_KEYS,
  normalizeKbSlug,
  parseKbCreateBody,
  parseKbPatchBody,
} from "@/lib/knowledge-base/knowledge-base-api.ts";
import {
  isKnowledgeBaseEmbeddedFallbackEnabled,
  isKnowledgeBasePostgresEnabled,
} from "@/lib/knowledge-base/config.ts";

const SEED_PATH = path.join(process.cwd(), "SPIORA_KNOWLEDGE_BASE_SEED_026.sql");

function readSeed(): string {
  return readFileSync(SEED_PATH, "utf8");
}

function extractArticleSlugs(sql: string): string[] {
  const section = sql.split("insert into public.knowledge_base_article_translations")[0] ?? "";
  const matches = [...section.matchAll(/\('([a-z0-9-]+)', '/g)];
  return matches.map((m) => m[1]!);
}

function extractTranslationPairs(sql: string): Array<{ slug: string; locale: string }> {
  const matches = [
    ...sql.matchAll(/where slug = '([a-z0-9-]+)'\), '(en|ru)',/g),
  ];
  return matches.map((m) => ({ slug: m[1]!, locale: m[2]! }));
}

describe("Knowledge Base seed audit (026)", () => {
  const sql = readSeed();
  const slugs = extractArticleSlugs(sql);
  const translations = extractTranslationPairs(sql);

  it("ровно 15 уникальных статей", () => {
    assert.equal(slugs.length, 15);
    assert.equal(new Set(slugs).size, 15);
  });

  it("ровно 30 переводов", () => {
    assert.equal(translations.length, 30);
  });

  it("для каждого slug есть ru и en", () => {
    for (const seed of DEMO_KB_ARTICLE_SEEDS) {
      const locales = translations
        .filter((t) => t.slug === seed.slug)
        .map((t) => t.locale);
      assert.deepEqual(new Set(locales), new Set(["en", "ru"]), seed.slug);
    }
  });

  it("idempotent upsert clauses", () => {
    assert.match(sql, /on conflict \(slug\) do update/i);
    assert.match(sql, /on conflict \(article_id, locale\) do update/i);
  });

  it("нет секретов в заголовке seed (контент может упоминать passwords)", () => {
    const header = sql.split("insert into public.knowledge_base_article_translations")[0] ?? "";
    assert.doesNotMatch(header, /service_role|bearer\s|AUTH_SECRET/i);
    assert.doesNotMatch(sql, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });

  it("длинный текст в dollar-quote (апострофы не ломают SQL)", () => {
    assert.match(sql, /\$kb_[a-z0-9_]+\$/);
    assert.match(sql, /client's direction/);
    assert.match(sql, /today's priorities/);
    assert.doesNotMatch(sql, /client''s direction/);
  });

  it("deep links slug совпадают с demo-articles", () => {
    const expected = DEMO_KB_ARTICLE_SEEDS.map((s) => s.slug).sort();
    assert.deepEqual([...slugs].sort(), expected);
  });

  it("категории и теги из whitelist", () => {
    for (const seed of DEMO_KB_ARTICLE_SEEDS) {
      assert.ok(KB_VALID_CATEGORIES.has(seed.categoryId), seed.slug);
      for (const tag of seed.tagKeys) {
        assert.ok(KB_VALID_TAG_KEYS.has(tag), `${seed.slug}:${tag}`);
      }
      assert.ok(KB_VALID_AUTHOR_KEYS.has(seed.authorId), seed.slug);
    }
  });
});

describe("Knowledge Base API validation", () => {
  const validBody = {
    slug: "New-Policy-Draft",
    categoryId: "company-policies",
    tagKeys: ["compliance"],
    authorKey: "olivia-bennett",
    status: "draft",
    translations: [
      {
        locale: "en",
        title: "Title EN",
        summary: "Summary EN",
        content: "## Body EN",
      },
      {
        locale: "ru",
        title: "Заголовок RU",
        summary: "Кратко RU",
        content: "## Тело RU",
      },
    ],
  };

  it("slug нормализуется в lowercase", () => {
    const parsed = parseKbCreateBody(validBody);
    assert.equal(parsed.ok && parsed.data.slug, "new-policy-draft");
    assert.equal(normalizeKbSlug("  Mixed-Case  "), "mixed-case");
  });

  it("неизвестный locale → invalid_locale", () => {
    const parsed = parseKbCreateBody({
      ...validBody,
      translations: [{ locale: "de", title: "T", summary: "S", content: "C" }],
    });
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.error, "invalid_locale");
  });

  it("status archived на create запрещён", () => {
    const parsed = parseKbCreateBody({ ...validBody, status: "archived" });
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.error, "archived_not_allowed_on_create");
  });

  it("произвольный status отклоняется", () => {
    const parsed = parseKbCreateBody({ ...validBody, status: "hidden" });
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.error, "invalid_status");
  });

  it("пустой content отклоняется", () => {
    const parsed = parseKbCreateBody({
      ...validBody,
      status: "published",
      translations: [{ locale: "en", title: "T", summary: "S", content: "  " }],
    });
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.error, "empty_field");
  });

  it("draft допускает пустую вторую локаль и пустой summary/content", () => {
    const parsed = parseKbCreateBody({
      ...validBody,
      status: "draft",
      translations: [
        { locale: "en", title: "Draft EN", summary: "", content: "" },
        { locale: "ru", title: "", summary: "", content: "" },
      ],
    });
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.data.translations.length, 1);
      assert.equal(parsed.data.translations[0]?.locale, "en");
      assert.equal(parsed.data.translations[0]?.summary, "");
    }
  });

  it("publish требует обе локали полностью", () => {
    const parsed = parseKbCreateBody({
      ...validBody,
      status: "published",
      translations: [
        { locale: "en", title: "EN", summary: "S", content: "C" },
        { locale: "ru", title: "", summary: "", content: "" },
      ],
    });
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.error, "empty_field");
  });

  it("кириллический slug отклоняется normalizeKbSlug", () => {
    assert.equal(normalizeKbSlug("новая-политика"), null);
  });

  it("authorKey вне whitelist отклоняется", () => {
    const parsed = parseKbCreateBody({
      ...validBody,
      authorKey: "00000000-0000-0000-0000-000000000001",
    });
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.error, "invalid_author");
  });

  it("PATCH publish action принимается", () => {
    const parsed = parseKbPatchBody({ action: "publish" });
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.data.action, "publish");
  });

  it("PATCH archive action принимается", () => {
    const parsed = parseKbPatchBody({ action: "archive" });
    assert.equal(parsed.ok, true);
  });

  it("publish с externalUrl допускает пустой content", () => {
    const parsed = parseKbCreateBody({
      ...validBody,
      status: "published",
      externalUrl: "https://example.com/guide",
      translations: [
        { locale: "en", title: "Guide", summary: "External", content: "" },
        { locale: "ru", title: "Гид", summary: "Внешний", content: "" },
      ],
    });
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.data.externalUrl, "https://example.com/guide");
      assert.equal(parsed.data.translations[0]?.content, "https://example.com/guide");
    }
  });

  it("javascript: URL отклоняется", () => {
    const parsed = parseKbCreateBody({
      ...validBody,
      externalUrl: "javascript:alert(1)",
    });
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.error, "invalid_url");
  });

  it("migration 030 adds external_url", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/030_knowledge_base_links.sql"),
      "utf8",
    );
    assert.match(sql, /external_url/);
    assert.match(sql, /https\?:\/\//);
  });

  it("пустой PATCH отклоняется", () => {
    const parsed = parseKbPatchBody({});
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.error, "empty_patch");
  });

  it("markdown с script отклоняется проверкой XSS", () => {
    assert.equal(isXssSafeMarkdownInput("## ok"), true);
    assert.equal(isXssSafeMarkdownInput('<script>alert(1)</script>'), false);
    assert.equal(isXssSafeMarkdownInput("[x](javascript:alert(1))"), false);
  });
});

describe("Knowledge Base API RBAC policy (static)", () => {
  it("hard delete endpoint отсутствует в API tree", () => {
    const apiDir = path.join(process.cwd(), "src/app/api/knowledge-base");
    const files = readFileSync(path.join(apiDir, "route.ts"), "utf8");
    const slugFiles = readFileSync(path.join(apiDir, "[slug]/route.ts"), "utf8");
    assert.doesNotMatch(files, /export async function DELETE/);
    assert.doesNotMatch(slugFiles, /export async function DELETE/);
  });

  it("fallback off при пустой БД требует controlled error path", () => {
    const envBackup = { ...process.env };
    try {
      process.env.SPIORA_DEMO_MODE = "true";
      process.env.SPIORA_ENABLE_SUPABASE = "true";
      process.env.SPIORA_KB_POSTGRES = "true";
      process.env.SPIORA_KB_EMBEDDED_FALLBACK = "false";
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
      assert.equal(isKnowledgeBasePostgresEnabled(), true);
      assert.equal(isKnowledgeBaseEmbeddedFallbackEnabled(), false);
    } finally {
      process.env = envBackup;
    }
  });
});

describe("Knowledge Base owner route guards (source audit)", () => {
  it("POST и PATCH проверяют session.role === owner", () => {
    const postRoute = readFileSync(
      path.join(process.cwd(), "src/app/api/knowledge-base/route.ts"),
      "utf8",
    );
    const patchRoute = readFileSync(
      path.join(process.cwd(), "src/app/api/knowledge-base/[slug]/route.ts"),
      "utf8",
    );
    assert.match(postRoute, /session\.role !== "owner"/);
    assert.match(patchRoute, /session\.role !== "owner"/);
    assert.match(postRoute, /status: 401/);
    assert.match(postRoute, /status: 403/);
  });

  it("slug в PATCH берётся только из URL params", () => {
    const patchRoute = readFileSync(
      path.join(process.cwd(), "src/app/api/knowledge-base/[slug]/route.ts"),
      "utf8",
    );
    assert.match(patchRoute, /const \{ slug \} = await context\.params/);
    assert.doesNotMatch(patchRoute, /raw\.slug/);
  });
});
