/** Client case / submission workflow types (PR #32 / #32.1). */

export const CLIENT_CASE_STATUSES = [
  "application_received",
  "initial_review",
  "documents_requested",
  "documents_under_review",
  "in_progress",
  "awaiting_decision",
  "approved",
  "completed",
  "cancelled",
] as const;

export type ClientCaseStatus = (typeof CLIENT_CASE_STATUSES)[number];

export const CLIENT_CASE_ACTIVITY_TYPES = [
  "invitation_created",
  "invitation_accepted",
  "registration",
  "questionnaire_started",
  "questionnaire_submitted",
  "documents_uploaded",
  "comment_added",
  "status_changed",
  "employee_assigned",
  "crm_client_linked",
] as const;

export type ClientCaseActivityType = (typeof CLIENT_CASE_ACTIVITY_TYPES)[number];

export type ClientCaseRecord = {
  id: string;
  clientPortalUserId: string;
  invitationId: string;
  questionnaireId: string;
  crmClientId: string | null;
  assignedTo: string | null;
  assignedName: string | null;
  serviceType: string | null;
  currentStatus: ClientCaseStatus;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type ClientCaseStatusHistoryRecord = {
  id: string;
  caseId: string;
  fromStatus: ClientCaseStatus | null;
  toStatus: ClientCaseStatus;
  actorUserId: string | null;
  actorRole: "employee" | "client" | "system";
  clientVisibleKey: string | null;
  note: string | null;
  createdAt: string;
};

export type ClientCaseCommentRecord = {
  id: string;
  caseId: string;
  authorUserId: string | null;
  authorName: string;
  body: string;
  visibility: "internal" | "client";
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type ClientCaseActivityRecord = {
  id: string;
  caseId: string;
  eventType: ClientCaseActivityType | string;
  actorUserId: string | null;
  actorRole: "employee" | "client" | "system";
  payload: Record<string, unknown>;
  createdAt: string;
};

/** Client-safe portal DTO — never includes comments or internal docs. */
export type ClientCasePublic = {
  id: string;
  currentStatus: ClientCaseStatus;
  submittedAt: string;
  serviceType: string | null;
  nextStep: ClientCaseStatus | null;
  history: Array<{
    id: string;
    toStatus: ClientCaseStatus;
    createdAt: string;
    /** Client-visible status key only — never internal notes. */
    labelKey: string;
  }>;
};

export type ClientCaseIntakeItem = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  serviceType: string | null;
  submittedAt: string;
  assignedName: string | null;
  currentStatus: ClientCaseStatus;
  crmClientId: string | null;
  questionnaireId: string;
};

export function isClientCaseStatus(value: unknown): value is ClientCaseStatus {
  return typeof value === "string" && (CLIENT_CASE_STATUSES as readonly string[]).includes(value);
}

export function nextCaseStatus(status: ClientCaseStatus): ClientCaseStatus | null {
  const order: ClientCaseStatus[] = [
    "application_received",
    "initial_review",
    "documents_requested",
    "documents_under_review",
    "in_progress",
    "awaiting_decision",
    "approved",
    "completed",
  ];
  if (status === "cancelled") return null;
  const idx = order.indexOf(status);
  if (idx < 0 || idx >= order.length - 1) return null;
  return order[idx + 1] ?? null;
}

export function extractCaseSnapshotFromAnswers(
  answers: Record<string, unknown>,
  portalEmail: string,
): {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  serviceType: string | null;
} {
  const asString = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : null;
  return {
    firstName: asString(answers.first_name),
    lastName: asString(answers.last_name),
    email: asString(answers.email) ?? (portalEmail.trim() || null),
    phone: asString(answers.phone),
    serviceType: asString(answers.service_goal),
  };
}
