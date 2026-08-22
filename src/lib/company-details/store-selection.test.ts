import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveCompanyDetailsStoreMode } from "./store-selection.ts";

describe("company details store selection", () => {
  it("defaults tests to demo store", () => {
    assert.equal(
      resolveCompanyDetailsStoreMode({ NODE_ENV: "test" }),
      "demo",
    );
  });

  it("forbids demo store in production", () => {
    assert.throws(() =>
      resolveCompanyDetailsStoreMode({
        NODE_ENV: "production",
        COMPANY_DETAILS_STORE_MODE: "demo",
      }),
    );
  });
});
