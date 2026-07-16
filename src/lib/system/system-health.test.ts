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
    delete process.env.AUTH_SECRET;
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    restoreEnv();
  });

  it("в demo без Supabase возвращает disabled для PostgreSQL и Storage", async () => {
    const report = await getSystemHealth();
    assert.equal(report.postgresql, "disabled");
    assert.equal(report.storage, "disabled");
    assert.equal(report.google, "disabled");
    assert.equal(report.ai, "disabled");
    assert.equal(report.auth, "warning");
    assert.equal(report.session, "warning");
    assert.equal(report.rbac, "warning");
    assert.match(report.version, /^\d+\.\d+\.\d+$/);
  });

  it("без AUTH_SECRET в production — auth disabled", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.AUTH_SECRET;

    const report = await getSystemHealth();
    assert.equal(report.auth, "disabled");
    assert.equal(report.session, "disabled");
  });

  it("с AUTH_SECRET auth становится ok", async () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_SECRET = "strong-test-secret";
    const report = await getSystemHealth();
    assert.equal(report.auth, "ok");
    assert.equal(report.session, "warning");
    assert.equal(report.rbac, "warning");
  });

  it("не содержит URL, project ref и ключей", async () => {
    const report = await getSystemHealth();
    const serialized = JSON.stringify(report);
    assert.doesNotMatch(serialized, /supabase\.co/i);
    assert.doesNotMatch(serialized, /service_role/i);
    assert.doesNotMatch(serialized, /eyJ[A-Za-z0-9_-]{10,}/);
  });
});
