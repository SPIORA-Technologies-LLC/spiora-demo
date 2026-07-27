import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import type { SessionUser } from "@/lib/auth/types.ts";
import {
  calculateClientFinance,
  calculateDashboardKpis,
  derivePaymentStatus,
} from "@/lib/finance/calculations.ts";
import { normalizeFinanceDirection } from "@/lib/finance/directions.ts";
import { formatEuroFromCents, parseEuroToCents } from "@/lib/finance/money.ts";
import { canManageFinance, canViewFinance } from "@/lib/finance/permissions.ts";
import { resetFinanceStoreForTests } from "@/lib/finance/demo-store.ts";
import { resetFinanceStoreCacheForTests } from "@/lib/finance/store-selection.ts";
import {
  addPayment,
  changeContract,
  createOrSetContract,
  getClientFinance,
  getFinanceSummary,
  listFinanceClients,
  voidPayment,
} from "@/lib/finance/service.ts";
import { FinanceError } from "@/lib/finance/errors.ts";

const owner: SessionUser = {
  id: "olivia-bennett",
  email: "olivia@spiora.demo",
  name: "Olivia Bennett",
  role: "owner",
};

const financeManager: SessionUser = {
  id: "sofia-reyes",
  email: "sofia@spiora.demo",
  name: "Sofia Reyes",
  role: "finance_manager",
};

const manager: SessionUser = {
  id: "emma-wilson",
  email: "emma@spiora.demo",
  name: "Emma Wilson",
  role: "manager",
};

describe("finance money helpers", () => {
  it("parses euros to cents without float truth", () => {
    assert.equal(parseEuroToCents("3800"), 380_000);
    assert.equal(parseEuroToCents("3 800"), 380_000);
    assert.equal(parseEuroToCents("1900.50"), 190_050);
    assert.equal(parseEuroToCents("0"), null);
    assert.equal(parseEuroToCents("-10"), null);
  });

  it("formats euro display", () => {
    assert.match(formatEuroFromCents(380_000, "ru"), /3[\u00a0\s]?800\s?€/);
    assert.equal(formatEuroFromCents(null, "en"), "—");
  });
});

describe("finance calculations", () => {
  it("derives payment statuses", () => {
    assert.equal(derivePaymentStatus(null, 0), "no_contract");
    assert.equal(derivePaymentStatus(380_000, 0), "unpaid");
    assert.equal(derivePaymentStatus(380_000, 190_000), "partial");
    assert.equal(derivePaymentStatus(380_000, 380_000), "paid");
    assert.equal(derivePaymentStatus(380_000, 400_000), "overpaid");
  });

  it("never shows negative debt and tracks overpayment", () => {
    const over = calculateClientFinance(380_000, 400_000);
    assert.equal(over.balanceCents, 0);
    assert.equal(over.overpaymentCents, 20_000);
  });

  it("dashboard KPIs exclude no-contract from debt", () => {
    const kpis = calculateDashboardKpis([
      { contractAmountCents: 380_000, paidAmountCents: 190_000 },
      { contractAmountCents: null, paidAmountCents: 50_000 },
      { contractAmountCents: 100_000, paidAmountCents: 100_000 },
    ]);
    assert.equal(kpis.totalContractsCents, 480_000);
    assert.equal(kpis.totalReceivedCents, 340_000);
    assert.equal(kpis.totalDebtCents, 190_000);
    assert.equal(kpis.clientsWithDebt, 1);
  });
});

describe("finance directions", () => {
  it("normalizes CRM direction aliases", () => {
    assert.equal(normalizeFinanceDirection("Spain"), "Spain");
    assert.equal(normalizeFinanceDirection("Испания"), "Spain");
    assert.equal(normalizeFinanceDirection("Хорватия"), "Croatia");
    assert.equal(normalizeFinanceDirection(""), null);
  });
});

describe("finance permissions", () => {
  it("owner and finance manager can view/manage", () => {
    assert.equal(canViewFinance(owner), true);
    assert.equal(canManageFinance(financeManager), true);
    assert.equal(canViewFinance(manager), false);
    assert.equal(canManageFinance(manager), false);
  });
});

describe("finance service flows", () => {
  beforeEach(async () => {
    resetFinanceStoreCacheForTests();
    await resetFinanceStoreForTests();
  });

  it("denies manager access to summary", async () => {
    await assert.rejects(() => getFinanceSummary(manager), /Finance access denied|FINANCE_ACCESS_DENIED/);
  });

  it("creates contract, payments, and recalculates totals", async () => {
    const clients = await listFinanceClients(owner, { limit: 100 });
    assert.ok(clients.total > 0);
    const clientId = clients.items[0]!.clientExternalId;

    await createOrSetContract(owner, clientId, {
      amount: "3800",
      contractDate: "2026-07-20",
    });

    let detail = await getClientFinance(owner, clientId);
    assert.equal(detail.summary.contractAmountCents, 380_000);
    assert.equal(detail.summary.paymentStatus, "unpaid");

    await addPayment(financeManager, clientId, {
      amount: "1900",
      paymentDate: "2026-07-20",
      idempotencyKey: "pay-1",
    });
    await addPayment(financeManager, clientId, {
      amount: "1000",
      paymentDate: "2026-08-20",
      idempotencyKey: "pay-2",
    });
    // idempotent replay
    await addPayment(financeManager, clientId, {
      amount: "1000",
      paymentDate: "2026-08-20",
      idempotencyKey: "pay-2",
    });

    detail = await getClientFinance(owner, clientId);
    assert.equal(detail.summary.paidAmountCents, 290_000);
    assert.equal(detail.summary.balanceCents, 90_000);
    assert.equal(detail.payments.filter((p) => !p.voidedAt).length, 2);

    await changeContract(owner, clientId, {
      amount: "4000",
      reason: "Program upgrade",
      expectedVersion: detail.profile!.version,
    });
    detail = await getClientFinance(owner, clientId);
    assert.equal(detail.summary.contractAmountCents, 400_000);
    assert.equal(detail.summary.balanceCents, 110_000);
    assert.ok(detail.contractChanges.some((c) => c.changeType === "amount_changed"));

    await assert.rejects(
      async () => {
        await changeContract(owner, clientId, {
          amount: "4100",
          reason: "stale version",
          expectedVersion: 1,
        });
      },
      (err: unknown) =>
        err instanceof FinanceError &&
        err.code === "FINANCE_CONCURRENT_MODIFICATION",
    );

    const paymentId = detail.payments.find((p) => !p.voidedAt)!.id;
    await voidPayment(owner, clientId, paymentId, "Entered twice");
    detail = await getClientFinance(owner, clientId);
    assert.equal(detail.payments.filter((p) => !p.voidedAt).length, 1);

    const summary = await getFinanceSummary(owner);
    assert.ok(summary.totalContractsCents >= 400_000);
  });

  it("rejects payment without contract and zero amounts", async () => {
    const clients = await listFinanceClients(owner, { limit: 5 });
    const clientId = clients.items[0]!.clientExternalId;
    await assert.rejects(
      () =>
        addPayment(owner, clientId, {
          amount: "100",
          paymentDate: "2026-07-20",
        }),
    );
    await createOrSetContract(owner, clientId, {
      amount: "1000",
      contractDate: "2026-07-01",
    });
    await assert.rejects(
      () =>
        addPayment(owner, clientId, {
          amount: "0",
          paymentDate: "2026-07-20",
        }),
    );
  });
});
