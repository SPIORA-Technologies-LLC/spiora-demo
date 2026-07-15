import type { Client } from "@/lib/google-sheets/types";

export type ClientRow = {
  id: string;
  external_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string;
  status: string;
  pipeline_stage: string;
  assigned_user_id: string | null;
  assigned_manager_name: string;
  country: string;
  citizenship: string;
  direction: string;
  service_type: string;
  source: string;
  notes_summary: string;
  passport_number: string | null;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  is_demo: boolean;
  legacy_fields: Record<string, unknown>;
};

function formatDisplayDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("ru-RU");
}

export function mapClientRowToClient(row: ClientRow): Client {
  const legacy = row.legacy_fields ?? {};
  const getLegacy = (key: string): string | undefined => {
    const value = legacy[key];
    return typeof value === "string" && value.trim() ? value : undefined;
  };

  return {
    id: row.external_id,
    name: row.full_name,
    phone: row.phone || "—",
    email: row.email || "—",
    country: row.country || "—",
    citizenship: row.citizenship || "—",
    direction: row.direction || "—",
    status: row.status || "New",
    manager: row.assigned_manager_name || "—",
    lastActivity: formatDisplayDate(row.last_activity_at),
    createdAt: formatDisplayDate(row.created_at),
    passportNumber: row.passport_number ?? undefined,
    notes: row.notes_summary || undefined,
    submittedAt: getLegacy("submittedAt"),
    expectedApprovalAt: getLegacy("expectedApprovalAt"),
    referentName: getLegacy("referentName"),
    bookingAddress: getLegacy("bookingAddress"),
    bookingRange: getLegacy("bookingRange"),
    approvalAt: getLegacy("approvalAt"),
    residenceCardIssuedAt: getLegacy("residenceCardIssuedAt"),
    appPassword: getLegacy("appPassword"),
    partnerName: getLegacy("partnerName"),
    contract: getLegacy("contract"),
  };
}

export function splitFullName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export type ClientInsertPayload = {
  external_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string;
  status: string;
  pipeline_stage: string;
  assigned_user_id: string | null;
  assigned_manager_name: string;
  country: string;
  citizenship: string;
  direction: string;
  service_type: string;
  source: string;
  notes_summary: string;
  passport_number: string | null;
  last_activity_at: string | null;
  is_demo: boolean;
  legacy_fields?: Record<string, unknown>;
};

export function mapClientToInsertPayload(
  client: Client,
  options: { isDemo?: boolean; source?: string } = {},
): ClientInsertPayload {
  const { firstName, lastName } = splitFullName(client.name);
  return {
    external_id: client.id,
    first_name: firstName,
    last_name: lastName,
    full_name: client.name,
    email: client.email === "—" ? "" : client.email,
    phone: client.phone === "—" ? "" : client.phone,
    status: client.status,
    pipeline_stage: client.status,
    assigned_user_id: null,
    assigned_manager_name: client.manager === "—" ? "" : client.manager,
    country: client.country === "—" ? "" : client.country,
    citizenship: client.citizenship === "—" ? "" : client.citizenship,
    direction: client.direction === "—" ? "" : client.direction,
    service_type: client.direction === "—" ? "" : client.direction,
    source: options.source ?? "demo",
    notes_summary: client.notes ?? "",
    passport_number: client.passportNumber ?? null,
    last_activity_at: new Date().toISOString(),
    is_demo: options.isDemo ?? true,
    legacy_fields: {
      submittedAt: client.submittedAt,
      expectedApprovalAt: client.expectedApprovalAt,
      referentName: client.referentName,
      bookingAddress: client.bookingAddress,
      bookingRange: client.bookingRange,
      approvalAt: client.approvalAt,
      residenceCardIssuedAt: client.residenceCardIssuedAt,
      appPassword: client.appPassword,
      partnerName: client.partnerName,
      contract: client.contract,
    },
  };
}
