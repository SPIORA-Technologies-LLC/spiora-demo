import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  isKnowledgeBaseEmbeddedFallbackEnabled,
  isKnowledgeBasePostgresEnabled,
  shouldPreferEmbeddedKnowledgeBase,
} from "@/lib/knowledge-base/config.ts";
import { listEmbeddedKnowledgeBase } from "@/lib/knowledge-base/embedded-store.ts";

describe("Knowledge Base config flags", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("postgres enabled when Supabase integration on (default)", () => {
    process.env.SPIORA_DEMO_MODE = "true";
    process.env.SPIORA_ENABLE_SUPABASE = "true";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    delete process.env.SPIORA_KB_POSTGRES;
    assert.equal(isKnowledgeBasePostgresEnabled(), true);
  });

  it("embedded fallback default true in demo mode", () => {
    process.env.SPIORA_DEMO_MODE = "true";
    delete process.env.SPIORA_KB_EMBEDDED_FALLBACK;
    assert.equal(isKnowledgeBaseEmbeddedFallbackEnabled(), true);
  });

  it("embedded fallback off when env false", () => {
    process.env.SPIORA_DEMO_MODE = "true";
    process.env.SPIORA_KB_EMBEDDED_FALLBACK = "false";
    assert.equal(isKnowledgeBaseEmbeddedFallbackEnabled(), false);
  });

  it("prefer embedded when postgres disabled", () => {
    process.env.SPIORA_DEMO_MODE = "true";
    process.env.SPIORA_KB_POSTGRES = "false";
    process.env.SPIORA_ENABLE_SUPABASE = "false";
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    assert.equal(shouldPreferEmbeddedKnowledgeBase(), true);
  });
});

describe("Knowledge Base embedded listing", () => {
  it("returns embedded source with 15 articles", () => {
    const listing = listEmbeddedKnowledgeBase("en", {});
    assert.equal(listing.source, "embedded");
    assert.equal(listing.articles.length, 15);
    assert.match(listing.articles[0]?.slug ?? "", /^[a-z0-9-]+$/);
  });

  it("preserves deep link slug in selected article", () => {
    const listing = listEmbeddedKnowledgeBase("en", {
      article: "working-with-ai-workspace",
    });
    assert.equal(listing.selectedArticle?.slug, "working-with-ai-workspace");
  });
});
