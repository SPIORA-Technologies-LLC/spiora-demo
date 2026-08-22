import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import { CompanyDetailsError } from "./errors";
import { createDemoCompanyDetailsSeed } from "./demo-seed";
import type { CompanyDetailsRecord, CompanyDetailsUpdateInput } from "./types";
import type { CompanyDetailsStore } from "./store";

type AuditEntry = {
  changedAt: string;
  changedBy: string;
  changedFields: string[];
  previousValues: Record<string, string>;
  newValues: Record<string, string>;
};

let record: CompanyDetailsRecord = createDemoCompanyDetailsSeed();
let auditTrail: AuditEntry[] = [];

function diffFields(
  before: CompanyDetailsRecord,
  after: CompanyDetailsRecord,
): {
  changedFields: string[];
  previousValues: Record<string, string>;
  newValues: Record<string, string>;
} {
  const keys = [
    "companyName",
    "tradingName",
    "registrationNumber",
    "vatNumber",
    "addressLine1",
    "addressLine2",
    "city",
    "postalCode",
    "country",
    "generalEmail",
    "financeEmail",
    "phone",
    "website",
    "bankAccountHolder",
    "bankName",
    "iban",
    "swiftBic",
    "currency",
  ] as const;

  const changedFields: string[] = [];
  const previousValues: Record<string, string> = {};
  const newValues: Record<string, string> = {};

  for (const key of keys) {
    if (before[key] !== after[key]) {
      changedFields.push(key);
      previousValues[key] = before[key];
      newValues[key] = after[key];
    }
  }

  return { changedFields, previousValues, newValues };
}

export function getDemoCompanyDetailsAuditTrailForTests(): AuditEntry[] {
  return auditTrail;
}

export function createDemoCompanyDetailsStore(): CompanyDetailsStore {
  return {
    async get() {
      return { ...record };
    },

    async update(actor: SessionUser, input: CompanyDetailsUpdateInput) {
      if (input.expectedVersion !== record.version) {
        throw new CompanyDetailsError(
          "COMPANY_DETAILS_VERSION_CONFLICT",
          "Company details were changed by another user. Refresh and try again.",
          409,
        );
      }

      const before = { ...record };
      const now = new Date().toISOString();
      record = {
        ...record,
        ...input,
        version: record.version + 1,
        updatedAt: now,
        updatedBy: actor.id,
      };

      const change = diffFields(before, record);
      if (change.changedFields.length > 0) {
        auditTrail.push({
          changedAt: now,
          changedBy: actor.id,
          ...change,
        });
      }

      return { ...record };
    },

    async resetForTests() {
      record = createDemoCompanyDetailsSeed();
      auditTrail = [];
    },
  };
}
