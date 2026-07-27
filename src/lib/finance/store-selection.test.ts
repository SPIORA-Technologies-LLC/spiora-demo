import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import {
  resolveFinanceStoreMode,
  resetFinanceStoreCacheForTests,
} from "@/lib/finance/store-selection.ts";

describe("finance store selection", () => {
  afterEach(() => {
    resetFinanceStoreCacheForTests();
  });

  it("defaults tests to demo when NODE_ENV=test", () => {
    assert.equal(
      resolveFinanceStoreMode({ NODE_ENV: "test" }),
      "demo",
    );
  });

  it("honors explicit demo outside production", () => {
    assert.equal(
      resolveFinanceStoreMode({
        NODE_ENV: "development",
        FINANCE_STORE_MODE: "demo",
      }),
      "demo",
    );
  });

  it("defaults non-test to supabase", () => {
    assert.equal(
      resolveFinanceStoreMode({ NODE_ENV: "development" }),
      "supabase",
    );
    assert.equal(
      resolveFinanceStoreMode({ NODE_ENV: "production" }),
      "supabase",
    );
  });

  it("rejects demo mode in production", () => {
    assert.throws(
      () =>
        resolveFinanceStoreMode({
          NODE_ENV: "production",
          FINANCE_STORE_MODE: "demo",
        }),
      /forbidden in production/i,
    );
  });
});
