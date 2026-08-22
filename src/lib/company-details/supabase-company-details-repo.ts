import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { CompanyDetailsError } from "./errors";
import type { CompanyDetailsRecord, CompanyDetailsUpdateInput } from "./types";

type Row = {
  id: string;
  company_name: string;
  trading_name: string;
  registration_number: string;
  vat_number: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  postal_code: string;
  country: string;
  general_email: string;
  finance_email: string;
  phone: string;
  website: string;
  bank_account_holder: string;
  bank_name: string;
  iban: string;
  swift_bic: string;
  currency: string;
  is_demo: boolean;
  version: number;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

function mapRow(row: Row): CompanyDetailsRecord {
  return {
    id: row.id,
    companyName: row.company_name,
    tradingName: row.trading_name,
    registrationNumber: row.registration_number,
    vatNumber: row.vat_number,
    addressLine1: row.address_line_1,
    addressLine2: row.address_line_2,
    city: row.city,
    postalCode: row.postal_code,
    country: row.country,
    generalEmail: row.general_email,
    financeEmail: row.finance_email,
    phone: row.phone,
    website: row.website,
    bankAccountHolder: row.bank_account_holder,
    bankName: row.bank_name,
    iban: row.iban,
    swiftBic: row.swift_bic,
    currency: row.currency,
    isDemo: row.is_demo,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

function mapRpcError(error: { message?: string; code?: string } | null): never {
  const message = error?.message ?? "Company details RPC failed";
  if (message.includes("COMPANY_DETAILS_VERSION_CONFLICT")) {
    throw new CompanyDetailsError(
      "COMPANY_DETAILS_VERSION_CONFLICT",
      "Company details were changed by another user. Refresh and try again.",
      409,
    );
  }
  if (message.includes("COMPANY_DETAILS_ACCESS_DENIED")) {
    throw new CompanyDetailsError(
      "COMPANY_DETAILS_ACCESS_DENIED",
      "Company details access denied",
      403,
    );
  }
  if (message.includes("COMPANY_DETAILS_NOT_FOUND")) {
    throw new CompanyDetailsError(
      "COMPANY_DETAILS_NOT_FOUND",
      "Company details not found",
      404,
    );
  }
  throw new CompanyDetailsError(
    "COMPANY_DETAILS_STORE_UNAVAILABLE",
    message,
    503,
  );
}

export async function fetchCompanyDetailsRow(): Promise<CompanyDetailsRecord> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc("spiora_company_details_get");
  if (error) mapRpcError(error);
  if (!data) {
    throw new CompanyDetailsError(
      "COMPANY_DETAILS_NOT_FOUND",
      "Company details not found",
      404,
    );
  }
  return mapRow(data as Row);
}

export async function patchCompanyDetailsRow(
  actorProfileId: string,
  input: CompanyDetailsUpdateInput,
): Promise<CompanyDetailsRecord> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc("spiora_company_details_update", {
    p_actor_profile_id: actorProfileId,
    p_expected_version: input.expectedVersion,
    p_company_name: input.companyName,
    p_trading_name: input.tradingName,
    p_registration_number: input.registrationNumber,
    p_vat_number: input.vatNumber,
    p_address_line_1: input.addressLine1,
    p_address_line_2: input.addressLine2,
    p_city: input.city,
    p_postal_code: input.postalCode,
    p_country: input.country,
    p_general_email: input.generalEmail,
    p_finance_email: input.financeEmail,
    p_phone: input.phone,
    p_website: input.website,
    p_bank_account_holder: input.bankAccountHolder,
    p_bank_name: input.bankName,
    p_iban: input.iban,
    p_swift_bic: input.swiftBic,
    p_currency: input.currency,
  });
  if (error) mapRpcError(error);
  if (!data) {
    throw new CompanyDetailsError(
      "COMPANY_DETAILS_STORE_UNAVAILABLE",
      "Update returned no data",
      503,
    );
  }
  return mapRow(data as Row);
}
