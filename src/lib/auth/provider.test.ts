import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  getAuthProvider,
  isLegacyAuthAllowed,
  resolveAuthProvider,
} from "./provider.ts";

const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

describe("auth provider", () => {
  beforeEach(() => {
    restoreEnv();
    delete process.env.SPIORA_AUTH_PROVIDER;
    delete process.env.SPIORA_ALLOW_LEGACY_AUTH;
    delete process.env.VERCEL;
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    restoreEnv();
  });

  it("local default is legacy", () => {
    const resolution = resolveAuthProvider(process.env);
    assert.equal(resolution.provider, "legacy");
    assert.equal(isLegacyAuthAllowed(process.env), true);
  });

  it("explicit supabase has no silent legacy fallback", () => {
    process.env.SPIORA_AUTH_PROVIDER = "supabase";
    assert.equal(getAuthProvider(process.env), "supabase");
    assert.equal(isLegacyAuthAllowed(process.env), false);
  });

  it("production forces supabase even if legacy requested", () => {
    process.env.NODE_ENV = "production";
    process.env.SPIORA_AUTH_PROVIDER = "legacy";
    process.env.SPIORA_ALLOW_LEGACY_AUTH = "true";
    assert.equal(getAuthProvider(process.env), "supabase");
    assert.equal(isLegacyAuthAllowed(process.env), false);
  });

  it("vercel forces supabase", () => {
    process.env.NODE_ENV = "development";
    process.env.VERCEL = "1";
    process.env.SPIORA_AUTH_PROVIDER = "legacy";
    assert.equal(getAuthProvider(process.env), "supabase");
  });
});
