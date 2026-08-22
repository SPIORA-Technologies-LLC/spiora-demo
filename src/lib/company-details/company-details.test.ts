import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import type { SessionUser } from "@/lib/auth/types";
import {
  canManageCompanyDetails,
  canViewCompanyDetails,
} from "./permissions.ts";
import {
  getCompanyDetails,
  updateCompanyDetails,
} from "./service.ts";
import {
  resetCompanyDetailsStoreCacheForTests,
  resetCompanyDetailsStoreForTests,
} from "./store-selection.ts";
import { formatCompanyDetailsCopyText } from "./copy-formatter.ts";
import { createDemoCompanyDetailsSeed } from "./demo-seed.ts";
import { getDemoCompanyDetailsAuditTrailForTests } from "./demo-company-details-store.ts";
import { CompanyDetailsError } from "./errors.ts";
import { validateCompanyDetailsUpdate } from "./validation.ts";

const owner: SessionUser = {
  id: "owner-1",
  email: "owner@spiora.demo",
  name: "Owner",
  role: "owner",
};

const financeManager: SessionUser = {
  id: "finance-1",
  email: "finance@spiora.demo",
  name: "Finance",
  role: "finance_manager",
};

const manager: SessionUser = {
  id: "manager-1",
  email: "manager@spiora.demo",
  name: "Manager",
  role: "manager",
};

describe("company details permissions", () => {
  it("owner can view and manage", () => {
    assert.equal(canViewCompanyDetails(owner), true);
    assert.equal(canManageCompanyDetails(owner), true);
  });

  it("finance_manager can view and manage", () => {
    assert.equal(canViewCompanyDetails(financeManager), true);
    assert.equal(canManageCompanyDetails(financeManager), true);
  });

  it("manager can view but not manage", () => {
    assert.equal(canViewCompanyDetails(manager), true);
    assert.equal(canManageCompanyDetails(manager), false);
  });

  it("anonymous is denied", () => {
    assert.equal(canViewCompanyDetails(null), false);
    assert.equal(canManageCompanyDetails(null), false);
  });
});

describe("company details service", () => {
  beforeEach(async () => {
    resetCompanyDetailsStoreCacheForTests();
    await resetCompanyDetailsStoreForTests();
  });

  it("owner can view demo seed", async () => {
    const view = await getCompanyDetails(owner);
    assert.equal(view.companyName, "SPIORA Technologies LLC");
    assert.equal(view.isDemo, true);
    assert.equal(view.currency, "EUR");
    assert.equal(view.canManage, true);
  });

  it("finance_manager can edit", async () => {
    const updated = await updateCompanyDetails(financeManager, {
      ...createDemoCompanyDetailsSeed(),
      tradingName: "SPIORA Demo",
      expectedVersion: 1,
    });
    assert.equal(updated.tradingName, "SPIORA Demo");
    assert.equal(updated.version, 2);
  });

  it("manager cannot edit", async () => {
    await assert.rejects(
      () =>
        updateCompanyDetails(manager, {
          ...createDemoCompanyDetailsSeed(),
          tradingName: "Blocked",
          expectedVersion: 1,
        }),
      (err: unknown) =>
        err instanceof CompanyDetailsError &&
        err.code === "COMPANY_DETAILS_ACCESS_DENIED",
    );
  });

  it("returns version conflict on stale expectedVersion", async () => {
    await updateCompanyDetails(owner, {
      ...createDemoCompanyDetailsSeed(),
      tradingName: "SPIORA v2",
      expectedVersion: 1,
    });
    await assert.rejects(
      () =>
        updateCompanyDetails(owner, {
          ...createDemoCompanyDetailsSeed(),
          tradingName: "SPIORA stale",
          expectedVersion: 1,
        }),
      (err: unknown) =>
        err instanceof CompanyDetailsError &&
        err.code === "COMPANY_DETAILS_VERSION_CONFLICT",
    );
  });

  it("generates audit trail on update", async () => {
    await updateCompanyDetails(owner, {
      ...createDemoCompanyDetailsSeed(),
      phone: "+351 210 000 001",
      expectedVersion: 1,
    });
    const audit = getDemoCompanyDetailsAuditTrailForTests();
    assert.equal(audit.length, 1);
    assert.ok(audit[0].changedFields.includes("phone"));
  });

  it("validates required company name and country", () => {
    assert.throws(
      () =>
        validateCompanyDetailsUpdate({
          ...createDemoCompanyDetailsSeed(),
          companyName: "   ",
          expectedVersion: 1,
        }),
      (err: unknown) =>
        err instanceof CompanyDetailsError &&
        err.code === "COMPANY_DETAILS_VALIDATION",
    );
  });
});

describe("company details copy formatter", () => {
  it("includes demo marker and structured fields", () => {
    const text = formatCompanyDetailsCopyText(createDemoCompanyDetailsSeed());
    assert.match(text, /SPIORA Technologies LLC/);
    assert.match(text, /Company ID: DEMO-2026-001/);
    assert.match(text, /IBAN: PT00 0000 0000 0000 0000 0000 0/);
    assert.match(text, /DEMO DATA — NOT FOR REAL TRANSACTIONS/);
  });
});
