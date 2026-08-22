import type { CompanyDetailsRecord } from "./types";
import { formatAddressBlock } from "./validation";

export function formatCompanyDetailsCopyText(record: CompanyDetailsRecord): string {
  const addressLines = formatAddressBlock(record).split("\n");

  const lines = [
    record.companyName,
    ...addressLines,
    record.registrationNumber
      ? `Company ID: ${record.registrationNumber}`
      : null,
    record.vatNumber ? `VAT: ${record.vatNumber}` : null,
    record.generalEmail ? `Email: ${record.generalEmail}` : null,
    record.financeEmail ? `Finance: ${record.financeEmail}` : null,
    record.phone ? `Phone: ${record.phone}` : null,
    record.bankName ? `Bank: ${record.bankName}` : null,
    record.bankAccountHolder
      ? `Account Holder: ${record.bankAccountHolder}`
      : null,
    record.iban ? `IBAN: ${record.iban}` : null,
    record.swiftBic ? `SWIFT/BIC: ${record.swiftBic}` : null,
    record.currency ? `Currency: ${record.currency}` : null,
    record.isDemo ? "DEMO DATA — NOT FOR REAL TRANSACTIONS" : null,
  ].filter((line): line is string => Boolean(line));

  return lines.join("\n");
}

export function formatAddressCopyText(record: CompanyDetailsRecord): string {
  return formatAddressBlock(record);
}
