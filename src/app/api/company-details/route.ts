import { NextResponse } from "next/server";
import { getRequestLocale } from "@/i18n/api-messages";
import { getSession } from "@/lib/auth/session";
import { companyDetailsErrorResponse } from "@/lib/company-details/http";
import {
  canManageCompanyDetails,
  canViewCompanyDetails,
} from "@/lib/company-details/permissions";
import {
  getCompanyDetails,
  updateCompanyDetails,
} from "@/lib/company-details/service";
import { CompanyDetailsError } from "@/lib/company-details/errors";

export async function GET() {
  const session = await getSession();
  const locale = await getRequestLocale();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canViewCompanyDetails(session)) {
    return companyDetailsErrorResponse(
      new CompanyDetailsError(
        "COMPANY_DETAILS_ACCESS_DENIED",
        "denied",
        403,
      ),
      locale,
    );
  }
  try {
    const details = await getCompanyDetails(session);
    return NextResponse.json({ details });
  } catch (error) {
    return companyDetailsErrorResponse(error, locale);
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  const locale = await getRequestLocale();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageCompanyDetails(session)) {
    return companyDetailsErrorResponse(
      new CompanyDetailsError(
        "COMPANY_DETAILS_ACCESS_DENIED",
        "denied",
        403,
      ),
      locale,
    );
  }
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const details = await updateCompanyDetails(session, body);
    return NextResponse.json({ details });
  } catch (error) {
    return companyDetailsErrorResponse(error, locale);
  }
}
