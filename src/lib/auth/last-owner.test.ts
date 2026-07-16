import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Unit-level contract for last-owner protection.
 * Mirrors sbSuspendUserProfile / sbArchiveUserProfile rules without DB.
 */
function canChangeOwnerLifecycle(params: {
  role: string;
  remainingActiveOwners: number;
}): boolean {
  if (params.role !== "owner") return true;
  return params.remainingActiveOwners >= 1;
}

describe("last owner protection", () => {
  it("blocks suspend/archive of the last active owner", () => {
    assert.equal(
      canChangeOwnerLifecycle({ role: "owner", remainingActiveOwners: 0 }),
      false,
    );
  });

  it("allows owner lifecycle when another owner remains", () => {
    assert.equal(
      canChangeOwnerLifecycle({ role: "owner", remainingActiveOwners: 1 }),
      true,
    );
  });

  it("does not apply last-owner rule to managers", () => {
    assert.equal(
      canChangeOwnerLifecycle({ role: "manager", remainingActiveOwners: 0 }),
      true,
    );
  });
});
