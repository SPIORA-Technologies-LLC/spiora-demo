import { CompanyDetailsError } from "./errors";
import type { CompanyDetailsUpdateInput } from "./types";

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX = {
  companyName: 200,
  tradingName: 120,
  registrationNumber: 80,
  vatNumber: 80,
  addressLine1: 200,
  addressLine2: 200,
  city: 120,
  postalCode: 40,
  country: 120,
  generalEmail: 254,
  financeEmail: 254,
  phone: 60,
  website: 500,
  bankAccountHolder: 200,
  bankName: 200,
  iban: 80,
  swiftBic: 40,
  currency: 8,
} as const;

function cleanText(value: unknown, field: keyof typeof MAX, required = false): string {
  if (value == null) {
    if (required) {
      throw new CompanyDetailsError(
        "COMPANY_DETAILS_VALIDATION",
        `${field} is required`,
        400,
        { [field]: "required" },
      );
    }
    return "";
  }
  if (typeof value !== "string") {
    throw new CompanyDetailsError(
      "COMPANY_DETAILS_VALIDATION",
      `${field} must be a string`,
      400,
      { [field]: "invalid" },
    );
  }
  const trimmed = value.trim();
  if (CONTROL_CHARS.test(trimmed)) {
    throw new CompanyDetailsError(
      "COMPANY_DETAILS_VALIDATION",
      `${field} contains invalid characters`,
      400,
      { [field]: "invalid" },
    );
  }
  if (required && !trimmed) {
    throw new CompanyDetailsError(
      "COMPANY_DETAILS_VALIDATION",
      `${field} is required`,
      400,
      { [field]: "required" },
    );
  }
  if (trimmed.length > MAX[field]) {
    throw new CompanyDetailsError(
      "COMPANY_DETAILS_VALIDATION",
      `${field} is too long`,
      400,
      { [field]: "too_long" },
    );
  }
  return trimmed;
}

function cleanEmail(value: unknown, field: "generalEmail" | "financeEmail"): string {
  const trimmed = cleanText(value, field, true);
  if (!EMAIL_RE.test(trimmed)) {
    throw new CompanyDetailsError(
      "COMPANY_DETAILS_VALIDATION",
      `${field} must be a valid email`,
      400,
      { [field]: "invalid_email" },
    );
  }
  return trimmed;
}

function cleanWebsite(value: unknown): string {
  const trimmed = cleanText(value, "website");
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("invalid protocol");
    }
    return trimmed;
  } catch {
    throw new CompanyDetailsError(
      "COMPANY_DETAILS_VALIDATION",
      "website must be a valid URL",
      400,
      { website: "invalid_url" },
    );
  }
}

export function validateCompanyDetailsUpdate(
  input: Partial<CompanyDetailsUpdateInput>,
): CompanyDetailsUpdateInput {
  const expectedVersion = input.expectedVersion;
  if (
    typeof expectedVersion !== "number" ||
    !Number.isInteger(expectedVersion) ||
    expectedVersion < 1
  ) {
    throw new CompanyDetailsError(
      "COMPANY_DETAILS_VALIDATION",
      "expectedVersion is required",
      400,
      { expectedVersion: "required" },
    );
  }

  const currency = cleanText(input.currency, "currency", true).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new CompanyDetailsError(
      "COMPANY_DETAILS_VALIDATION",
      "currency must be a 3-letter code",
      400,
      { currency: "invalid" },
    );
  }

  return {
    companyName: cleanText(input.companyName, "companyName", true),
    tradingName: cleanText(input.tradingName, "tradingName"),
    registrationNumber: cleanText(input.registrationNumber, "registrationNumber"),
    vatNumber: cleanText(input.vatNumber, "vatNumber"),
    addressLine1: cleanText(input.addressLine1, "addressLine1"),
    addressLine2: cleanText(input.addressLine2, "addressLine2"),
    city: cleanText(input.city, "city"),
    postalCode: cleanText(input.postalCode, "postalCode"),
    country: cleanText(input.country, "country", true),
    generalEmail: cleanEmail(input.generalEmail, "generalEmail"),
    financeEmail: cleanEmail(input.financeEmail, "financeEmail"),
    phone: cleanText(input.phone, "phone"),
    website: cleanWebsite(input.website),
    bankAccountHolder: cleanText(input.bankAccountHolder, "bankAccountHolder"),
    bankName: cleanText(input.bankName, "bankName"),
    iban: cleanText(input.iban, "iban"),
    swiftBic: cleanText(input.swiftBic, "swiftBic"),
    currency,
    expectedVersion,
  };
}

export function formatAddressBlock(record: {
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  country: string;
}): string {
  const lines = [
    record.addressLine1,
    record.addressLine2,
    [record.city, record.postalCode].filter(Boolean).join(", "),
    record.country,
  ].filter(Boolean);
  return lines.join("\n");
}
