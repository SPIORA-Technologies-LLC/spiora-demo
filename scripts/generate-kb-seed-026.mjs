import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const en = JSON.parse(
  fs.readFileSync(path.join(ROOT, "src/i18n/dictionaries/en.json"), "utf8"),
);
const ru = JSON.parse(
  fs.readFileSync(path.join(ROOT, "src/i18n/dictionaries/ru.json"), "utf8"),
);

const SEEDS = [
  ["client-onboarding-checklist", "client-workflow", ["onboarding", "clients", "workflow"], "daniel-cooper", "2026-06-15T10:00:00.000Z"],
  ["document-naming-rules", "document-management", ["documents", "templates"], "emma-wilson", "2026-05-20T14:30:00.000Z"],
  ["internal-communication-guidelines", "company-policies", ["communication", "compliance"], "olivia-bennett", "2026-04-10T09:00:00.000Z"],
  ["consultation-prep", "client-workflow", ["clients", "workflow"], "lucas-martin", "2026-06-01T11:15:00.000Z"],
  ["task-management-standards", "team-onboarding", ["tasks", "workflow"], "emma-wilson", "2026-03-25T16:00:00.000Z"],
  ["calendar-meeting-policy", "company-policies", ["calendar", "communication"], "olivia-bennett", "2026-02-14T08:45:00.000Z"],
  ["data-security-basics", "company-policies", ["security", "compliance"], "daniel-cooper", "2026-01-30T13:20:00.000Z"],
  ["working-with-ai-workspace", "ai-automation", ["ai", "workflow"], "daniel-cooper", "2026-06-20T15:00:00.000Z"],
  ["handling-uploaded-documents", "document-management", ["documents", "clients"], "lucas-martin", "2026-05-08T10:30:00.000Z"],
  ["escalation-procedure", "company-policies", ["workflow", "compliance"], "olivia-bennett", "2026-03-12T12:00:00.000Z"],
  ["team-member-onboarding", "team-onboarding", ["onboarding", "workflow"], "emma-wilson", "2026-02-28T09:30:00.000Z"],
  ["monthly-reporting-guide", "document-management", ["reporting", "templates"], "daniel-cooper", "2026-04-22T17:45:00.000Z"],
  ["client-intake-workflow", "client-workflow", ["clients", "workflow"], "lucas-martin", "2026-05-15T14:00:00.000Z"],
  ["standard-document-checklist", "document-management", ["documents", "clients", "templates"], "emma-wilson", "2026-06-10T11:00:00.000Z"],
  ["quality-review-process", "ai-automation", ["ai", "compliance", "workflow"], "olivia-bennett", "2026-06-05T10:15:00.000Z"],
];

function sqlLiteral(value) {
  if (value == null) return "null";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function pgArray(values) {
  if (!values.length) return "array[]::text[]";
  return `array[${values.map((v) => sqlLiteral(v)).join(", ")}]::text[]`;
}

const articleRows = [];
const translationRows = [];

for (const [slug, categoryId, tagKeys, authorKey, updatedAt] of SEEDS) {
  const enArticle = en.knowledgeBase.articles[slug];
  const ruArticle = ru.knowledgeBase.articles[slug];
  if (!enArticle || !ruArticle) {
    throw new Error(`Missing i18n for slug ${slug}`);
  }

  articleRows.push(
    `  (${sqlLiteral(slug)}, ${sqlLiteral(categoryId)}, ${pgArray(tagKeys)}, ${sqlLiteral(authorKey)}, 'published', ${sqlLiteral(updatedAt)}, ${sqlLiteral(updatedAt)})`,
  );

  for (const [locale, article] of [
    ["en", enArticle],
    ["ru", ruArticle],
  ]) {
    translationRows.push(
      `  ((select id from knowledge_base_articles where slug = ${sqlLiteral(slug)}), ${sqlLiteral(locale)}, ${sqlLiteral(article.title)}, ${sqlLiteral(article.summary)}, ${sqlLiteral(article.content)})`,
    );
  }
}

const sql = `-- =============================================================================
-- SPIORA_KNOWLEDGE_BASE_SEED_026.sql
-- PR #19 — 15 demo articles (EN + RU). Idempotent. No secrets.
-- Apply after migration 026. Do NOT auto-apply.
-- =============================================================================

insert into public.knowledge_base_articles (
  slug, category_id, tag_keys, author_key, status, updated_at, published_at
) values
${articleRows.join(",\n")}
on conflict (slug) do update set
  category_id = excluded.category_id,
  tag_keys = excluded.tag_keys,
  author_key = excluded.author_key,
  status = excluded.status,
  updated_at = excluded.updated_at,
  published_at = excluded.published_at,
  archived_at = null;

insert into public.knowledge_base_article_translations (
  article_id, locale, title, summary, content
) values
${translationRows.join(",\n")}
on conflict (article_id, locale) do update set
  title = excluded.title,
  summary = excluded.summary,
  content = excluded.content,
  updated_at = now();

-- verification
select count(*) as articles from public.knowledge_base_articles;
select locale, count(*) as translations from public.knowledge_base_article_translations group by locale order by locale;
`;

const outPath = path.join(ROOT, "SPIORA_KNOWLEDGE_BASE_SEED_026.sql");
fs.writeFileSync(outPath, sql, "utf8");
console.log(`Wrote ${outPath} (${fs.statSync(outPath).size} bytes)`);
