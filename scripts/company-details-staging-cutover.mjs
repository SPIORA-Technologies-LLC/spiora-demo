#!/usr/bin/env node
/**
 * Company Details staging cutover helper (PR #34).
 * Modes: preflight | verify | smoke | all
 * Does not apply SQL.
 */
import assert from "node:assert/strict";

const mode = process.argv[2] ?? "all";

function section(title) {
  console.log(`\n=== ${title} ===`);
}

function preflightHint() {
  section("preflight");
  console.log("Run SPIORA_COMPANY_DETAILS_PREFLIGHT_049.sql in Supabase SQL editor.");
  console.log("Expect READY_TO_APPLY or ALREADY_APPLIED.");
}

function verifyHint() {
  section("verify");
  console.log("After apply, run SPIORA_COMPANY_DETAILS_VALIDATE_049.sql.");
  console.log("Expect VALIDATED_OK.");
}

async function smoke() {
  section("smoke (PostgreSQL)");

  if (process.env.COMPANY_DETAILS_STORE_MODE === "demo") {
    throw new Error(
      "Refuse smoke against demo store. Unset COMPANY_DETAILS_STORE_MODE or set supabase.",
    );
  }
  process.env.COMPANY_DETAILS_STORE_MODE = "supabase";

  const { isSupabaseConfigured } = await import("../src/lib/supabase/config.ts");
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase not configured — cannot run PostgreSQL company details smoke.",
    );
  }

  const { getCompanyDetails, updateCompanyDetails } = await import(
    "../src/lib/company-details/service.ts"
  );
  const { resetCompanyDetailsStoreCacheForTests } = await import(
    "../src/lib/company-details/store-selection.ts"
  );

  resetCompanyDetailsStoreCacheForTests();

  const owner = {
    id: "00000000-0000-4000-8000-000000000001",
    email: "owner-smoke@spiora.demo",
    name: "Smoke Owner",
    role: "owner",
  };

  const view = await getCompanyDetails(owner);
  assert.ok(view.companyName);
  assert.equal(view.isDemo, true);

  const updated = await updateCompanyDetails(owner, {
    ...view,
    phone: view.phone,
    expectedVersion: view.version,
  });
  assert.equal(updated.version, view.version + 1);
  console.log("Company details smoke OK");
}

if (mode === "preflight") preflightHint();
else if (mode === "verify") verifyHint();
else if (mode === "smoke") {
  await smoke();
} else {
  preflightHint();
  verifyHint();
  console.log("\nRun smoke manually after apply when Supabase is configured.");
}
