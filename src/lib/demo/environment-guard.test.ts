import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertDemoEnvironmentSafe,
  extractSupabaseProjectRef,
  validateDemoEnvironment,
} from "./environment-guard.ts";
import {
  areGoogleIntegrationsEnabled,
  isExternalAiIntegrationEnabled,
  isSupabaseIntegrationEnabled,
} from "./integration-policy.ts";
import { isSupabaseConfigured } from "../supabase/config.ts";
import { isAiConfigured } from "../ai/config.ts";

const DEMO_BASE = {
  SPIORA_DEMO_MODE: "true",
  AUTH_SECRET: "demo-secret",
  CRON_SECRET: "demo-cron",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
};

describe("environment-guard", () => {
  it("принимает чистую demo-конфигурацию без внешних интеграций", () => {
    const violations = validateDemoEnvironment(DEMO_BASE);
    assert.equal(violations.length, 0);
    assert.doesNotThrow(() => assertDemoEnvironmentSafe(DEMO_BASE));
  });

  it("отклоняет production URL в NEXT_PUBLIC_APP_URL", () => {
    const violations = validateDemoEnvironment({
      ...DEMO_BASE,
      NEXT_PUBLIC_APP_URL: "https://sharp-spice-team-platform.vercel.app",
    });
    assert.ok(violations.some((item) => item.code === "blocked_production_url"));
  });

  it("отклоняет заблокированный Supabase project ref", () => {
    const violations = validateDemoEnvironment({
      ...DEMO_BASE,
      NEXT_PUBLIC_SUPABASE_URL: "https://prodref123.supabase.co",
      SPIORA_BLOCKED_SUPABASE_PROJECT_REFS: "prodref123",
    });
    assert.ok(
      violations.some((item) => item.code === "blocked_supabase_project_ref"),
    );
  });

  it("отклоняет production Spreadsheet ID из blocklist", () => {
    const violations = validateDemoEnvironment({
      ...DEMO_BASE,
      GOOGLE_SHEETS_SPREADSHEET_ID: "1ProdSheetIdExample",
      SPIORA_BLOCKED_GOOGLE_SPREADSHEET_IDS: "1ProdSheetIdExample",
    });
    assert.ok(violations.some((item) => item.code === "blocked_spreadsheet_id"));
  });

  it("требует allowlist при включённом Supabase в demo mode", () => {
    const violations = validateDemoEnvironment({
      ...DEMO_BASE,
      SPIORA_ENABLE_SUPABASE: "true",
      NEXT_PUBLIC_SUPABASE_URL: "https://demo-ref-abc.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "demo-key",
    });
    assert.ok(
      violations.some((item) => item.code === "supabase_allowlist_required"),
    );
  });

  it("принимает demo Supabase ref в allowlist", () => {
    const violations = validateDemoEnvironment({
      ...DEMO_BASE,
      SPIORA_ENABLE_SUPABASE: "true",
      SPIORA_ALLOWED_SUPABASE_PROJECT_REFS: "demo-ref-abc",
      NEXT_PUBLIC_SUPABASE_URL: "https://demo-ref-abc.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "demo-key",
    });
    assert.equal(violations.length, 0);
  });

  it("извлекает Supabase project ref из URL", () => {
    assert.equal(
      extractSupabaseProjectRef("https://demo-ref-abc.supabase.co"),
      "demo-ref-abc",
    );
  });

  it("без SPIORA_DEMO_MODE guard не активен", () => {
    const violations = validateDemoEnvironment({
      NEXT_PUBLIC_APP_URL: "https://sharp-spice-team-platform.vercel.app",
    });
    assert.equal(violations.length, 0);
  });
});

describe("integration-policy in demo mode", () => {
  const envWithProdCredentials = {
    SPIORA_DEMO_MODE: "true",
    NEXT_PUBLIC_SUPABASE_URL: "https://legacy-prod.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "legacy-service-role",
    OPENROUTER_API_KEY: "legacy-openrouter-key",
    GOOGLE_SHEETS_SPREADSHEET_ID: "1LegacySheet",
    GOOGLE_SERVICE_ACCOUNT_EMAIL: "svc@example.com",
    GOOGLE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----",
  };

  it("отключает Supabase без SPIORA_ENABLE_SUPABASE", () => {
    const prev = process.env;
    process.env = { ...prev, ...envWithProdCredentials };
    try {
      assert.equal(isSupabaseIntegrationEnabled(process.env), false);
      assert.equal(isSupabaseConfigured(), false);
    } finally {
      process.env = prev;
    }
  });

  it("отключает внешний AI без SPIORA_ENABLE_EXTERNAL_AI", () => {
    const prev = process.env;
    process.env = { ...prev, ...envWithProdCredentials };
    try {
      assert.equal(isExternalAiIntegrationEnabled(process.env), false);
      assert.equal(isAiConfigured(), false);
    } finally {
      process.env = prev;
    }
  });

  it("отключает Google без SPIORA_ENABLE_GOOGLE_INTEGRATIONS", () => {
    const prev = process.env;
    process.env = { ...prev, ...envWithProdCredentials };
    try {
      assert.equal(areGoogleIntegrationsEnabled(process.env), false);
    } finally {
      process.env = prev;
    }
  });
});
