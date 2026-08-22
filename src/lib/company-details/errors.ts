export type CompanyDetailsErrorCode =
  | "COMPANY_DETAILS_ACCESS_DENIED"
  | "COMPANY_DETAILS_NOT_FOUND"
  | "COMPANY_DETAILS_VALIDATION"
  | "COMPANY_DETAILS_VERSION_CONFLICT"
  | "COMPANY_DETAILS_STORE_UNAVAILABLE";

export class CompanyDetailsError extends Error {
  readonly code: CompanyDetailsErrorCode;
  readonly status: number;
  readonly fieldErrors?: Record<string, string>;

  constructor(
    code: CompanyDetailsErrorCode,
    message: string,
    status = 400,
    fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "CompanyDetailsError";
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export function companyDetailsErrorStatus(
  code: CompanyDetailsErrorCode,
): number {
  switch (code) {
    case "COMPANY_DETAILS_ACCESS_DENIED":
      return 403;
    case "COMPANY_DETAILS_NOT_FOUND":
      return 404;
    case "COMPANY_DETAILS_VERSION_CONFLICT":
      return 409;
    case "COMPANY_DETAILS_STORE_UNAVAILABLE":
      return 503;
    default:
      return 400;
  }
}
