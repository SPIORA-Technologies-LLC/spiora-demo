import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { withAppEntrySplash } from "./app-entry-splash";

describe("withAppEntrySplash", () => {
  it("adds enter=1 to employee destinations", () => {
    assert.equal(withAppEntrySplash("/dashboard"), "/dashboard?enter=1");
    assert.equal(withAppEntrySplash("/settings"), "/settings?enter=1");
    assert.equal(
      withAppEntrySplash("/dashboard?foo=1"),
      "/dashboard?foo=1&enter=1",
    );
  });

  it("is idempotent when enter is already set", () => {
    assert.equal(
      withAppEntrySplash("/dashboard?enter=1"),
      "/dashboard?enter=1",
    );
  });
});
