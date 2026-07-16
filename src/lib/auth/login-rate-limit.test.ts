import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  advanceLoginRateLimitForTests,
  checkLoginRateLimit,
  LOGIN_MAX_ATTEMPTS_PER_MINUTE,
  resetLoginRateLimitForTests,
} from "./login-rate-limit.ts";

const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

describe("login rate limit", () => {
  beforeEach(() => {
    restoreEnv();
    resetLoginRateLimitForTests();
    process.env.SPIORA_DEMO_MODE = "true";
  });

  afterEach(() => {
    restoreEnv();
    resetLoginRateLimitForTests();
  });

  it("blocks after configured attempts", () => {
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS_PER_MINUTE; i += 1) {
      assert.deepEqual(checkLoginRateLimit("demo@example.com", "127.0.0.1"), {
        allowed: true,
      });
    }
    const blocked = checkLoginRateLimit("demo@example.com", "127.0.0.1");
    assert.equal(blocked.allowed, false);
  });

  it("unblocks after time window advances", () => {
    for (let i = 0; i <= LOGIN_MAX_ATTEMPTS_PER_MINUTE; i += 1) {
      checkLoginRateLimit("demo@example.com", "127.0.0.1");
    }
    advanceLoginRateLimitForTests(60_000);
    assert.deepEqual(checkLoginRateLimit("demo@example.com", "127.0.0.1"), {
      allowed: true,
    });
  });

  it("is disabled outside demo mode", () => {
    process.env.SPIORA_DEMO_MODE = "false";
    for (let i = 0; i < 20; i += 1) {
      assert.deepEqual(checkLoginRateLimit("demo@example.com", "127.0.0.1"), {
        allowed: true,
      });
    }
  });
});
