import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CaseCrmLinkError } from "@/lib/client-portal/case-crm-link.ts";

describe("case CRM link for Finance", () => {
  it("exposes typed error codes for ensure flow", () => {
    const err = new CaseCrmLinkError("CASE_NOT_FOUND", "Case not found");
    assert.equal(err.code, "CASE_NOT_FOUND");
    assert.equal(err.name, "CaseCrmLinkError");
  });
});
