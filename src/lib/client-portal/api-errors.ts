import { NextResponse } from "next/server";

export type ClientApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_EMAIL"
  | "INVALID_LOCALE"
  | "INVALID_EXPIRY"
  | "INVALID_ASSIGNEE"
  | "ASSIGNEE_REQUIRED"
  | "INVALID_BODY"
  | "ORIGIN_MISMATCH"
  | "INVITATION_INVALID"
  | "INVITATION_EXPIRED"
  | "INVITATION_REVOKED"
  | "INVITATION_ACCEPTED"
  | "EMAIL_MISMATCH"
  | "EMAIL_CONFIRMATION_REQUIRED"
  | "PORTAL_USER_EXISTS"
  | "ACCEPT_FAILED"
  | "ALREADY_ACCEPTED"
  | "AUTH_PROVISION_FAILED"
  | "EMAIL_NOT_CONFIGURED"
  | "EMAIL_SEND_FAILED"
  | "AUTH_REQUIRED"
  | "AUTH_UNAVAILABLE"
  | "RATE_LIMITED"
  | "QUESTIONNAIRE_NOT_AVAILABLE"
  | "QUESTIONNAIRE_SCHEMA_INVALID"
  | "QUESTIONNAIRE_READ_ONLY"
  | "QUESTIONNAIRE_REVISION_CONFLICT"
  | "QUESTIONNAIRE_VALIDATION_FAILED"
  | "QUESTIONNAIRE_FIELD_UNKNOWN"
  | "QUESTIONNAIRE_VALUE_INVALID"
  | "QUESTIONNAIRE_PAYLOAD_TOO_LARGE"
  | "QUESTIONNAIRE_ACCESS_DENIED"
  | "QUESTIONNAIRE_ALREADY_IN_REVIEW"
  | "QUESTIONNAIRE_NOT_IN_REVIEW"
  | "QUESTIONNAIRE_ALREADY_SUBMITTED"
  | "INVALID_STATUS"
  | "CASE_NOT_FOUND"
  | "INTERNAL";

const MESSAGES: Record<ClientApiErrorCode, string> = {
  UNAUTHORIZED: "Authentication required",
  FORBIDDEN: "Forbidden",
  NOT_FOUND: "Not found",
  INVALID_EMAIL: "Invalid email",
  INVALID_LOCALE: "Invalid locale",
  INVALID_EXPIRY: "Expiry must be between 1 and 30 days",
  INVALID_ASSIGNEE: "Invalid assignee",
  ASSIGNEE_REQUIRED: "Assignee is required",
  INVALID_BODY: "Invalid request body",
  ORIGIN_MISMATCH: "Origin check failed",
  INVITATION_INVALID: "Invitation is not available",
  INVITATION_EXPIRED: "Invitation has expired",
  INVITATION_REVOKED: "Invitation was revoked",
  INVITATION_ACCEPTED: "Invitation was already accepted",
  EMAIL_MISMATCH: "Signed-in email does not match the invitation",
  EMAIL_CONFIRMATION_REQUIRED: "Confirm your email, then return to this link",
  PORTAL_USER_EXISTS: "This account is already linked to another invitation",
  ACCEPT_FAILED: "Could not accept invitation",
  ALREADY_ACCEPTED: "Invitation already accepted",
  AUTH_PROVISION_FAILED: "Could not create client login credentials",
  EMAIL_NOT_CONFIGURED:
    "Email delivery is not configured (SPIORA_ENABLE_EMAIL / BREVO_API_KEY / SPIORA_EMAIL_FROM)",
  EMAIL_SEND_FAILED: "Could not send invitation email",
  AUTH_REQUIRED: "Sign in required",
  AUTH_UNAVAILABLE: "Authentication is unavailable",
  RATE_LIMITED: "Too many requests",
  QUESTIONNAIRE_NOT_AVAILABLE: "Questionnaire is not available",
  QUESTIONNAIRE_SCHEMA_INVALID: "Questionnaire schema is invalid",
  QUESTIONNAIRE_READ_ONLY: "Questionnaire is read-only",
  QUESTIONNAIRE_REVISION_CONFLICT: "Questionnaire revision conflict",
  QUESTIONNAIRE_VALIDATION_FAILED: "Questionnaire contains invalid answers.",
  QUESTIONNAIRE_FIELD_UNKNOWN: "Questionnaire field is unknown",
  QUESTIONNAIRE_VALUE_INVALID: "Questionnaire value is invalid",
  QUESTIONNAIRE_PAYLOAD_TOO_LARGE: "Questionnaire payload is too large",
  QUESTIONNAIRE_ACCESS_DENIED: "Questionnaire access denied",
  QUESTIONNAIRE_ALREADY_IN_REVIEW: "Questionnaire is already in review",
  QUESTIONNAIRE_NOT_IN_REVIEW: "Questionnaire is not in review",
  QUESTIONNAIRE_ALREADY_SUBMITTED: "Questionnaire is already submitted",
  INVALID_STATUS: "Invalid case status",
  CASE_NOT_FOUND: "Case not found",
  INTERNAL: "Something went wrong",
};

export function clientApiError(
  code: ClientApiErrorCode,
  status: number,
  message?: string,
) {
  return NextResponse.json(
    {
      error: {
        code,
        message: message ?? MESSAGES[code],
      },
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export function clientApiOk<T extends Record<string, unknown>>(
  body: T,
  init?: { status?: number },
) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
