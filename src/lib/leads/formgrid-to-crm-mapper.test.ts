import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { validateLeadForCrmCreate } from "@/lib/leads/lead-create-validation";

const PREV_ADMIN = process.env.CRM_WRITE_ADMIN_EMAIL;
const PREV_PLATFORM = process.env.CRM_WRITE_PLATFORM_EMAILS;
const PREV_SERVICE = process.env.CRM_WRITE_SERVICE_EMAILS;

afterEach(() => {
  process.env.CRM_WRITE_ADMIN_EMAIL = PREV_ADMIN;
  process.env.CRM_WRITE_PLATFORM_EMAILS = PREV_PLATFORM;
  process.env.CRM_WRITE_SERVICE_EMAILS = PREV_SERVICE;
});

describe("validateLeadForCrmCreate test lead guard", () => {
  it("flags lead with test marker in name", () => {
    const errors = validateLeadForCrmCreate({
      name: "Иванов test Иванович",
      passport: "DEMO-P77706",
      phone: "+000000000002",
      email: "candidate@example.com",
    });
    assert.ok(errors.includes("test_lead_detected"));
  });

  it("flags lead with demo marker in name", () => {
    const errors = validateLeadForCrmCreate({
      name: "Петров Демо Петрович",
      passport: "DEMO-P76072",
      phone: "+000000000003",
      email: "candidate@example.com",
    });
    assert.ok(errors.includes("test_lead_detected"));
  });

  it("flags lead when email matches platform service list", () => {
    process.env.CRM_WRITE_PLATFORM_EMAILS = "team+service@northstar-mobility.example.com";
    const errors = validateLeadForCrmCreate({
      name: "Сидоров Иван Иванович",
      passport: "DEMO-P39419",
      phone: "+000000000004",
      email: "team+service@northstar-mobility.example.com",
    });
    assert.ok(errors.includes("test_lead_detected"));
  });

  it("flags lead when email matches admin email", () => {
    process.env.CRM_WRITE_ADMIN_EMAIL = "admin@northstar-mobility.example.com";
    const errors = validateLeadForCrmCreate({
      name: "Смирнова Анна Ивановна",
      passport: "DEMO-P77280",
      phone: "+000000000005",
      email: "admin@northstar-mobility.example.com",
    });
    assert.ok(errors.includes("test_lead_detected"));
  });

  it("keeps valid non-test lead clean", () => {
    const errors = validateLeadForCrmCreate({
      name: "Сидорова Анна Ивановна",
      passport: "DEMO-P77651",
      phone: "+000000000006",
      email: "sidorova.anna@example.com",
    });
    assert.equal(errors.includes("test_lead_detected"), false);
  });
});
