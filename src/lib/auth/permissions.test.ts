import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canAccessPath, getNavItemsForRole } from "./permissions.ts";

describe("auth permissions", () => {
  it("owner can access settings and analytics", () => {
    assert.equal(canAccessPath("owner", "/settings"), true);
    assert.equal(canAccessPath("owner", "/analytics/overview"), true);
  });

  it("manager cannot access owner-only sections", () => {
    assert.equal(canAccessPath("manager", "/settings"), false);
    assert.equal(canAccessPath("manager", "/analytics/overview"), false);
  });

  it("manager keeps access to standard app modules", () => {
    assert.equal(canAccessPath("manager", "/dashboard"), true);
    assert.equal(canAccessPath("manager", "/clients/DEMO-1001"), true);
    assert.equal(canAccessPath("manager", "/calendar"), true);
  });

  it("owner nav contains settings while manager nav does not", () => {
    const ownerNav = getNavItemsForRole("owner").map((item) => item.href);
    const managerNav = getNavItemsForRole("manager").map((item) => item.href);
    assert.equal(ownerNav.includes("/settings"), true);
    assert.equal(managerNav.includes("/settings"), false);
  });

  it("hides legacy leads and formgrid demo from sidebar", () => {
    for (const role of ["owner", "manager"] as const) {
      const hrefs = getNavItemsForRole(role).map((item) => item.href);
      assert.equal(hrefs.includes("/crm/leads"), false);
      assert.equal(hrefs.includes("/new-formgrid-clients"), false);
      assert.equal(hrefs.includes("/clients/intake"), true);
      assert.equal(hrefs.includes("/client-invitations"), true);
    }
  });
});
