import type { Client } from "./types";

function display(value: string | undefined): string {
  const trimmed = value?.trim();
  return trimmed && trimmed !== "—" ? trimmed : "—";
}

export type ClientSheetFieldKey =
  | "lastName"
  | "latin"
  | "passport"
  | "email"
  | "submittedAt"
  | "expectedApproval"
  | "referent"
  | "bookingAddress"
  | "bookingRange"
  | "approvalDate"
  | "notes"
  | "cardIssuedDate"
  | "appPassword"
  | "partner"
  | "contract";

/** Все поля вкладки «Клиенты» (Google Sheets) в порядке таблицы. */
export function getClientSheetFields(
  client: Client,
): Array<{ labelKey: ClientSheetFieldKey; value: string }> {
  return [
    { labelKey: "lastName", value: display(client.name) },
    { labelKey: "latin", value: display(client.citizenship) },
    {
      labelKey: "passport",
      value: display(client.passportNumber ?? client.id),
    },
    { labelKey: "email", value: display(client.email) },
    {
      labelKey: "submittedAt",
      value: display(client.submittedAt ?? client.createdAt),
    },
    {
      labelKey: "expectedApproval",
      value: display(client.expectedApprovalAt),
    },
    {
      labelKey: "referent",
      value: display(client.referentName ?? client.manager),
    },
    { labelKey: "bookingAddress", value: display(client.bookingAddress) },
    { labelKey: "bookingRange", value: display(client.bookingRange) },
    { labelKey: "approvalDate", value: display(client.approvalAt) },
    { labelKey: "notes", value: display(client.notes) },
    {
      labelKey: "cardIssuedDate",
      value: display(client.residenceCardIssuedAt),
    },
    { labelKey: "appPassword", value: display(client.appPassword) },
    { labelKey: "partner", value: display(client.partnerName) },
    { labelKey: "contract", value: display(client.contract) },
  ];
}
