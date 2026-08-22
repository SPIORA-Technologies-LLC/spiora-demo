import { branding } from "@/config/branding";
import type { CompanyDetailsRecord } from "./types";

export const DEMO_COMPANY_DETAILS_ID = "00000000-0000-4000-8000-000000000049";

export function createDemoCompanyDetailsSeed(
  overrides: Partial<CompanyDetailsRecord> = {},
): CompanyDetailsRecord {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: DEMO_COMPANY_DETAILS_ID,
    companyName: "SPIORA Technologies LLC",
    tradingName: "SPIORA",
    registrationNumber: "DEMO-2026-001",
    vatNumber: "EU-DEMO-260001",
    addressLine1: "42 Innovation Avenue",
    addressLine2: "Suite 210",
    city: "Lisbon",
    postalCode: "1000-001",
    country: "Portugal",
    generalEmail: "demo@spiora.example",
    financeEmail: "finance@spiora.example",
    phone: "+351 210 000 000",
    website: branding.websiteUrl,
    bankAccountHolder: "SPIORA Technologies LLC",
    bankName: "SPIORA Demo Bank",
    iban: "PT00 0000 0000 0000 0000 0000 0",
    swiftBic: "DEMOPT00",
    currency: "EUR",
    isDemo: true,
    version: 1,
    createdAt: now,
    updatedAt: now,
    updatedBy: null,
    ...overrides,
  };
}
