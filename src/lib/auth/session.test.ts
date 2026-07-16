import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SignJWT } from "jose";
import type { SessionUser } from "./types.ts";
import {
  COOKIE_NAME,
  SESSION_TTL_SECONDS,
  createSessionToken,
  getAuthSecretState,
  getSessionCookieConfig,
  verifySessionToken,
} from "./session.ts";

const user: SessionUser = {
  id: "olivia-bennett",
  email: "olivia@spiora.demo",
  name: "Olivia Bennett",
  role: "owner",
};

describe("auth session", () => {
  it("uses env secret when configured", () => {
    const state = getAuthSecretState({
      AUTH_SECRET: "top-secret",
      NODE_ENV: "production",
    } as NodeJS.ProcessEnv);
    assert.equal(state.source, "env");
    assert.ok(state.secret);
  });

  it("uses dev fallback outside production", () => {
    const state = getAuthSecretState({
      NODE_ENV: "development",
    } as NodeJS.ProcessEnv);
    assert.equal(state.source, "dev-fallback");
    assert.ok(state.secret);
  });

  it("returns missing in production without AUTH_SECRET", () => {
    const state = getAuthSecretState({
      NODE_ENV: "production",
    } as NodeJS.ProcessEnv);
    assert.equal(state.source, "missing");
    assert.equal(state.secret, null);
  });

  it("creates and verifies a valid token", async () => {
    process.env.AUTH_SECRET = "unit-test-secret";
    process.env.NODE_ENV = "test";
    const token = await createSessionToken(user);
    const session = await verifySessionToken(token, process.env);
    assert.deepEqual(session, user);
  });

  it("rejects expired token", async () => {
    const secret = new TextEncoder().encode("unit-test-secret");
    const token = await new SignJWT(user)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 10)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1)
      .sign(secret);

    const session = await verifySessionToken(token, {
      AUTH_SECRET: "unit-test-secret",
      NODE_ENV: "test",
    } as NodeJS.ProcessEnv);
    assert.equal(session, null);
  });

  it("rejects token with unsupported role", async () => {
    const secret = new TextEncoder().encode("unit-test-secret");
    const token = await new SignJWT({
      ...user,
      role: "consultant",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(secret);

    const session = await verifySessionToken(token, {
      AUTH_SECRET: "unit-test-secret",
      NODE_ENV: "test",
    } as NodeJS.ProcessEnv);
    assert.equal(session, null);
  });

  it("exposes secure cookie defaults", () => {
    const config = getSessionCookieConfig({
      NODE_ENV: "production",
    } as NodeJS.ProcessEnv);
    assert.equal(COOKIE_NAME, "spiora_session");
    assert.equal(config.httpOnly, true);
    assert.equal(config.sameSite, "lax");
    assert.equal(config.path, "/");
    assert.equal(config.secure, true);
    assert.equal(config.maxAge, SESSION_TTL_SECONDS);
  });
});
