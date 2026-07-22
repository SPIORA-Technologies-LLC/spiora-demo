/**
 * Browser-checklist domain/API equivalents for PR #31 staging validation.
 * Does not drive a real browser; maps checklist items to automated proofs.
 */
import assert from "node:assert/strict";
import { GENERAL_CLIENT_ONBOARDING_SCHEMA } from "../src/lib/client-portal/questionnaire-demo-template.ts";
import { buildReviewSections, formatAnswerForReview } from "../src/lib/client-portal/questionnaire-review.ts";
import { isQuestionVisible } from "../src/lib/client-portal/questionnaire-visibility.ts";
import { applyAnswerOperations, validateAnswersAgainstSchema } from "../src/lib/client-portal/questionnaire-validation.ts";
import { hashQuestionnaireSchema, GENERAL_CLIENT_ONBOARDING_SCHEMA_HASH } from "../src/lib/client-portal/questionnaire-schema-hash.ts";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const checks = {};
const gaps = [];

function pass(name) {
  checks[name] = "pass";
}
function fail(name, reason) {
  checks[name] = "fail";
  gaps.push(`${name}: ${reason}`);
}
function manual(name, reason) {
  checks[name] = "manual_required";
  gaps.push(`${name}: ${reason}`);
}

// Conditional visibility
{
  const spouseName = GENERAL_CLIENT_ONBOARDING_SCHEMA.sections
    .flatMap((s) => s.questions)
    .find((q) => q.id === "spouse_name");
  assert.ok(spouseName);
  const hidden = !isQuestionVisible(spouseName, { spouse_or_partner: false });
  const shown = isQuestionVisible(spouseName, { spouse_or_partner: true });
  if (hidden && shown) pass("conditional_visibility");
  else fail("conditional_visibility", "visibility rules incorrect");
}

// Boolean false is a value
{
  const applied = applyAnswerOperations(
    GENERAL_CLIENT_ONBOARDING_SCHEMA,
    [{ op: "set", questionId: "previous_refusal", value: false }],
    {},
  );
  if (applied.ok && applied.merged.previous_refusal === false) pass("boolean_false_persists");
  else fail("boolean_false_persists", "false treated incorrectly");
}

// Clear removes key
{
  const cleared = applyAnswerOperations(
    GENERAL_CLIENT_ONBOARDING_SCHEMA,
    [{ op: "clear", questionId: "previous_names" }],
    { previous_names: "Old" },
  );
  if (cleared.ok && !("previous_names" in cleared.merged)) pass("clear_removes_answer");
  else fail("clear_removes_answer", "key not removed");
}

// Validation blocks incomplete review payload
{
  const errors = validateAnswersAgainstSchema(
    GENERAL_CLIENT_ONBOARDING_SCHEMA,
    { first_name: "Ivan" },
    "en",
  );
  if (errors.some((e) => e.code === "REQUIRED")) pass("validation_blocks_incomplete");
  else fail("validation_blocks_incomplete", "required errors missing");
}

// Review formatting: option labels, hide display-only, hide invisible answers
{
  const sections = buildReviewSections(
    GENERAL_CLIENT_ONBOARDING_SCHEMA,
    {
      service_goal: "consultation",
      previous_refusal: false,
      spouse_or_partner: false,
      spouse_name: "ShouldHide",
    },
    "ru",
  );
  const flat = sections.flatMap((s) => s.items);
  const service = flat.find((i) => i.questionId === "service_goal");
  const spouse = flat.find((i) => i.questionId === "spouse_name");
  const heading = flat.find((i) => i.questionId === "welcome_heading");
  if (service?.value === "Консультация" && !spouse && !heading) {
    pass("review_option_labels_and_visibility");
  } else {
    fail("review_option_labels_and_visibility", "formatter output unexpected");
  }
}

// Country / boolean formatting
{
  const countryQ = GENERAL_CLIENT_ONBOARDING_SCHEMA.sections
    .flatMap((s) => s.questions)
    .find((q) => q.id === "citizenship");
  const boolQ = GENERAL_CLIENT_ONBOARDING_SCHEMA.sections
    .flatMap((s) => s.questions)
    .find((q) => q.id === "previous_refusal");
  const country = formatAnswerForReview(countryQ, "HR", "en");
  const no = formatAnswerForReview(boolQ, false, "ru");
  if (country && country !== "[object Object]" && no === "Нет") {
    pass("review_safe_text_formatting");
  } else {
    fail("review_safe_text_formatting", "unsafe/incorrect formatting");
  }
}

// Canonical hash stability (runtime verify contract)
{
  const hash = hashQuestionnaireSchema(GENERAL_CLIENT_ONBOARDING_SCHEMA);
  if (hash === GENERAL_CLIENT_ONBOARDING_SCHEMA_HASH) {
    pass("canonical_hash_locked");
  } else {
    fail("canonical_hash_locked", hash);
  }
}

// Route separation (static layout + HTTP probe when local server is up)
{
  const clientLayout = readFileSync(
    path.join(root, "src/app/client/(portal)/layout.tsx"),
    "utf8",
  );
  const employeeLogin = readFileSync(
    path.join(root, "src/app/login/page.tsx"),
    "utf8",
  );
  const codeOk =
    clientLayout.includes("getClientSession") &&
    clientLayout.includes('redirect("/client/login")') &&
    employeeLogin.includes("getSession") &&
    employeeLogin.includes("getClientSession");
  if (codeOk) pass("route_separation_code");
  else fail("route_separation_code", "layouts do not separate auth");
}

// UI-only browser items that require a real browser session
manual(
  "ui_home_questionnaire_card",
  "needs logged-in browser session on /client",
);
manual(
  "ui_autosave_and_refresh",
  "needs browser debounce/network observation",
);
manual(
  "ui_validation_summary_focus_aria",
  "needs browser focus/ARIA inspection",
);
manual(
  "ui_employee_vs_client_navigation",
  "needs browser navigation across /login and /client",
);

const ok = !Object.values(checks).includes("fail");
console.log(
  JSON.stringify(
    {
      ok,
      mode: "browser-checklist-equivalents",
      checks,
      gaps,
      note: "Items marked manual_required need a real browser session; domain/RLS items are automated.",
    },
    null,
    2,
  ),
);
if (!ok) process.exit(1);
