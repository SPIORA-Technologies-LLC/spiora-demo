import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { getSystemHealth } from "./system-health.ts";

const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

describe("system health", () => {
  beforeEach(() => {
    restoreEnv();
    process.env.SPIORA_DEMO_MODE = "true";
    process.env.SPIORA_ENABLE_SUPABASE = "false";
    process.env.SPIORA_ENABLE_GOOGLE_INTEGRATIONS = "false";
    process.env.SPIORA_ENABLE_EXTERNAL_AI = "false";
    process.env.SPIORA_AUTH_PROVIDER = "legacy";
    delete process.env.AUTH_SECRET;
    delete process.env.VERCEL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    restoreEnv();
  });

  it("в demo legacy без Supabase возвращает disabled для PostgreSQL и Storage", async () => {
    const report = await getSystemHealth();
    assert.equal(report.postgresql, "disabled");
    assert.equal(report.storage, "disabled");
    assert.equal(report.google, "disabled");
    assert.equal(report.ai, "disabled");
    assert.equal(report.authProvider, "legacy");
    assert.equal(report.auth, "warning");
    assert.equal(report.profiles, "disabled");
    assert.equal(report.session, "warning");
    assert.equal(report.rbac, "warning");
    assert.match(report.version, /^\d+\.\d+\.\d+$/);
  });

  it("в production без anon key — auth disabled (supabase forced)", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.AUTH_SECRET;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const report = await getSystemHealth();
    assert.equal(report.authProvider, "supabase");
    assert.equal(report.auth, "disabled");
    assert.equal(report.session, "disabled");
  });

  it("в development с AUTH_SECRET legacy auth становится ok", async () => {
    process.env.NODE_ENV = "development";
    process.env.SPIORA_AUTH_PROVIDER = "legacy";
    process.env.AUTH_SECRET = "strong-test-secret";
    const report = await getSystemHealth();
    assert.equal(report.authProvider, "legacy");
    assert.equal(report.auth, "ok");
    assert.equal(report.session, "warning");
    assert.equal(report.rbac, "warning");
  });

  it("не содержит URL, project ref, email и ключей", async () => {
    const report = await getSystemHealth();
    const serialized = JSON.stringify(report);
    assert.doesNotMatch(serialized, /supabase\.co/i);
    assert.doesNotMatch(serialized, /service_role/i);
    assert.doesNotMatch(serialized, /eyJ[A-Za-z0-9_-]{10,}/);
    assert.doesNotMatch(serialized, /@spiora\.demo/i);
  });
});
