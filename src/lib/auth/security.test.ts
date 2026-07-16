import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkRequestOrigin,
  isSafeAppPath,
  resolvePostLoginPath,
  sanitizeAuthErrorMessage,
} from "./security.ts";

describe("auth security helpers", () => {
  it("blocks open redirects", () => {
    assert.equal(isSafeAppPath("/dashboard"), true);
    assert.equal(isSafeAppPath("//evil.com"), false);
    assert.equal(isSafeAppPath("https://evil.com"), false);
    assert.equal(isSafeAppPath("/\\evil"), false);
  });

  it("resolves safe redirect only when accessible", () => {
    assert.equal(
      resolvePostLoginPath("/settings", (p) => p === "/settings"),
      "/settings",
    );
    assert.equal(
      resolvePostLoginPath("/settings", () => false),
      "/dashboard",
    );
    assert.equal(
      resolvePostLoginPath("//evil.com", () => true),
      "/dashboard",
    );
  });

  it("detects origin mismatch", () => {
    assert.deepEqual(
      checkRequestOrigin("https://app.example.com", "app.example.com"),
      { ok: true },
    );
    assert.deepEqual(
      checkRequestOrigin("https://evil.com", "app.example.com"),
      { ok: false, reason: "origin-mismatch" },
    );
  });

  it("never returns raw password/provider errors", () => {
    assert.equal(
      sanitizeAuthErrorMessage("Invalid login credentials"),
      "invalid_credentials",
    );
    assert.equal(
      sanitizeAuthErrorMessage("Wrong password for user"),
      "invalid_credentials",
    );
    assert.doesNotMatch(
      sanitizeAuthErrorMessage("secret-token-abc"),
      /secret-token/,
    );
  });
});
