import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canUseAppBadge } from "./app-badge.ts";

describe("app badge helpers", () => {
  it("reports badge API unavailable in Node test environment", () => {
    assert.equal(canUseAppBadge(), false);
  });
});
