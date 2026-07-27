#!/usr/bin/env node
/**
 * Finance staging cutover helper (PR #33.1).
 * Modes: preflight | verify | smoke | all
 * Does not apply SQL.
 * Smoke uses PostgreSQL Finance store (refuses FINANCE_STORE_MODE=demo).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const mode = process.argv[2] ?? "all";

function section(title) {
  console.log(`\n=== ${title} ===`);
}

function preflightHint() {
  section("preflight");
  console.log("Run SPIORA_FINANCE_PREFLIGHT_036.sql in Supabase SQL editor.");
  console.log("Expect READY_TO_APPLY or ALREADY_APPLIED.");
}

function verifyHint() {
  section("verify");
  console.log("After apply, run SPIORA_FINANCE_VALIDATE_036.sql.");
  console.log("Expect VALIDATED_OK.");
}

async function smoke() {
  section("smoke (PostgreSQL)");

  if (process.env.FINANCE_STORE_MODE === "demo") {
    throw new Error(
      "Refuse smoke against demo store. Unset FINANCE_STORE_MODE or set supabase.",
    );
  }
  process.env.FINANCE_STORE_MODE = "supabase";

  const { isSupabaseConfigured } = await import(
    "../src/lib/supabase/config.ts"
  );
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase not configured — cannot run PostgreSQL finance smoke.",
    );
  }

  const { getSupabaseAdmin } = await import("../src/lib/supabase/server.ts");
  const {
    addPayment,
    changeContract,
    createOrSetContract,
    getClientFinance,
    getFinanceAnalytics,
    getFinanceSummary,
    voidPayment,
  } = await import("../src/lib/finance/service.ts");
  const { resetFinanceStoreCacheForTests } = await import(
    "../src/lib/finance/store-selection.ts"
  );

  resetFinanceStoreCacheForTests();
  const admin = getSupabaseAdmin();
  const tag = `finance-smoke-${Date.now()}`;
  const externalId = `SMOKE-FIN-${tag.slice(-8)}`;

  const owner = {
    id: "smoke-owner",
    email: "owner-smoke@spiora.demo",
    name: "Smoke Owner",
    role: "owner",
  };
  const financeManager = {
    id: "smoke-finance",
    email: "finance-smoke@spiora.demo",
    name: "Smoke Finance",
    role: "finance_manager",
  };
  const manager = {
    id: "smoke-manager",
    email: "manager-smoke@spiora.demo",
    name: "Smoke Manager",
    role: "manager",
  };

  let clientUuid = null;
  let profileId = null;

  try {
    const { data: client, error: clientError } = await admin
      .from("clients")
      .insert({
        external_id: externalId,
        first_name: "Finance",
        last_name: "Smoke",
        full_name: `Finance Smoke ${tag}`,
        email: `${externalId.toLowerCase()}@example.com`,
        phone: "",
        status: "New",
        pipeline_stage: "New",
        assigned_user_id: null,
        assigned_manager_name: "",
        country: "Spain",
        citizenship: "",
        direction: "Spain",
        service_type: "Spain",
        source: "finance-smoke",
        notes_summary: "",
        passport_number: null,
        last_activity_at: null,
        is_demo: true,
      })
      .select("id, external_id")
      .single();
    if (clientError) throw clientError;
    clientUuid = client.id;

    let detail = await getClientFinance(owner, externalId);
    assert.equal(detail.summary.paymentStatus, "no_contract");

    const summaryEmpty = await getFinanceSummary(owner);
    assert.equal(typeof summaryEmpty.totalContractsCents, "number");

    await createOrSetContract(owner, externalId, {
      amount: "3800",
      contractDate: "2026-03-15",
    });
    detail = await getClientFinance(owner, externalId);
    assert.equal(detail.summary.contractAmountCents, 380_000);
    assert.ok(detail.profile);
    profileId = detail.profile.id;
    assert.ok(
      detail.contractChanges.some((c) => c.changeType === "contract_created"),
      "immutable history required",
    );

    await assert.rejects(
      () =>
        createOrSetContract(owner, externalId, {
          amount: "1000",
          contractDate: "2026-03-16",
        }),
      /FINANCE_CONTRACT_ALREADY_EXISTS|already/i,
    );

    const summary = await getFinanceSummary(owner);
    assert.ok(summary.totalContractsCents >= 380_000);

    const idem = `smoke-pay-${randomUUID()}`;
    await addPayment(financeManager, externalId, {
      amount: "1900",
      paymentDate: "2026-03-20",
      idempotencyKey: idem,
    });
    await addPayment(financeManager, externalId, {
      amount: "1900",
      paymentDate: "2026-03-20",
      idempotencyKey: idem,
    });
    detail = await getClientFinance(owner, externalId);
    assert.equal(detail.summary.paidAmountCents, 190_000);
    assert.equal(detail.payments.filter((p) => !p.voidedAt).length, 1);

    await addPayment(financeManager, externalId, {
      amount: "1000",
      paymentDate: "2026-04-20",
      idempotencyKey: `smoke-pay-2-${randomUUID()}`,
    });
    detail = await getClientFinance(owner, externalId);
    assert.equal(detail.summary.paidAmountCents, 290_000);
    assert.equal(detail.summary.balanceCents, 90_000);

    const version = detail.profile.version;
    await changeContract(owner, externalId, {
      amount: "4000",
      reason: "smoke upgrade",
      expectedVersion: version,
    });
    detail = await getClientFinance(owner, externalId);
    assert.equal(detail.summary.contractAmountCents, 400_000);

    await assert.rejects(
      () =>
        changeContract(owner, externalId, {
          amount: "4100",
          reason: "stale",
          expectedVersion: version,
        }),
      /FINANCE_CONCURRENT_MODIFICATION|concurrent/i,
    );

    const voidTarget = detail.payments.find((p) => !p.voidedAt);
    assert.ok(voidTarget);
    await voidPayment(owner, externalId, voidTarget.id, "smoke void");
    detail = await getClientFinance(owner, externalId);
    assert.equal(detail.payments.filter((p) => !p.voidedAt).length, 1);

    const analytics = await getFinanceAnalytics(owner, {
      periodType: "year",
      year: 2026,
      direction: "Spain",
    });
    assert.equal(analytics.monthly.length, 12);

    await assert.rejects(() => getFinanceSummary(manager));

    // History immutability (append-only)
    const { error: histUpdateError } = await admin
      .from("client_finance_contract_changes")
      .update({ reason: "tamper" })
      .eq("finance_profile_id", profileId);
    assert.ok(histUpdateError, "history update must fail");

    console.log("SMOKE_OK");
  } finally {
    // Soft cleanup: void payments + archive profile; history rows remain (append-only).
    if (clientUuid) {
      await admin
        .from("client_finance_payments")
        .update({
          voided_at: new Date().toISOString(),
          voided_by: "smoke-cleanup",
          void_reason: "smoke cleanup",
        })
        .eq("client_id", clientUuid)
        .is("voided_at", null);
      await admin
        .from("client_finance_profiles")
        .update({ archived_at: new Date().toISOString() })
        .eq("client_id", clientUuid)
        .is("archived_at", null);
      await admin
        .from("clients")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", clientUuid);
    }
    resetFinanceStoreCacheForTests();
  }
}

async function main() {
  if (mode === "preflight" || mode === "all") preflightHint();
  if (mode === "verify" || mode === "all") verifyHint();
  if (mode === "smoke" || mode === "all") await smoke();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
