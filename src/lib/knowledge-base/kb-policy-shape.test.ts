import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "026_knowledge_base.sql",
);

const REQUIRED_HELPERS = [
  "is_spiora_kb_reader",
  "kb_article_visible_to_reader",
  "knowledge_base_translations_search_vector",
] as const;

const REQUIRED_POLICIES = [
  "rls_kb_articles_select_owner",
  "rls_kb_articles_select_published",
  "rls_kb_articles_insert_owner",
  "rls_kb_articles_update_owner",
  "rls_kb_translations_select",
  "rls_kb_translations_insert_owner",
  "rls_kb_translations_update_owner",
] as const;

const RLS_TABLES = [
  "knowledge_base_articles",
  "knowledge_base_article_translations",
] as const;

function readMigration(): string {
  return readFileSync(MIGRATION_PATH, "utf8");
}

describe("Knowledge Base policy shape (migration 026)", () => {
  it("содержит таблицы articles и translations", () => {
    const sql = readMigration();
    assert.match(sql, /create table if not exists public\.knowledge_base_articles/i);
    assert.match(
      sql,
      /create table if not exists public\.knowledge_base_article_translations/i,
    );
    assert.match(sql, /tag_keys text\[\]/i);
    assert.match(sql, /search_vector tsvector/i);
  });

  it("содержит helper-функции и search trigger", () => {
    const sql = readMigration();
    for (const name of REQUIRED_HELPERS) {
      assert.match(sql, new RegExp(`function public\\.${name}`));
    }
    assert.match(sql, /security definer/i);
    assert.match(sql, /set search_path = public/i);
  });

  it("включает RLS на обеих таблицах KB", () => {
    const sql = readMigration();
    for (const table of RLS_TABLES) {
      assert.match(
        sql,
        new RegExp(`alter table public\\.${table} enable row level security`, "i"),
      );
    }
  });

  it("создаёт все ожидаемые KB policies", () => {
    const sql = readMigration();
    for (const policy of REQUIRED_POLICIES) {
      assert.match(sql, new RegExp(`policy ${policy}\\b`));
    }
  });

  it("запрещает hard delete и anon", () => {
    const sql = readMigration();
    assert.match(sql, /spiora_block_hard_delete/i);
    assert.match(sql, /revoke all on table public\.knowledge_base_articles from anon/i);
    assert.match(sql, /revoke delete on table public\.knowledge_base_articles from authenticated/i);
  });

  it("seed file содержит 15 slug и EN+RU", () => {
    const seed = readFileSync(
      path.join(process.cwd(), "SPIORA_KNOWLEDGE_BASE_SEED_026.sql"),
      "utf8",
    );
    const slugs = [
      "client-onboarding-checklist",
      "document-naming-rules",
      "internal-communication-guidelines",
      "consultation-prep",
      "task-management-standards",
      "calendar-meeting-policy",
      "data-security-basics",
      "working-with-ai-workspace",
      "handling-uploaded-documents",
      "escalation-procedure",
      "team-member-onboarding",
      "monthly-reporting-guide",
      "client-intake-workflow",
      "standard-document-checklist",
      "quality-review-process",
    ];
    for (const slug of slugs) {
      assert.match(seed, new RegExp(`'${slug}'`));
    }
    assert.equal((seed.match(/locale, title, summary, content/g) ?? []).length >= 1, true);
    assert.match(seed, /'en'/);
    assert.match(seed, /'ru'/);
  });
});
