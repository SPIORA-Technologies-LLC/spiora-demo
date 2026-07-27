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
    assert.equal(canAccessPath("manager", "/finance"), false);
  });

  it("finance manager can access finance but not settings", () => {
    assert.equal(canAccessPath("finance_manager", "/finance"), true);
    assert.equal(canAccessPath("finance_manager", "/finance/analytics"), true);
    assert.equal(canAccessPath("finance_manager", "/settings"), false);
    assert.equal(canAccessPath("finance_manager", "/clients"), true);
  });

  it("owner can access finance", () => {
    assert.equal(canAccessPath("owner", "/finance"), true);
    assert.equal(canAccessPath("owner", "/finance/analytics"), true);
  });

  it("manager keeps access to standard app modules", () => {
    assert.equal(canAccessPath("manager", "/dashboard"), true);
    assert.equal(canAccessPath("manager", "/clients/DEMO-1001"), true);
    assert.equal(canAccessPath("manager", "/calendar"), true);
  });

  it("owner nav contains settings and finance while manager does not", () => {
    const ownerNav = getNavItemsForRole("owner").map((item) => item.href);
    const managerNav = getNavItemsForRole("manager").map((item) => item.href);
    const financeNav = getNavItemsForRole("finance_manager").map(
      (item) => item.href,
    );
    assert.equal(ownerNav.includes("/settings"), true);
    assert.equal(ownerNav.includes("/finance"), true);
    assert.equal(managerNav.includes("/settings"), false);
    assert.equal(managerNav.includes("/finance"), false);
    assert.equal(financeNav.includes("/finance"), true);
    assert.equal(financeNav.includes("/settings"), false);
  });

  it("hides legacy leads and formgrid demo from sidebar", () => {
    for (const role of ["owner", "manager", "finance_manager"] as const) {
      const hrefs = getNavItemsForRole(role).map((item) => item.href);
      assert.equal(hrefs.includes("/crm/leads"), false);
      assert.equal(hrefs.includes("/new-formgrid-clients"), false);
      assert.equal(hrefs.includes("/clients/intake"), true);
      assert.equal(hrefs.includes("/client-invitations"), true);
    }
  });
});
