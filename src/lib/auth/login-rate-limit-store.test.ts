import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  checkProductionSafeLoginRateLimit,
  createMemoryLoginRateLimiter,
  resetPersistentLoginRateLimiterForTests,
} from "./login-rate-limit-store.ts";
import { LOGIN_MAX_ATTEMPTS_PER_MINUTE } from "./login-rate-limit.ts";

const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

describe("production-safe login rate limit", () => {
  beforeEach(() => {
    restoreEnv();
    resetPersistentLoginRateLimiterForTests();
    process.env.SPIORA_DEMO_MODE = "false";
    process.env.SPIORA_ENABLE_SUPABASE = "false";
  });

  afterEach(() => {
    restoreEnv();
    resetPersistentLoginRateLimiterForTests();
  });

  it("enforces limits outside demo mode via memory fallback", async () => {
    const limiter = createMemoryLoginRateLimiter();
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS_PER_MINUTE; i += 1) {
      assert.deepEqual(await limiter.check("demo@example.com", "127.0.0.1"), {
        allowed: true,
      });
    }
    const blocked = await limiter.check("demo@example.com", "127.0.0.1");
    assert.equal(blocked.allowed, false);
  });

  it("checkProductionSafeLoginRateLimit works without supabase", async () => {
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS_PER_MINUTE; i += 1) {
      const result = await checkProductionSafeLoginRateLimit(
        "rate@example.com",
        "10.0.0.1",
      );
      assert.equal(result.allowed, true);
    }
    const blocked = await checkProductionSafeLoginRateLimit(
      "rate@example.com",
      "10.0.0.1",
    );
    assert.equal(blocked.allowed, false);
  });
});
