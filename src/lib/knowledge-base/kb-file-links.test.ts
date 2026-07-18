import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeKbLinkLabel,
  normalizeKbLinkUrl,
} from "@/lib/knowledge-base/kb-link-formats.ts";

describe("KB file links", () => {
  it("accepts http(s) URLs and rejects unsafe schemes", () => {
    assert.equal(normalizeKbLinkUrl("https://example.com/a"), "https://example.com/a");
    assert.equal(normalizeKbLinkUrl("  http://example.com  "), "http://example.com");
    assert.equal(normalizeKbLinkUrl("javascript:alert(1)"), null);
    assert.equal(normalizeKbLinkUrl("not-a-url"), null);
  });

  it("trims labels and caps length", () => {
    assert.equal(normalizeKbLinkLabel("  Docs  "), "Docs");
    assert.equal(normalizeKbLinkLabel(""), null);
    assert.equal(normalizeKbLinkLabel("x".repeat(250))?.length, 200);
  });

  it("migration 031 defines links table and RLS", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/031_knowledge_base_file_links.sql"),
      "utf8",
    );
    assert.match(sql, /create table if not exists public\.knowledge_base_links/i);
    assert.match(sql, /rls_kb_links_select_published/);
    assert.match(sql, /https\?:\/\//);
  });
});
