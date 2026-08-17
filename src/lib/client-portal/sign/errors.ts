export const SIGN_ERROR_CODES = [
  "OTP_INVALID",
  "OTP_EXPIRED",
  "OTP_TOO_MANY_ATTEMPTS",
  "OTP_RATE_LIMITED",
  "OTP_NOT_REQUESTED",
  "CONTRACT_NOT_FOUND",
  "CONTRACT_ACCESS_DENIED",
  "CONTRACT_WRONG_STATUS",
  "CONTRACT_ALREADY_SIGNED",
  "CONTRACT_SUPERSEDED",
  "CONTRACT_CANCELLED",
  "DOCUMENT_HASH_MISMATCH",
  "PROVIDER_PERMISSION_REQUIRED",
  "PROVIDER_MFA_REQUIRED",
  "PROVIDER_MFA_NOT_CONFIGURED",
  "PROVIDER_CONFIRMATION_REQUIRED",
  "PROVIDER_PROFILE_INCOMPLETE",
  "FINALIZATION_FAILED",
  "CONSENT_REQUIRED",
  "AGREEMENT_NOT_SIGNED",
  "EMAIL_NOT_CONFIGURED",
  "EMAIL_SEND_FAILED",
  "INVALID_BODY",
] as const;

export type SignErrorCode = (typeof SIGN_ERROR_CODES)[number];

export class SignError extends Error {
  readonly code: SignErrorCode;
  readonly httpStatus: number;

  constructor(code: SignErrorCode, httpStatus = 400) {
    super(code);
    this.name = "SignError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export function signHttpStatus(code: SignErrorCode): number {
  switch (code) {
    case "CONTRACT_NOT_FOUND":
      return 404;
    case "CONTRACT_ACCESS_DENIED":
    case "PROVIDER_PERMISSION_REQUIRED":
    case "PROVIDER_MFA_REQUIRED":
      return 403;
    case "PROVIDER_MFA_NOT_CONFIGURED":
      return 503;
    case "OTP_RATE_LIMITED":
      return 429;
    case "EMAIL_NOT_CONFIGURED":
      return 503;
    case "FINALIZATION_FAILED":
    case "DOCUMENT_HASH_MISMATCH":
      return 409;
    default:
      return 400;
  }
}
